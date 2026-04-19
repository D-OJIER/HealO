import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { fetchDoctorRecommendations } from "@/lib/data";
import { makeId, updateDb } from "@/lib/local-db";
import { encryptPHI } from "@/lib/security";
import type { Coordinates } from "@/lib/types";

export async function POST(request: Request) {
  const result = await requireRole("patient");
  if (!result.ok) {
    return result.response;
  }

  const { symptoms, lat, lng } = await request.json();
  const patientLocation: Coordinates | null =
    typeof lat === "number" && typeof lng === "number" ? { lat, lng } : null;

  const symptomId = makeId("symptom");
  updateDb((db) => {
    db.symptoms.push({
      id: symptomId,
      patient_id: result.profile.id,
      description: encryptPHI(symptoms),
      created_at: new Date().toISOString()
    });
  });

  const recommendation = await fetchDoctorRecommendations(result.db, {
    patientLocation,
    symptoms
  });

  return NextResponse.json({
    ...recommendation,
    symptomId
  });
}
