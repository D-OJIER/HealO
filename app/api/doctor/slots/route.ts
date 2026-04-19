import { NextResponse } from "next/server";
import { requireVerifiedDoctor } from "@/lib/auth";
import { makeId, updateDb } from "@/lib/local-db";

export async function POST(request: Request) {
  const result = await requireVerifiedDoctor();
  if (!result.ok) {
    return result.response;
  }

  const { clinicId, date, sessionStart, sessionEnd, slotMinutes, breakMinutes } = await request.json();
  const startAnchor = new Date(`${date}T${sessionStart}`);
  const endAnchor = new Date(`${date}T${sessionEnd}`);
  const slotLength = Number(slotMinutes);
  const gap = Number(breakMinutes || 0);

  const inserts: Array<{ id: string; doctor_id: string; clinic_id: string; start_time: string; end_time: string; created_at: string }> = [];
  let cursor = new Date(startAnchor);

  while (cursor.getTime() + slotLength * 60000 <= endAnchor.getTime()) {
    const slotEnd = new Date(cursor.getTime() + slotLength * 60000);
    inserts.push({
      id: makeId("slot"),
      doctor_id: result.doctor.id,
      clinic_id: clinicId,
      start_time: cursor.toISOString(),
      end_time: slotEnd.toISOString(),
      created_at: new Date().toISOString()
    });
    cursor = new Date(slotEnd.getTime() + gap * 60000);
  }

  if (!inserts.length) {
    return NextResponse.json({ error: "No slots generated with the selected timings." }, { status: 400 });
  }

  updateDb((db) => {
    db.doctor_slots.push(...inserts);
  });

  return NextResponse.json({ message: `${inserts.length} appointment slots created.` });
}
