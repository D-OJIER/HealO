import { createServiceClient } from "@/lib/supabase/service";

export async function generatePatientSummary(patientId: string): Promise<string> {
  const client = createServiceClient();

  const [{ data: history }, { data: appointments }] = await Promise.all([
    client
      .from("medical_history")
      .select("diagnosis, created_at")
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false })
      .limit(50),
    client.from("appointments").select("id, status").eq("patient_id", patientId),
  ]);

  const entries = history ?? [];
  const visits = (appointments ?? []).length;
  const completed = (appointments ?? []).filter((a) => a.status === "completed").length;

  const freq = new Map<string, number>();
  for (const row of entries) {
    const key = String(row.diagnosis ?? "Unknown");
    freq.set(key, (freq.get(key) ?? 0) + 1);
  }

  const topPatterns = Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([d, c]) => `${d} (${c})`);

  if (!visits) {
    return "No prior visits recorded.";
  }

  const baseline = `Visits: ${visits} total (${completed} completed). Top diagnosis patterns: ${
    topPatterns.length ? topPatterns.join(", ") : "No diagnosis entries yet"
  }.`;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return baseline;
  }

  try {
    const prompt = `You are a clinical assistant creating a concise patient summary for a doctor.
Return plain text only in 3-5 bullet-like sentences.
Include:
- visit frequency
- likely recurring patterns from diagnoses
- continuity or escalation hints
- one practical follow-up suggestion

Patient summary inputs:
- total visits: ${visits}
- completed visits: ${completed}
- diagnosis frequencies: ${topPatterns.join(", ") || "none"}
- most recent diagnoses: ${entries
      .slice(0, 8)
      .map((e) => String(e.diagnosis ?? "Unknown"))
      .join(", ")}`;

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" +
        encodeURIComponent(apiKey),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 260 },
        }),
      },
    );

    if (!response.ok) {
      return baseline;
    }

    const data = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!text) {
      return baseline;
    }
    return text;
  } catch {
    return baseline;
  }
}

