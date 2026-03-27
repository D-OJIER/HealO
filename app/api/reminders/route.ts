import { NextResponse } from "next/server";
import { getApiUserProfile } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";

export async function GET() {
  try {
    const user = await getApiUserProfile();
    if (!user || user.role !== "patient") {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const client = createServiceClient();
    const { data, error } = await client
      .from("medication_reminders")
      .select("*")
      .eq("patient_id", user.id)
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data ?? []);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load reminders.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getApiUserProfile();
    if (!user || user.role !== "patient") {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const body = (await request.json()) as { medicationName?: string; schedule?: string };
    if (!body.medicationName || !body.schedule) {
      return NextResponse.json({ error: "medicationName and schedule are required." }, { status: 400 });
    }

    const client = createServiceClient();
    const { data, error } = await client
      .from("medication_reminders")
      .insert({
        patient_id: user.id,
        medication_name: body.medicationName,
        schedule: body.schedule,
        enabled: true,
      })
      .select("*")
      .single();

    if (error || !data) {
      return NextResponse.json({ error: error?.message ?? "Failed to create reminder." }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create reminder.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

