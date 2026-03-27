import { createServiceClient } from "@/lib/supabase/service";
import type { Doctor } from "@/models/types";
import { haversineKm } from "@/utils/geo";

function hasAvailability(doctor: Doctor) {
  return Boolean(doctor.clinics?.some((clinic) => (clinic.doctor_slots ?? []).some((slot) => !slot.is_booked)));
}

export async function getRecommendedDoctors(args: {
  specialty: string;
  location?: { lat: number; lng: number };
}): Promise<Doctor[]> {
  const client = createServiceClient();

  const primary = await client
    .from("doctors")
    .select("*, users(*), clinics(*, doctor_slots(*))")
    .ilike("specialty", args.specialty)
    .order("rating", { ascending: false });

  if (primary.error) throw new Error(primary.error.message);
  let data = primary.data ?? [];

  if (!data || data.length === 0) {
    const fallback = await client.from("doctors").select("*, users(*), clinics(*, doctor_slots(*))").order("rating", {
      ascending: false,
    });
    data = fallback.data ?? [];
    if (fallback.error) throw new Error(fallback.error.message);
  }

  const now = Date.now();
  const doctors = ((data as Doctor[]) ?? []).map((d) => {
    const clinics = (d.clinics ?? []).map((clinic) => {
      const nextSlots = (clinic.doctor_slots ?? [])
        .filter((slot) => !slot.is_booked && new Date(slot.start_time).getTime() > now)
        .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
      const distance =
        args.location && typeof clinic.location_lat === "number" && typeof clinic.location_lng === "number"
          ? haversineKm(args.location, { lat: clinic.location_lat, lng: clinic.location_lng })
          : Number.POSITIVE_INFINITY;
      return {
        ...clinic,
        distance_km: distance,
        doctor_slots: nextSlots.slice(0, 8),
      };
    });

    const sortedClinics = clinics.sort((a, b) => (a.distance_km ?? Infinity) - (b.distance_km ?? Infinity));
    const nearestDistance = sortedClinics[0]?.distance_km ?? Number.POSITIVE_INFINITY;
    const nextAvailable = sortedClinics.flatMap((c) => c.doctor_slots ?? [])[0]?.start_time ?? null;
    return {
      ...d,
      clinics: sortedClinics,
      distance_km: nearestDistance,
      next_available_slot: nextAvailable,
      available_slots: [],
    };
  });

  doctors.sort((a, b) => {
    const distDiff = (a.distance_km ?? Number.POSITIVE_INFINITY) - (b.distance_km ?? Number.POSITIVE_INFINITY);
    if (distDiff !== 0) return distDiff;
    const ratingDiff = (b.rating ?? 0) - (a.rating ?? 0);
    if (ratingDiff !== 0) return ratingDiff;
    return Number(hasAvailability(b)) - Number(hasAvailability(a));
  });

  return doctors.filter((doctor) => doctor.clinics?.some((clinic) => (clinic.doctor_slots ?? []).length > 0)).slice(0, 3);
}

