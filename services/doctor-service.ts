import { createServiceClient } from "@/lib/supabase/service";
import type { Doctor } from "@/models/types";

export async function getDoctorsBySpecialty(specialty?: string): Promise<Doctor[]> {
  const client = createServiceClient();

  let query = client
    .from("doctors")
    .select("*, users(*), clinics(*, doctor_slots(*))")
    .order("rating", { ascending: false });

  if (specialty && specialty !== "General") {
    query = query.ilike("specialty", specialty);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  const now = Date.now();
  return ((data as Doctor[]) ?? []).map((doctor) => {
    const clinics = (doctor.clinics ?? []).map((clinic) => ({
      ...clinic,
      doctor_slots: (clinic.doctor_slots ?? [])
        .filter((slot) => !slot.is_booked && new Date(slot.start_time).getTime() > now)
        .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()),
    }));
    const nextAvailable = clinics.flatMap((clinic) => clinic.doctor_slots ?? [])[0]?.start_time ?? null;
    return { ...doctor, clinics, next_available_slot: nextAvailable };
  });
}
