import { NextResponse } from "next/server";
import { requireVerifiedDoctor } from "@/lib/auth";
import { makeId, updateDb } from "@/lib/local-db";

export async function POST(request: Request) {
  const result = await requireVerifiedDoctor();
  if (!result.ok) {
    return result.response;
  }

  const { name, address, latitude, longitude } = await request.json();
  const clinicId = makeId("clinic");
  updateDb((db) => {
    db.clinics.push({
      id: clinicId,
      name,
      address,
      location_lat: Number(latitude),
      location_lng: Number(longitude),
      created_at: new Date().toISOString()
    });
    db.doctor_clinics.push({
      doctor_id: result.doctor.id,
      clinic_id: clinicId
    });
  });

  return NextResponse.json({ message: "Clinic added successfully." });
}
