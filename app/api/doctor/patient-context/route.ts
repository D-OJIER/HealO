import { NextResponse } from "next/server";
import { getApiUserProfile } from "@/lib/auth";
import { getDoctorIdByUserId } from "@/services/clinic-service";
import { getPatientContext } from "@/services/patient-context-service";

export async function GET(request: Request) {
  const user = await getApiUserProfile();
  if (!user || user.role !== "doctor") {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const url = new URL(request.url);
  const patientId = url.searchParams.get("patientId");
  if (!patientId) {
    return NextResponse.json({ error: "patientId is required." }, { status: 400 });
  }

  const doctorId = await getDoctorIdByUserId(user.id);
  if (!doctorId) return NextResponse.json({ error: "Doctor profile not found." }, { status: 400 });

  const data = await getPatientContext({ doctorId, patientId });
  return NextResponse.json(data);
}

