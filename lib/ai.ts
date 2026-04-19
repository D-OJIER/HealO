import { decryptJson, tryDecryptPHI } from "@/lib/security";
import { getXaiApiKey, getXaiBaseUrl, getXaiModel } from "@/lib/env";
import type { DoctorRecommendation, MedicationItem } from "@/lib/types";

type SymptomAnalysis = {
  specialty: string;
  rationale: string;
  urgency: "low" | "medium" | "high";
  doctorReasoning: string;
};

function extractJson<T>(content: string) {
  const sanitized = content
    .replace(/```json/gi, "```")
    .replace(/```/g, "")
    .trim();
  const match = sanitized.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error("No JSON object returned from AI.");
  }

  return JSON.parse(match[0]) as T;
}

function extractContentText(content: unknown) {
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") {
          return part;
        }
        if (part && typeof part === "object") {
          const record = part as Record<string, unknown>;
          if (typeof record.text === "string") {
            return record.text;
          }
        }
        return "";
      })
      .join("\n")
      .trim();
  }

  return "";
}

async function grokJson<T>(systemPrompt: string, userPrompt: string, fallback: T) {
  const apiKey = getXaiApiKey();
  if (!apiKey) {
    return fallback;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const response = await fetch(`${getXaiBaseUrl()}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: getXaiModel(),
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ]
      }),
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (!response.ok) {
      return fallback;
    }

    const data = await response.json();
    const content = extractContentText(data.choices?.[0]?.message?.content);
    if (!content) {
      return fallback;
    }

    return extractJson<T>(content);
  } catch {
    return fallback;
  }
}

export async function analyzeSymptomsWithAi(symptoms: string) {
  const fallback: SymptomAnalysis = {
    specialty: /rash|skin|itch|acne/i.test(symptoms)
      ? "Dermatology"
      : /chest|heart|palpit|pressure/i.test(symptoms)
        ? "Cardiology"
        : /joint|knee|back pain|sprain/i.test(symptoms)
          ? "Orthopedics"
          : "General Medicine",
    rationale: "Local fallback analysis matched the symptom pattern to the closest specialty.",
    urgency: /severe|bleeding|breathless|fainted/i.test(symptoms) ? "high" : "medium",
    doctorReasoning: "Verified doctors are ranked by specialty fit, rating, and distance."
  };

  return grokJson<SymptomAnalysis>(
    "You are a clinical triage assistant. Return strict JSON with keys specialty, rationale, urgency, doctorReasoning. Never diagnose definitively. Keep rationale concise and safe.",
    `Patient symptoms: ${symptoms}`,
    fallback
  );
}

export async function summarizePatientHistoryWithAi(input: {
  symptoms: string[];
  prescriptions: Array<{ diagnosis: string; medications: MedicationItem[]; notes: string }>;
}) {
  const fallback = {
    summary: input.symptoms.length || input.prescriptions.length
      ? `The patient reports ${input.symptoms.slice(0, 2).join("; ") || "no current symptoms recorded"}. Previous prescription history suggests ${input.prescriptions
          .slice(0, 2)
          .map((entry) => entry.diagnosis)
          .join("; ") || "limited prior treatment history"}.`
      : "New patient with limited historical data."
  };

  const result = await grokJson<{ summary: string }>(
    "You are a medical summarization assistant for clinicians. Return strict JSON with one key named summary. Write one short paragraph summarizing the patient's previous prescriptions and current symptoms. Do not invent facts.",
    JSON.stringify(input),
    fallback
  );

  return result.summary;
}

export function decryptMedicationPayload(payload: unknown) {
  if (!payload || typeof payload !== "object" || !("ciphertext" in payload)) {
    return [] as MedicationItem[];
  }

  try {
    return decryptJson<MedicationItem[]>((payload as { ciphertext: string }).ciphertext);
  } catch {
    return [];
  }
}

export function explainDoctorRecommendation(input: {
  doctor: DoctorRecommendation;
  specialty: string;
  aiReasoning: string;
}) {
  const reasons = [
    input.doctor.specialty === input.specialty ? `specialty matches ${input.specialty}` : "verified clinician",
    input.doctor.reviewCount ? `weighted rating ${input.doctor.weightedRating.toFixed(1)}` : "new profile weighted against network average"
  ];

  if (input.doctor.distanceKm !== null) {
    reasons.push(`${input.doctor.distanceKm.toFixed(1)} km away`);
  }

  reasons.push(input.aiReasoning);

  return reasons.join(", ");
}

export function decryptHistoryRows(rows: Array<{ description?: string | null; diagnosis?: string | null; doctor_notes?: string | null; medications?: unknown }>) {
  return rows.map((row) => ({
    symptom: tryDecryptPHI(row.description),
    diagnosis: tryDecryptPHI(row.diagnosis),
    notes: tryDecryptPHI(row.doctor_notes),
    medications: decryptMedicationPayload(row.medications)
  }));
}
