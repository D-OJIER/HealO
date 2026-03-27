import { NextResponse } from "next/server";
import { analyzeSymptoms } from "@/lib/ai/gemini";
import { getRecommendedDoctors } from "@/lib/ai/recommendation";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    symptom?: string;
    symptoms?: string;
    location?: { lat?: number; lng?: number };
  };
  const symptom = (body.symptom ?? body.symptoms ?? "").trim();

  if (!symptom) {
    return NextResponse.json({ error: "symptom is required." }, { status: 400 });
  }

  try {
    const triage = await analyzeSymptoms(symptom);
    const lat = body.location?.lat;
    const lng = body.location?.lng;
    const doctors = await getRecommendedDoctors({
      specialty: triage.specialty,
      location: typeof lat === "number" && typeof lng === "number" ? { lat, lng } : undefined,
    });

    return NextResponse.json({
      specialty: triage.specialty,
      urgency: triage.urgency,
      doctors,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI analysis failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
