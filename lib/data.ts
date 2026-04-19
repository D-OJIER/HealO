import { analyzeSymptomsWithAi, decryptMedicationPayload, explainDoctorRecommendation, summarizePatientHistoryWithAi } from "@/lib/ai";
import { directionsUrl, haversineDistanceKm, mapEmbedUrl } from "@/lib/geo";
import { decryptPHI, maskPhi, tryDecryptPHI } from "@/lib/security";
import type { Coordinates, DoctorRecommendation, LocalDatabase, MedicationItem } from "@/lib/types";

const MINIMUM_REVIEW_THRESHOLD = 5;
type LooseRecord = Record<string, unknown>;

const DOCTOR_METADATA: Record<
  string,
  { consultationFee: number; languages: string[]; experienceYears: number; bio: string }
> = {
  "doctor-maya": {
    consultationFee: 900,
    languages: ["English", "Tamil", "Hindi"],
    experienceYears: 12,
    bio: "Focuses on preventive cardiology, hypertension, and lifestyle-linked heart risk."
  },
  "doctor-arjun": {
    consultationFee: 700,
    languages: ["English", "Tamil", "Malayalam"],
    experienceYears: 9,
    bio: "Treats chronic rashes, allergies, acne, and general skin concerns."
  },
  "doctor-nisha": {
    consultationFee: 500,
    languages: ["English", "Tamil", "Hindi"],
    experienceYears: 11,
    bio: "Family physician handling fever, infections, follow-up care, and first-line triage."
  }
};

function weightedRating(ratings: number[], globalAverage: number) {
  if (!ratings.length) {
    return globalAverage;
  }

  const total = ratings.reduce((sum, rating) => sum + rating, 0);
  const average = total / ratings.length;
  return (
    (ratings.length / (ratings.length + MINIMUM_REVIEW_THRESHOLD)) * average +
    (MINIMUM_REVIEW_THRESHOLD / (ratings.length + MINIMUM_REVIEW_THRESHOLD)) * globalAverage
  );
}

