import { NextResponse } from "next/server";
import { getApiUserProfile } from "@/lib/auth";
import { createClinic, getDoctorIdByUserId, listClinicsByDoctor } from "@/services/clinic-service";

export async function GET() {
  const user = await getApiUserProfile();
  if (!user || user.role !== "doctor") {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const doctorId = await getDoctorIdByUserId(user.id);
  if (!doctorId) return NextResponse.json([]);

  const clinics = await listClinicsByDoctor(doctorId);
  return NextResponse.json(clinics);
}

export async function POST(request: Request) {
  const user = await getApiUserProfile();
  if (!user || user.role !== "doctor") {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const doctorId = await getDoctorIdByUserId(user.id);
  if (!doctorId) return NextResponse.json({ error: "Doctor profile not found." }, { status: 400 });

  const body = (await request.json()) as {
    name?: string;
    locationLat?: number;
    locationLng?: number;
    address?: string;
  };

  if (!body.name || typeof body.locationLat !== "number" || typeof body.locationLng !== "number" || !body.address) {
    return NextResponse.json({ error: "name, locationLat, locationLng, and address are required." }, { status: 400 });
  }

  const clinic = await createClinic({
    doctorId,
    name: body.name,
    locationLat: body.locationLat,
    locationLng: body.locationLng,
    address: body.address,
  });

  return NextResponse.json(clinic, { status: 201 });
}

