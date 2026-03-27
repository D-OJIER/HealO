import { createServiceClient } from "@/lib/supabase/service";
import type { Clinic, DoctorSlot } from "@/models/types";

export async function getDoctorIdByUserId(userId: string): Promise<string | null> {
  const client = createServiceClient();
  const { data } = await client.from("doctors").select("id").eq("user_id", userId).single();
  return data?.id ?? null;
}

export async function createClinic(args: {
  doctorId: string;
  name: string;
  locationLat: number;
  locationLng: number;
  address: string;
}): Promise<Clinic> {
  const client = createServiceClient();
  const { data, error } = await client
    .from("clinics")
    .insert({
      doctor_id: args.doctorId,
      name: args.name,
      location_lat: args.locationLat,
      location_lng: args.locationLng,
      address: args.address,
    })
    .select("*")
    .single();

  if (error || !data) throw new Error(error?.message ?? "Unable to create clinic.");
  return data as Clinic;
}

export async function listClinicsByDoctor(doctorId: string): Promise<Clinic[]> {
  const client = createServiceClient();
  const { data, error } = await client.from("clinics").select("*").eq("doctor_id", doctorId).order("created_at");
  if (error) throw new Error(error.message);
  return (data as Clinic[]) ?? [];
}

export async function createDoctorSlot(args: {
  doctorId: string;
  clinicId: string;
  startTime: string;
  endTime: string;
}): Promise<DoctorSlot> {
  const client = createServiceClient();
  const { data, error } = await client
    .from("doctor_slots")
    .insert({
      doctor_id: args.doctorId,
      clinic_id: args.clinicId,
      start_time: args.startTime,
      end_time: args.endTime,
      is_booked: false,
    })
    .select("*")
    .single();

  if (error || !data) throw new Error(error?.message ?? "Unable to create slot.");
  return data as DoctorSlot;
}

export async function listSlotsByDoctor(doctorId: string): Promise<DoctorSlot[]> {
  const client = createServiceClient();
  const { data, error } = await client
    .from("doctor_slots")
    .select("*")
    .eq("doctor_id", doctorId)
    .order("start_time", { ascending: true });
  if (error) throw new Error(error.message);
  return (data as DoctorSlot[]) ?? [];
}

