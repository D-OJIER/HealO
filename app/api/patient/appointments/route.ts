import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { makeId, updateDb } from "@/lib/local-db";
import { encryptPHI } from "@/lib/security";

export async function POST(request: Request) {
  const result = await requireRole("patient");
  if (!result.ok) {
    return result.response;
  }

  const { slotId, symptoms, symptomId } = await request.json();

  const slot = result.db.doctor_slots.find((item) => item.id === slotId);
  if (!slot) {
    return NextResponse.json({ error: "Slot not found." }, { status: 404 });
  }

  const activeAppointment = result.db.appointments.find(
    (item) => item.slot_id === slotId && (item.status === "pending" || item.status === "accepted")
  );
  if (activeAppointment) {
    return NextResponse.json({ error: "This slot has already been claimed." }, { status: 409 });
  }

  updateDb((db) => {
    let activeSymptomId = symptomId as string | undefined;
    if (!activeSymptomId && symptoms) {
      activeSymptomId = makeId("symptom");
      db.symptoms.push({
        id: activeSymptomId,
        patient_id: result.profile.id,
        description: encryptPHI(symptoms),
        created_at: new Date().toISOString()
      });
    }

    db.appointments.push({
      id: makeId("appointment"),
      patient_id: result.profile.id,
      doctor_id: slot.doctor_id,
      slot_id: slot.id,
      clinic_id: slot.clinic_id,
      symptom_id: activeSymptomId || null,
      status: "pending",
      patient_arrived_at: null,
      created_at: new Date().toISOString()
    });
  });

  return NextResponse.json({ message: "Appointment request submitted for doctor approval." });
}
