import type { TriageResult } from "@/models/types";

// 🔍 Strong JSON extractor (handles messy AI output)
function extractJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {}

  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;

  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

export async function analyzeSymptoms(symptom: string): Promise<TriageResult> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY.");
  }

  // 🧠 Strong prompt (forces clean JSON)
  const prompt = `
You are a medical triage assistant.

STRICT RULES:
- Return ONLY valid JSON
- Do NOT include explanations
- Do NOT include markdown
- Do NOT include text before or after JSON

Format:
{"specialty":"...","urgency":"Low|Medium|High"}

Rules:
- chest pain → Cardiology, High
- skin issues → Dermatology, Low
- fever → General, Medium

Symptoms: ${symptom}
`;

  try {
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-goog-api-key": apiKey, // ✅ correct auth method
        },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 200,
            responseMimeType: "application/json",
          },
        }),
      }
    );

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`Gemini request failed (${response.status}): ${text}`);
    }

    const data = await response.json();

    const modelText =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    const parsed = extractJson(modelText) as Partial<TriageResult> | null;

    const specialty = parsed?.specialty?.trim();
    const urgency = parsed?.urgency;

    if (
      specialty &&
      (urgency === "Low" || urgency === "Medium" || urgency === "High")
    ) {
      return { specialty, urgency };
    }

    throw new Error("Invalid AI JSON");
  } catch (error) {
    console.warn("⚠️ Gemini failed, using fallback:", error);

    // 🛡️ Fallback logic (hybrid system)
    const lower = symptom.toLowerCase();

    if (lower.includes("chest")) {
      return { specialty: "Cardiology", urgency: "High" };
    }
    if (lower.includes("skin")) {
      return { specialty: "Dermatology", urgency: "Low" };
    }
    if (lower.includes("fever")) {
      return { specialty: "General", urgency: "Medium" };
    }

    return { specialty: "General", urgency: "Medium" };
  }
}