export async function fetchDoctorRecommendations(
  db: LocalDatabase,
  options: {
    patientLocation?: Coordinates | null;
    symptoms?: string;
    specialtyHint?: string | null;
  }
) {
  const specialtyAnalysis = options.symptoms ? await analyzeSymptomsWithAi(options.symptoms) : null;
  const specialtyTarget = options.specialtyHint || specialtyAnalysis?.specialty || null;
  const nowIso = new Date().toISOString();

  const doctorRows = db.doctors.filter((row) => row.verification_status === "verified");
  const linkRows = db.doctor_clinics;
  const slotRows = db.doctor_slots
    .filter((row) => row.start_time >= nowIso)
    .sort((a, b) => a.start_time.localeCompare(b.start_time));
  const reviewRows = db.reviews;
  const userById = new Map(db.users.map((row) => [row.id, row]));

  const activeSlotIds = new Set(
    db.appointments
      .filter((item) => item.status === "pending" || item.status === "accepted")
      .map((item) => item.slot_id)
  );
  const allRatings = reviewRows.map((review) => Number(review.rating));
  const globalAverage = allRatings.length
    ? allRatings.reduce((sum, rating) => sum + rating, 0) / allRatings.length
    : 4;

  const clinicsByDoctor = new Map<string, Array<LooseRecord>>();
  for (const row of linkRows || []) {
    const clinic = db.clinics.find((item) => item.id === row.clinic_id) as unknown as LooseRecord | undefined;
    if (!clinic) continue;
    const current = clinicsByDoctor.get(row.doctor_id) || [];
    current.push(clinic);
    clinicsByDoctor.set(row.doctor_id, current);
  }

  const slotsByDoctor = new Map<string, Array<LooseRecord>>();
  for (const row of slotRows || []) {
    if (activeSlotIds.has(row.id)) continue;
    const current = slotsByDoctor.get(row.doctor_id) || [];
    current.push(row as unknown as LooseRecord);
    slotsByDoctor.set(row.doctor_id, current);
  }

  const reviewsByDoctor = new Map<string, number[]>();
  for (const row of reviewRows || []) {
    const current = reviewsByDoctor.get(row.doctor_id) || [];
    current.push(Number(row.rating));
    reviewsByDoctor.set(row.doctor_id, current);
  }

  const doctors: DoctorRecommendation[] = (doctorRows || [])
    .map((row) => {
      const user = userById.get(row.user_id) as LooseRecord | undefined;
      const clinics = clinicsByDoctor.get(row.id) || [];
      const clinicViews = clinics
        .map((clinic) => {
          const clinicSlots = (slotsByDoctor.get(row.id) || []).filter(
            (slot) => String(slot.clinic_id) === String(clinic.id)
          );
          const coords =
            clinic.location_lat !== null && clinic.location_lng !== null
              ? { lat: Number(clinic.location_lat), lng: Number(clinic.location_lng) }
              : null;

          return {
            clinicId: String(clinic.id),
            clinicName: String(clinic.name),
            address: String(clinic.address),
            distanceKm:
              options.patientLocation && coords
                ? haversineDistanceKm(options.patientLocation, coords)
                : null,
            directionsUrl: coords ? directionsUrl(coords, String(clinic.name)) : "#",
            mapEmbedUrl: coords ? mapEmbedUrl(coords) : "",
            availableSlots: clinicSlots.map((slot) => ({
              id: String(slot.id),
              start: String(slot.start_time),
              end: String(slot.end_time)
            }))
          };
        })
        .sort((a, b) => (a.distanceKm ?? Number.MAX_SAFE_INTEGER) - (b.distanceKm ?? Number.MAX_SAFE_INTEGER));

      const clinic = clinicViews[0];
      const nextSlot = clinicViews.flatMap((item) => item.availableSlots).sort((a, b) => a.start.localeCompare(b.start))[0];
      if (!user || !clinic) {
        return null;
      }

      const ratings = reviewsByDoctor.get(row.id) || [];
      const weighted = weightedRating(ratings, globalAverage);
      const metadata = DOCTOR_METADATA[row.id] || {
        consultationFee: 600,
        languages: ["English"],
        experienceYears: 8,
        bio: "General clinic profile."
      };

      const recommendation: DoctorRecommendation = {
        id: String(user.id),
        doctorProfileId: String(row.id),
        name: String(user.name),
        specialty: String(row.specialty || "General Medicine"),
        verificationStatus: row.verification_status as DoctorRecommendation["verificationStatus"],
        weightedRating: Number(weighted.toFixed(2)),
        reviewCount: ratings.length,
        clinicName: clinic.clinicName,
        address: clinic.address,
        distanceKm: clinic.distanceKm,
        whyRecommended: "",
        nextSlotId: nextSlot ? nextSlot.id : null,
        nextSlotStart: nextSlot ? nextSlot.start : null,
        directionsUrl: clinic.directionsUrl,
        mapEmbedUrl: clinic.mapEmbedUrl,
        consultationFee: metadata.consultationFee,
        languages: metadata.languages,
        experienceYears: metadata.experienceYears,
        bio: metadata.bio,
        clinics: clinicViews
      };

      recommendation.whyRecommended = explainDoctorRecommendation({
        doctor: recommendation,
        specialty: specialtyTarget || recommendation.specialty,
        aiReasoning: specialtyAnalysis?.doctorReasoning || "Ranked for verification, specialty fit, rating, and clinic access."
      });

      return recommendation;
    })
    .filter((item): item is DoctorRecommendation => Boolean(item))
    .sort((a, b) => {
      const specialtyScoreA = specialtyTarget && a.specialty === specialtyTarget ? 2 : 0;
      const specialtyScoreB = specialtyTarget && b.specialty === specialtyTarget ? 2 : 0;
      const distanceScoreA = a.distanceKm === null ? 0 : -a.distanceKm;
      const distanceScoreB = b.distanceKm === null ? 0 : -b.distanceKm;
      return specialtyScoreB - specialtyScoreA || b.weightedRating - a.weightedRating || distanceScoreB - distanceScoreA;
    });

  return {
    specialty: specialtyTarget || "General Medicine",
    rationale:
      specialtyAnalysis?.rationale ||
      "Doctors are ranked using verification status, specialty fit, weighted rating, and nearby clinic availability.",
    urgency: specialtyAnalysis?.urgency || "medium",
    doctors
  };
}

export async function fetchPatientHistorySummary(
  db: LocalDatabase,
  patientId: string,
  currentSymptom?: string
) {
  const symptomRows = db.symptoms
    .filter((row) => row.patient_id === patientId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 5);
  const prescriptionRows = db.prescriptions
    .filter((row) => row.patient_id === patientId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 5);

  const decryptedSymptoms = (symptomRows || []).map((row) => tryDecryptPHI(row.description));
  const decryptedPrescriptions = (prescriptionRows || []).map((row) => ({
    diagnosis: tryDecryptPHI(row.diagnosis),
    notes: tryDecryptPHI(row.doctor_notes),
    medications: decryptMedicationPayload(row.medications)
  }));

  return summarizePatientHistoryWithAi({
    symptoms: [currentSymptom, ...decryptedSymptoms].filter(Boolean) as string[],
    prescriptions: decryptedPrescriptions
  });
}

export function parseMedicationLines(input: string) {
  return input
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name = "", dosage = "", schedule = ""] = line.split("|").map((part) => part.trim());
      return { name, dosage, schedule } satisfies MedicationItem;
    })
    .filter((item) => item.name && item.schedule);
}

export function maskPatientContact(phone: string | null) {
  return maskPhi(phone || "");
}

export function decryptSymptomText(value: string | null) {
  return tryDecryptPHI(value);
}

export function decryptPrescriptionFields(input: {
  diagnosis: string | null;
  doctor_notes: string | null;
  medications: unknown;
}) {
  return {
    diagnosis: tryDecryptPHI(input.diagnosis),
    notes: tryDecryptPHI(input.doctor_notes),
    medications: decryptMedicationPayload(input.medications)
  };
}

export function decryptStoredSymptom(value: string | null) {
  return value ? decryptPHI(value) : "";
}
