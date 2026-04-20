import { analyzeSymptomsWithAi, decryptMedicationPayload, explainDoctorRecommendation, summarizePatientHistoryWithAi } from "@/lib/ai";
import { directionsUrl, haversineDistanceKm, mapEmbedUrl } from "@/lib/geo";
import { decryptPHI, maskPhi, tryDecryptPHI } from "@/lib/security";
import type { Coordinates, DoctorRecommendation, LocalDatabase, MedicationItem, PrescriptionSuggestion, PrescriptionSuggestionItem } from "@/lib/types";

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
  },
  "doctor-vivek": {
    consultationFee: 850,
    languages: ["English", "Tamil", "Hindi"],
    experienceYears: 14,
    bio: "Orthopedic specialist focused on sports injuries, joint pain, and rehab planning."
  },
  "doctor-farah": {
    consultationFee: 650,
    languages: ["English", "Tamil", "Urdu"],
    experienceYears: 10,
    bio: "Pediatrician supporting fever workups, preventive care, and parent-friendly treatment plans."
  },
  "doctor-karthik": {
    consultationFee: 700,
    languages: ["English", "Tamil"],
    experienceYears: 12,
    bio: "ENT consultant for sinus issues, throat infections, allergy-linked congestion, and hearing concerns."
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

type MedicationTemplate = {
  name: string;
  dosage: string;
  schedule: string;
  reason: string;
};

function normalizeText(value: string) {
  return value.trim().toLowerCase();
}

function buildMedicationLine(item: MedicationTemplate | PrescriptionSuggestionItem) {
  return `${item.name} | ${item.dosage} | ${item.schedule}`;
}

function matchesAllergy(medicationName: string, allergen: string) {
  const medication = normalizeText(medicationName);
  const allergy = normalizeText(allergen);

  if (!allergy) {
    return false;
  }

  return medication.includes(allergy) || allergy.includes(medication);
}

export function findMedicationAllergyConflicts(
  db: LocalDatabase,
  patientId: string,
  medications: MedicationItem[]
) {
  const allergies = db.allergies.filter((row) => row.patient_id === patientId);

  return medications.flatMap((medication) => {
    const allergy = allergies.find((item) => matchesAllergy(medication.name, item.allergen));
    if (!allergy) {
      return [];
    }

    return [{
      medicationName: medication.name,
      allergen: allergy.allergen,
      reaction: allergy.reaction,
      severity: allergy.severity
    }];
  });
}

function getTemplateBundle(symptoms: string, specialty?: string | null) {
  const text = normalizeText(`${symptoms} ${specialty || ""}`);

  if (/rash|itch|allerg|hives|dermat/.test(text)) {
    return {
      diagnosisHint: "Allergic or inflammatory skin flare",
      rationale: "Skin and allergy symptom patterns align with an antihistamine plus topical relief plan.",
      templates: [
        { name: "Cetirizine", dosage: "10mg", schedule: "22:00", reason: "Helps reduce allergy-driven itching." },
        { name: "Calamine Lotion", dosage: "Topical", schedule: "08:00,20:00", reason: "Useful for symptomatic skin relief." }
      ] satisfies MedicationTemplate[],
      cautions: ["Confirm lesion pattern and infection risk before prescribing steroid-containing topicals."]
    };
  }

  if (/knee|joint|sprain|back pain|ankle|ortho|pain/.test(text)) {
    return {
      diagnosisHint: "Musculoskeletal pain or sprain pattern",
      rationale: "Pain-focused symptoms align with short-course analgesia and supportive care reminders.",
      templates: [
        { name: "Ibuprofen", dosage: "400mg", schedule: "09:00,21:00", reason: "Common first-line option for inflammatory pain if tolerated." },
        { name: "Cold Pack", dosage: "15 min", schedule: "08:00,16:00,22:00", reason: "Supports swelling and pain control." }
      ] satisfies MedicationTemplate[],
      cautions: ["Avoid NSAID suggestions if there is gastric, kidney, or NSAID allergy history."]
    };
  }

  if (/sinus|throat|ear|ent|blocked nose|hearing|cough|cold/.test(text)) {
    return {
      diagnosisHint: "Upper respiratory or ENT irritation pattern",
      rationale: "Current symptoms fit supportive ENT symptom relief suggestions.",
      templates: [
        { name: "Levocetirizine", dosage: "5mg", schedule: "22:00", reason: "Can help allergy-linked congestion or irritation." },
        { name: "Saline Nasal Spray", dosage: "2 sprays", schedule: "08:00,14:00,20:00", reason: "Supports nasal congestion relief without systemic exposure." }
      ] satisfies MedicationTemplate[],
      cautions: ["If bacterial infection is suspected, review antibiotic history and allergy status before prescribing."]
    };
  }

  if (/child|pediatric|fever|poor appetite|viral/.test(text)) {
    return {
      diagnosisHint: "Pediatric viral or febrile symptom pattern",
      rationale: "Symptoms suggest conservative fever support and hydration-oriented care.",
      templates: [
        { name: "Paracetamol Syrup", dosage: "7.5ml", schedule: "08:00,14:00,20:00", reason: "Common fever-relief option in pediatric follow-up." },
        { name: "ORS", dosage: "100ml", schedule: "After each loose stool", reason: "Hydration support when intake is reduced." }
      ] satisfies MedicationTemplate[],
      cautions: ["Dose confirmation should be weight-based for children."]
    };
  }

  if (/fever|sore throat|fatigue|general medicine/.test(text)) {
    return {
      diagnosisHint: "General viral or fever follow-up pattern",
      rationale: "Symptoms fit supportive treatment suggestions with conservative symptomatic relief.",
      templates: [
        { name: "Paracetamol", dosage: "650mg", schedule: "08:00,14:00,21:00", reason: "Helps with fever and body ache relief." },
        { name: "Salt Water Gargle", dosage: "N/A", schedule: "09:00,18:00", reason: "Supportive relief for throat irritation." }
      ] satisfies MedicationTemplate[],
      cautions: ["Escalate care for persistent fever, dehydration, or breathing concerns."]
    };
  }

  return {
    diagnosisHint: specialty || "General follow-up review",
    rationale: "Suggestions are based on current symptoms, recent history, and common supportive options.",
    templates: [] satisfies MedicationTemplate[],
    cautions: ["Review diagnosis-specific contraindications before finalizing the prescription."]
  };
}

export function buildPrescriptionSuggestions(
  db: LocalDatabase,
  input: { patientId: string; symptoms: string; specialty?: string | null }
): PrescriptionSuggestion {
  const allergies = db.allergies
    .filter((row) => row.patient_id === input.patientId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  const previousPrescriptions = db.prescriptions
    .filter((row) => row.patient_id === input.patientId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 3);
  const recentMedications = previousPrescriptions.flatMap((row) => decryptMedicationPayload(row.medications));
  const recentMedicationNames = new Set(recentMedications.map((item) => normalizeText(item.name)));

  const bundle = getTemplateBundle(input.symptoms, input.specialty);
  const suggestions: PrescriptionSuggestionItem[] = bundle.templates.map((template) => {
    const conflictingAllergy = allergies.find((allergy) => matchesAllergy(template.name, allergy.allergen));
    const reasonParts = [template.reason];

    if (recentMedicationNames.has(normalizeText(template.name))) {
      reasonParts.push("Seen in recent prescription history.");
    }

    return {
      name: template.name,
      dosage: template.dosage,
      schedule: template.schedule,
      reason: reasonParts.join(" "),
      blocked: Boolean(conflictingAllergy),
      conflictReason: conflictingAllergy
        ? `Matches recorded allergy: ${conflictingAllergy.allergen} (${conflictingAllergy.reaction}).`
        : undefined
    };
  });

  if (!suggestions.length && recentMedications.length) {
    suggestions.push(
      ...recentMedications.slice(0, 2).map((item) => {
        const conflictingAllergy = allergies.find((allergy) => matchesAllergy(item.name, allergy.allergen));
        return {
          ...item,
          reason: "Suggested from recent prescription history for clinician review.",
          blocked: Boolean(conflictingAllergy),
          conflictReason: conflictingAllergy
            ? `Matches recorded allergy: ${conflictingAllergy.allergen} (${conflictingAllergy.reaction}).`
            : undefined
        };
      })
    );
  }

  const cautions = [...bundle.cautions];
  if (allergies.length) {
    cautions.unshift("Recorded allergies were checked against the draft suggestions.");
  }
  if (!recentMedications.length) {
    cautions.push("No prior medication history was found for this patient.");
  }

  return {
    diagnosisHint: bundle.diagnosisHint,
    rationale: bundle.rationale,
    allergySummary: allergies.map((item) => `${item.allergen} (${item.reaction}, ${item.severity})`),
    cautions,
    suggestions
  };
}

export function suggestionItemsToMedicationText(items: PrescriptionSuggestionItem[]) {
  return items
    .filter((item) => !item.blocked)
    .map(buildMedicationLine)
    .join("\n");
}
