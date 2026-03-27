import { NextResponse } from "next/server";
import { getApiUserProfile } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";

export async function GET() {
  try {
    const user = await getApiUserProfile();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const client = createServiceClient();
    const query = `
      *,
      doctor:doctors(*, users(*)),
      patient:users!prescriptions_patient_id_fkey(*),
      appointment:appointments(*, clinic:clinics(*))
    `;
    if (user.role === "patient") {
      const { data, error } = await client
        .from("prescriptions")
        .select(query)
        .eq("patient_id", user.id)
        .order("created_at", { ascending: false });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json(data ?? []);
    }

    const { data: doctorRow } = await client.from("doctors").select("id").eq("user_id", user.id).single();
    if (!doctorRow?.id) return NextResponse.json([]);

    const { data, error } = await client
      .from("prescriptions")
      .select(query)
      .eq("doctor_id", doctorRow.id)
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data ?? []);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch prescriptions.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getApiUserProfile();
    if (!user || user.role !== "doctor") {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const body = (await request.json()) as {
      appointmentId?: string;
      doctorNotes?: string;
      medicines?: Array<{ name: string; dosage?: string; schedule?: string; instructions?: string }>;
    };

    if (!body.appointmentId || !body.doctorNotes || !body.medicines || body.medicines.length === 0) {
      return NextResponse.json(
        { error: "appointmentId, doctorNotes, and medicines are required." },
        { status: 400 },
      );
    }

    const client = createServiceClient();

    const { data: doctorRow, error: doctorErr } = await client
      .from("doctors")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (doctorErr || !doctorRow) {
      return NextResponse.json({ error: "Doctor profile not found." }, { status: 400 });
    }

    const { data: appt, error: apptErr } = await client
      .from("appointments")
      .select("id, patient_id, doctor_id")
      .eq("id", body.appointmentId)
      .single();

    if (apptErr || !appt) {
      return NextResponse.json({ error: "Appointment not found." }, { status: 404 });
    }

    if (appt.doctor_id !== doctorRow.id) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const { data, error } = await client
      .from("prescriptions")
      .insert({
        appointment_id: appt.id,
        doctor_id: doctorRow.id,
        patient_id: appt.patient_id,
        diagnosis: "Prescription",
        medications: [],
        doctor_notes: body.doctorNotes,
        medicines: body.medicines ?? [],
      })
      .select("*")
      .single();

    if (error || !data) {
      return NextResponse.json({ error: error?.message ?? "Failed to create prescription." }, { status: 500 });
    }

    const reminders = (body.medicines ?? []).map((m) => ({
      patient_id: appt.patient_id,
      medication_name: m.name,
      schedule: m.schedule ?? m.instructions ?? m.dosage ?? "As directed",
      enabled: true,
    }));

    if (reminders.length > 0) {
      await client.from("medication_reminders").insert(reminders);
    }

    await client.from("medical_history").insert({
      patient_id: appt.patient_id,
      doctor_id: doctorRow.id,
      diagnosis: "Consultation follow-up",
      notes: body.doctorNotes,
    });

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create prescription.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

