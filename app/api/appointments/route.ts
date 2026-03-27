import { NextResponse } from "next/server";
import { getApiUserProfile } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { createAppointment, getAppointmentsByRole, updateAppointmentStatus } from "@/services/appointment-service";

export async function POST(request: Request) {
  try {
    const user = await getApiUserProfile();
    if (!user || user.role !== "patient") {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const body = (await request.json()) as { doctorId?: string; clinicId?: string; slotId?: string };
    if (!body.doctorId || !body.clinicId || !body.slotId) {
      return NextResponse.json({ error: "doctorId, clinicId, and slotId are required." }, { status: 400 });
    }

    const appointment = await createAppointment({
      patientId: user.id,
      doctorId: body.doctorId,
      clinicId: body.clinicId,
      slotId: body.slotId,
    });

    return NextResponse.json(appointment, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create appointment.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const user = await getApiUserProfile();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const appointments = await getAppointmentsByRole({
      role: user.role,
      userId: user.id,
    });

    return NextResponse.json(appointments);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load appointments.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await getApiUserProfile();
    if (!user || user.role !== "doctor") {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const body = (await request.json()) as {
      appointmentId?: string;
      status?: "ongoing" | "completed";
      notes?: string;
    };

    if (!body.appointmentId || !body.status) {
      return NextResponse.json({ error: "appointmentId and status are required." }, { status: 400 });
    }

    const client = createServiceClient();
    const { data: doctorRow } = await client.from("doctors").select("id").eq("user_id", user.id).single();
    if (!doctorRow?.id) {
      return NextResponse.json({ error: "Doctor profile not found." }, { status: 400 });
    }

    const { data: appt } = await client
      .from("appointments")
      .select("id, doctor_id")
      .eq("id", body.appointmentId)
      .single();

    if (!appt) {
      return NextResponse.json({ error: "Appointment not found." }, { status: 404 });
    }

    if (appt.doctor_id !== doctorRow.id) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const updated = await updateAppointmentStatus({
      appointmentId: body.appointmentId,
      status: body.status,
      notes: body.notes ?? null,
    });

    return NextResponse.json(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update appointment.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
