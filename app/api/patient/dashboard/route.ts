import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { fetchDoctorRecommendations, decryptPrescriptionFields, decryptStoredSymptom } from "@/lib/data";
import { maskPhi } from "@/lib/security";
import type { Coordinates } from "@/lib/types";

function parseCoords(request: Request): Coordinates | null {
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");

  if (!lat || !lng) {
    return null;
  }

  return { lat: Number(lat), lng: Number(lng) };
}

export async function GET(request: Request) {
  try {
    const result = await requireRole("patient");
    if (!result.ok) {
      return result.response;
    }

    const patientLocation = parseCoords(request);
    const doctorDirectory = await fetchDoctorRecommendations(result.db, {
      patientLocation
    });

    const appointmentRows = result.db.appointments
      .filter((item) => item.patient_id === result.profile.id)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
    const prescriptionRows = result.db.prescriptions
      .filter((item) => item.patient_id === result.profile.id)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
    const reminderRows = result.db.medication_reminders
      .filter((item) => item.patient_id === result.profile.id)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));

    const doctorIds = Array.from(
      new Set([
        ...(appointmentRows || []).map((item) => item.doctor_id as string),
        ...(prescriptionRows || []).map((item) => item.doctor_id as string)
      ])
    );
    const slotIds = Array.from(new Set((appointmentRows || []).map((item) => item.slot_id as string)));
    const symptomIds = Array.from(
      new Set((appointmentRows || []).map((item) => item.symptom_id).filter(Boolean) as string[])
    );

    const doctorProfiles = result.db.doctors.filter((item) => doctorIds.includes(item.id));
    const slotRows = result.db.doctor_slots.filter((item) => slotIds.includes(item.id));
    const symptomRows = result.db.symptoms.filter((item) => symptomIds.includes(item.id));

    const doctorUserIds = new Map<string, string>();
    const doctorSpecialties = new Map<string, string>();
    for (const row of doctorProfiles || []) {
      doctorUserIds.set(row.id as string, row.user_id as string);
      doctorSpecialties.set(row.id as string, String(row.specialty || "General Medicine"));
    }

    const doctorUserProfileIds = Array.from(new Set(Array.from(doctorUserIds.values()).filter(Boolean)));
    const userProfiles = result.db.users.filter((item) => doctorUserProfileIds.includes(item.id));

    const doctorNames = new Map<string, string>();
    for (const row of userProfiles || []) {
      doctorNames.set(row.id as string, String(row.name));
    }

    const slotsById = new Map((slotRows || []).map((row) => [row.id as string, row]));
    const symptomsById = new Map((symptomRows || []).map((row) => [row.id as string, row]));

    return NextResponse.json({
      patient: {
        name: result.profile.name,
        emailMasked: maskPhi(result.profile.email),
        phoneMasked: maskPhi(result.profile.phone || "")
      },
      doctorDirectory,
      appointments: (appointmentRows || []).map((appointment) => {
        const slot = slotsById.get(appointment.slot_id as string);
        const symptom = symptomsById.get(appointment.symptom_id as string);
        const doctorUserId = doctorUserIds.get(appointment.doctor_id as string) || "";
        return {
          id: appointment.id,
          doctorName: doctorNames.get(doctorUserId) || "Doctor",
          specialty: doctorSpecialties.get(appointment.doctor_id as string) || "General Medicine",
          status: appointment.status,
          slotStart: slot?.start_time || null,
          symptoms: decryptStoredSymptom((symptom?.description as string | null) || null)
        };
      }),
      prescriptions: (prescriptionRows || []).map((prescription) => {
        const doctorUserId = doctorUserIds.get(prescription.doctor_id as string) || "";
        const decrypted = decryptPrescriptionFields(prescription);
        return {
          id: prescription.id,
          doctorName: doctorNames.get(doctorUserId) || "Doctor",
          diagnosis: decrypted.diagnosis,
          medications: decrypted.medications,
          notes: decrypted.notes
        };
      }),
      reminders: reminderRows || []
    });
  } catch (error) {
    console.error("Patient dashboard failed", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to load patient dashboard."
      },
      { status: 500 }
    );
  }
}
