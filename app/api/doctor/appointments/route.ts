import { NextResponse } from "next/server";
import { requireVerifiedDoctor } from "@/lib/auth";
import { updateDb } from "@/lib/local-db";

export async function POST(request: Request) {
  const result = await requireVerifiedDoctor();
  if (!result.ok) {
    return result.response;
  }

  const { appointmentId, status, markArrived } = await request.json();
  if (markArrived) {
    let updated = false;
    updateDb((db) => {
      const appointment = db.appointments.find(
        (item) => item.id === appointmentId && item.doctor_id === result.doctor.id
      );
      if (appointment) {
        appointment.patient_arrived_at = new Date().toISOString();
        if (appointment.status === "pending") {
          appointment.status = "accepted";
        }
        updated = true;
      }
    });

    if (!updated) {
      return NextResponse.json({ error: "Appointment not found." }, { status: 404 });
    }

    return NextResponse.json({ message: "Patient marked as arrived." });
  }

  const allowed = new Set(["accepted", "rejected", "completed", "cancelled"]);
  if (!allowed.has(status)) {
    return NextResponse.json({ error: "Invalid appointment status." }, { status: 400 });
  }

  let updated = false;
  updateDb((db) => {
    const appointment = db.appointments.find(
      (item) => item.id === appointmentId && item.doctor_id === result.doctor.id
    );
    if (appointment) {
      appointment.status = status;
      updated = true;
    }
  });

  if (!updated) {
    return NextResponse.json({ error: "Appointment not found." }, { status: 404 });
  }

  return NextResponse.json({ message: `Appointment ${status}.` });
}
