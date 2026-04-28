import { NextResponse } from "next/server";
import { requireRole, getDoctorProfileForUser } from "@/lib/auth";
import { buildPrescriptionSuggestions, decryptPrescriptionFields, decryptStoredSymptom, fetchPatientHistorySummary, maskPatientContact } from "@/lib/data";

export async function GET() {
  const result = await requireRole("doctor");
  if (!result.ok) {
    return result.response;
  }

  const doctor = await getDoctorProfileForUser(result.profile.id);
  if (!doctor) {
    return NextResponse.json({ error: "Doctor profile not found." }, { status: 404 });
  }

  const clinicLinks = result.db.doctor_clinics.filter((item) => item.doctor_id === doctor.id);
  const clinics = clinicLinks
    .map((link) => result.db.clinics.find((clinic) => clinic.id === link.clinic_id))
    .filter(Boolean);
  const slots = result.db.doctor_slots
    .filter((item) => item.doctor_id === doctor.id)
    .sort((a, b) => a.start_time.localeCompare(b.start_time));
  const appointments = result.db.appointments
    .filter((item) => item.doctor_id === doctor.id)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  const reviews = result.db.reviews.filter((item) => item.doctor_id === doctor.id);

  const patientIds = Array.from(new Set((appointments || []).map((item) => item.patient_id as string)));
  const slotIds = Array.from(new Set((appointments || []).map((item) => item.slot_id as string)));
  const symptomIds = Array.from(
    new Set((appointments || []).map((item) => item.symptom_id).filter(Boolean) as string[])
  );
  const appointmentIds = Array.from(new Set((appointments || []).map((item) => item.id as string)));

  const patients = result.db.users.filter((item) => patientIds.includes(item.id));
  const slotRows = result.db.doctor_slots.filter((item) => slotIds.includes(item.id));
  const symptomRows = result.db.symptoms.filter((item) => symptomIds.includes(item.id));
  const prescriptionRows = result.db.prescriptions.filter((item) => appointmentIds.includes(item.appointment_id));

  const patientById = new Map((patients || []).map((patient) => [patient.id as string, patient]));
  const slotById = new Map((slotRows || []).map((slot) => [slot.id as string, slot]));
  const symptomById = new Map((symptomRows || []).map((symptom) => [symptom.id as string, symptom]));
  const prescriptionsByAppointment = new Map((prescriptionRows || []).map((prescription) => [prescription.appointment_id as string, prescription]));

  const appointmentCards = await Promise.all(
    (appointments || []).map(async (appointment) => {
      const patient = patientById.get(appointment.patient_id as string);
      const slot = slotById.get(appointment.slot_id as string);
      const symptom = symptomById.get(appointment.symptom_id as string);
      const currentSymptom = decryptStoredSymptom((symptom?.description as string | null) || null);
      const summary = await fetchPatientHistorySummary(
        result.db,
        appointment.patient_id as string,
        currentSymptom
      );
      const prescriptionSuggestions = buildPrescriptionSuggestions(result.db, {
        patientId: appointment.patient_id as string,
        symptoms: currentSymptom,
        specialty: doctor.specialty
      });
      const prescription = prescriptionsByAppointment.get(appointment.id as string);
      const decryptedPrescription = prescription ? decryptPrescriptionFields(prescription) : null;
      const previousHistory = result.db.prescriptions
        .filter(
          (item) =>
            item.patient_id === appointment.patient_id &&
            item.appointment_id !== appointment.id
        )
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .map((item) => decryptPrescriptionFields(item));

      return {
        id: appointment.id,
        slotId: appointment.slot_id,
        patientName: String(patient?.name || "Patient"),
        patientPhoneMasked: maskPatientContact((patient?.phone as string | null) || null),
        status: appointment.status,
        slotStart: (slot?.start_time as string | null) || null,
        symptoms: currentSymptom,
        patientHistorySummary: summary,
        allergies: result.db.allergies
          .filter((item) => item.patient_id === appointment.patient_id)
          .sort((a, b) => b.created_at.localeCompare(a.created_at))
          .map((item) => ({
            allergen: item.allergen,
            reaction: item.reaction,
            severity: item.severity
          })),
        prescriptionSuggestions,
        prescription: decryptedPrescription,
        hasArrived: Boolean(appointment.patient_arrived_at),
        patientArrivedAt: appointment.patient_arrived_at,
        previousPrescriptions: appointment.patient_arrived_at ? previousHistory : []
      };
    })
  );

  const slotBoard = slots.map((slot) => {
    const appointment = appointmentCards.find((item) => item.slotId === slot.id);
    const clinic = clinics.find((item) => item?.id === slot.clinic_id) || null;
    return {
      id: slot.id,
      clinicId: slot.clinic_id,
      clinicName: clinic?.name || "Clinic",
      startTime: slot.start_time,
      endTime: slot.end_time,
      isBooked: Boolean(appointment),
      appointment
    };
  });

  return NextResponse.json({
    doctor: {
      ...doctor,
      name: result.profile.name
    },
    metrics: {
      clinicCount: (clinics || []).length,
      slotCount: (slots || []).length,
      averageRating:
        (reviews || []).length > 0
          ? Number(
              (
                (reviews || []).reduce((sum, review) => sum + Number(review.rating), 0) /
                (reviews || []).length
              ).toFixed(2)
            )
          : 0
    },
    clinics: clinics,
    slots: slots || [],
    slotBoard,
    appointments: appointmentCards
  });
}
