import type { TriageResult } from "@/models/types";

export function triageSymptoms(symptoms: string): TriageResult {
  const text = symptoms.toLowerCase();

  if (text.includes("chest pain")) {
    return { specialty: "Cardiology", urgency: "High" };
  }

  if (text.includes("skin")) {
    return { specialty: "Dermatology", urgency: "Low" };
  }

  return { specialty: "General", urgency: "Medium" };
}
