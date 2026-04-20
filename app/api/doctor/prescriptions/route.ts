import { NextResponse } from "next/server";
import { requireVerifiedDoctor } from "@/lib/auth";
import { findMedicationAllergyConflicts, normalizeMedicationItem, parseMedicationLines } from "@/lib/data";
import { makeId, updateDb } from "@/lib/local-db";
import { encryptJson, encryptPHI } from "@/lib/security";
import type { MedicationItem } from "@/lib/types";

export async function POST(request: Request) {
  const result = await requireVerifiedDoctor();
  if (!result.ok) {
    return result.response;
  }

  const { appointmentId, diagnosis, doctorNotes, medicationsText, medications } = await request.json();
  const normalizedMedications: MedicationItem[] = Array.isArray(medications) && medications.length
    ? medications.map(normalizeMedicationItem).filter((item) => item.name && item.dosage)
    : parseMedicationLines(medicationsText || "");

  const appointment = result.db.appointments.find(
    (item) => item.id === appointmentId && item.doctor_id === result.doctor.id
  );
  if (!appointment) {
    return NextResponse.json({ error: "Appointment not found." }, { status: 404 });
  }

  if (appointment.status !== "accepted" && appointment.status !== "completed") {
    return NextResponse.json({ error: "Only accepted appointments can receive prescriptions." }, { status: 400 });
  }

  const allergyConflicts = findMedicationAllergyConflicts(result.db, appointment.patient_id, normalizedMedications);
  if (allergyConflicts.length) {
    return NextResponse.json({
      error: `Blocked by recorded allergy: ${allergyConflicts
          .map((item) => `${item.medicationName} vs ${item.allergen} (${item.reaction})`)
        .join(", ")}.`
    }, { status: 400 });
  }

  updateDb((db) => {
    db.prescriptions.push({
      id: makeId("prescription"),
      appointment_id: appointment.id,
      doctor_id: result.doctor.id,
      patient_id: appointment.patient_id,
      diagnosis: encryptPHI(diagnosis),
      doctor_notes: encryptPHI(doctorNotes || ""),
      medications: {
        ciphertext: encryptJson(normalizedMedications)
      },
      created_at: new Date().toISOString()
    });

    if (normalizedMedications.length) {
      db.medication_reminders.push(
        ...normalizedMedications.map((item) => ({
          id: makeId("reminder"),
          patient_id: appointment.patient_id,
          medication_name: `${item.name}${item.dosage ? ` (${item.dosage})` : ""}`,
          schedule: item.schedule || "",
          enabled: true,
          created_at: new Date().toISOString()
        }))
      );
    }
  });

  return NextResponse.json({ message: "Encrypted prescription stored and reminders created." });
}
