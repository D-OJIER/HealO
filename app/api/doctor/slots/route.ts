import { NextResponse } from "next/server";
import { getApiUserProfile } from "@/lib/auth";
import { createDoctorSlot, getDoctorIdByUserId, listSlotsByDoctor } from "@/services/clinic-service";

export async function GET() {
  const user = await getApiUserProfile();
  if (!user || user.role !== "doctor") {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const doctorId = await getDoctorIdByUserId(user.id);
  if (!doctorId) return NextResponse.json([]);

  const slots = await listSlotsByDoctor(doctorId);
  return NextResponse.json(slots);
}

export async function POST(request: Request) {
  const user = await getApiUserProfile();
  if (!user || user.role !== "doctor") {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const doctorId = await getDoctorIdByUserId(user.id);
  if (!doctorId) return NextResponse.json({ error: "Doctor profile not found." }, { status: 400 });

  const body = (await request.json()) as {
    clinicId?: string;
    startTime?: string;
    endTime?: string;
  };

  if (!body.clinicId || !body.startTime || !body.endTime) {
    return NextResponse.json({ error: "clinicId, startTime, and endTime are required." }, { status: 400 });
  }

  const slot = await createDoctorSlot({
    doctorId,
    clinicId: body.clinicId,
    startTime: body.startTime,
    endTime: body.endTime,
  });
  return NextResponse.json(slot, { status: 201 });
}

