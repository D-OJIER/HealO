import { triageSymptoms } from "@/ai/triage";
import type { TriageResult } from "@/models/types";

export function runTriage(symptoms: string): TriageResult {
  return triageSymptoms(symptoms);
}
