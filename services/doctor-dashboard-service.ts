import { createServiceClient } from "@/lib/supabase/service";
import type { Appointment, Prescription } from "@/models/types";

export async function getDoctorDecisionSupport(args: { userId: string }): Promise<{
  pastAppointments: Appointment[];
  recentPrescriptions: Prescription[];
}> {
  const client = createServiceClient();

  const { data: doctorRow } = await client.from("doctors").select("id").eq("user_id", args.userId).single();
  if (!doctorRow?.id) {
    return { pastAppointments: [], recentPrescriptions: [] };
  }

  const { data: pastAppointments } = await client
    .from("appointments")
    .select("*, patient:users!appointments_patient_id_fkey(*)")
    .eq("doctor_id", doctorRow.id)
    .order("time", { ascending: false })
    .limit(10);

  const { data: recentPrescriptions } = await client
    .from("prescriptions")
    .select("*")
    .eq("doctor_id", doctorRow.id)
    .order("created_at", { ascending: false })
    .limit(10);

  return {
    pastAppointments: (pastAppointments as Appointment[]) ?? [],
    recentPrescriptions: (recentPrescriptions as Prescription[]) ?? [],
  };
}

