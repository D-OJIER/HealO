import { GoogleGenAI } from "@google/genai";
import { decryptJson, tryDecryptPHI } from "@/lib/security";
import { getGeminiApiKey, getGeminiModel } from "@/lib/env";
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

function getAiClient() {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    return null;
  }

  return new GoogleGenAI({ apiKey });
}

async function geminiJson<T>(systemPrompt: string, userPrompt: string, fallback: T) {
  const ai = getAiClient();
  if (!ai) {
    return fallback;
  }

  try {
    const response = await ai.models.generateContent({
      model: getGeminiModel(),
      config: {
        temperature: 0.2,
        systemInstruction: systemPrompt
      },
      contents: userPrompt
    });
    const content = response.text?.trim();
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

  return geminiJson<SymptomAnalysis>(
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

  const result = await geminiJson<{ summary: string }>(
    "You are a medical summarization assistant for clinicians. Return strict JSON with one key named summary. Write one short paragraph summarizing the patient's previous prescriptions and current symptoms. Do not invent facts.",
    JSON.stringify(input),
    fallback
  );

  return result.summary;
}

export async function verifyAiConnection() {
  const ai = getAiClient();
  if (!ai) {
    return {
      ok: false,
      provider: "gemini",
      reason: "Missing GEMINI_API_KEY."
    };
  }

  try {
    const response = await ai.models.generateContent({
      model: getGeminiModel(),
      contents: "Reply with exactly the word OK."
    });

    return {
      ok: /ok/i.test(response.text || ""),
      provider: "gemini",
      model: getGeminiModel()
    };
  } catch (error) {
    return {
      ok: false,
      provider: "gemini",
      model: getGeminiModel(),
      reason: error instanceof Error ? error.message : "Unknown Gemini error."
    };
  }
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
