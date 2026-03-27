import { createServiceClient } from "@/lib/supabase/service";
import { generatePatientSummary } from "@/lib/ai/patient-summary";
import type { Appointment, MedicalHistoryEntry, Prescription } from "@/models/types";

export async function getPatientContext(args: { doctorId: string; patientId: string }) {
  const client = createServiceClient();

  const [appointmentsRes, prescriptionsRes, historyRes] = await Promise.all([
    client
      .from("appointments")
      .select("*, clinics(*)")
      .eq("doctor_id", args.doctorId)
      .eq("patient_id", args.patientId)
      .order("time", { ascending: false })
      .limit(20),
    client
      .from("prescriptions")
      .select("*")
      .eq("doctor_id", args.doctorId)
      .eq("patient_id", args.patientId)
      .order("created_at", { ascending: false })
      .limit(20),
    client
      .from("medical_history")
      .select("*")
      .eq("doctor_id", args.doctorId)
      .eq("patient_id", args.patientId)
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  const summary = await generatePatientSummary(args.patientId);

  return {
    summary,
    appointments: (appointmentsRes.data as Appointment[]) ?? [],
    prescriptions: (prescriptionsRes.data as Prescription[]) ?? [],
    history: (historyRes.data as MedicalHistoryEntry[]) ?? [],
  };
}

