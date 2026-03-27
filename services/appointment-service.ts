import { createServiceClient } from "@/lib/supabase/service";
import type { Appointment, AppointmentStatus, UserRole } from "@/models/types";

export async function createAppointment(args: {
  patientId: string;
  doctorId: string;
  clinicId: string;
  slotId: string;
}): Promise<Appointment> {
  const client = createServiceClient();

  const { data: slot, error: slotError } = await client
    .from("doctor_slots")
    .select("*")
    .eq("id", args.slotId)
    .eq("doctor_id", args.doctorId)
    .eq("clinic_id", args.clinicId)
    .single();

  if (slotError || !slot) throw new Error("Selected slot not found.");
  if (slot.is_booked) throw new Error("This slot is already booked.");

  const { data: updatedSlot, error: bookError } = await client
    .from("doctor_slots")
    .update({ is_booked: true })
    .eq("id", args.slotId)
    .eq("is_booked", false)
    .select("id")
    .maybeSingle();

  if (bookError) throw new Error(bookError.message);
  if (!updatedSlot?.id) throw new Error("This slot is already booked.");

  const { data, error } = await client
    .from("appointments")
    .insert({
      patient_id: args.patientId,
      doctor_id: args.doctorId,
      clinic_id: args.clinicId,
      slot_id: args.slotId,
      time: slot.start_time,
      status: "booked",
    })
    .select("*")
    .single();

  if (error || !data) {
    await client.from("doctor_slots").update({ is_booked: false }).eq("id", args.slotId);
    const message = error?.message ?? "Could not create appointment.";
    if (message.toLowerCase().includes("uniq_appointments_doctor_time")) {
      throw new Error("This time slot is already booked.");
    }
    throw new Error(message);
  }

  return data as Appointment;
}

export async function getAppointmentsByRole(args: {
  role: UserRole;
  userId: string;
}): Promise<Appointment[]> {
  const client = createServiceClient();
  let query = client
    .from("appointments")
    .select("*, doctors(*, users(*)), clinics(*), patient:users!appointments_patient_id_fkey(*)")
    .order("time", { ascending: true });

  if (args.role === "patient") {
    query = query.eq("patient_id", args.userId);
  } else {
    const { data: doctorRow, error: doctorError } = await client
      .from("doctors")
      .select("id")
      .eq("user_id", args.userId)
      .single();

    if (doctorError || !doctorRow) {
      return [];
    }

    query = query.eq("doctor_id", doctorRow.id);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message);
  }

  return (data as Appointment[]) ?? [];
}

export async function updateAppointmentStatus(args: {
  appointmentId: string;
  status: AppointmentStatus;
  notes?: string | null;
}): Promise<Appointment> {
  const client = createServiceClient();
  const { data, error } = await client
    .from("appointments")
    .update({ status: args.status, notes: args.notes ?? undefined })
    .eq("id", args.appointmentId)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Unable to update appointment.");
  }

  return data as Appointment;
}
