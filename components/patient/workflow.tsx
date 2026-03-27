"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type {
  Appointment,
  Clinic,
  Doctor,
  DoctorSlot,
  MedicationReminder,
  Prescription,
  PrescriptionMedicine,
  TriageResult,
} from "@/models/types";
import { formatDateTime } from "@/utils/format";

const DoctorMap = dynamic(() => import("@/components/map/doctor-map").then((m) => m.DoctorMap), {
  ssr: false,
  loading: () => <div className="h-[420px] animate-pulse rounded-2xl bg-zinc-200" />,
});

export function PatientWorkflow({ allDoctors }: { allDoctors: Doctor[] }) {
  const supabase = useMemo(() => createClient(), []);
  const [symptoms, setSymptoms] = useState("");
  const [triage, setTriage] = useState<TriageResult | null>(null);
  const [loading, setLoading] = useState<string>("");
  const [locationLoading, setLocationLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [manualLocation, setManualLocation] = useState({ lat: "", lng: "" });
  const [recommendedDoctors, setRecommendedDoctors] = useState<Doctor[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string | null>(null);
  const [selectedClinicId, setSelectedClinicId] = useState<string | null>(null);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [selectedPrescription, setSelectedPrescription] = useState<Prescription | null>(null);
  const [reminders, setReminders] = useState<MedicationReminder[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [routeInfo, setRouteInfo] = useState<{
    coordinates: Array<[number, number]>;
    distanceKm: number;
    durationMin: number;
  } | null>(null);
  const cacheRef = useRef<Map<string, Doctor[]>>(new Map());
  const debounceRef = useRef<number | null>(null);

  const withToken = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token ?? "";
  }, [supabase]);

  const refreshPatientData = useCallback(async () => {
    const token = await withToken();
    const [apptRes, rxRes, remRes] = await Promise.all([
      fetch("/api/appointments", { headers: { Authorization: `Bearer ${token}` } }),
      fetch("/api/prescription", { headers: { Authorization: `Bearer ${token}` } }),
      fetch("/api/reminders", { headers: { Authorization: `Bearer ${token}` } }),
    ]);

    if (apptRes.ok) setAppointments((await apptRes.json()) as Appointment[]);
    if (rxRes.ok) setPrescriptions((await rxRes.json()) as Prescription[]);
    if (remRes.ok) setReminders((await remRes.json()) as MedicationReminder[]);
  }, [withToken]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refreshPatientData();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [refreshPatientData]);

  useEffect(() => {
    if (!navigator.geolocation) {
      const timer = window.setTimeout(() => {
        setLocationLoading(false);
        setMessage("Geolocation is not supported by your browser.");
      }, 0);
      return () => window.clearTimeout(timer);
    }

    const initialTimer = window.setTimeout(() => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          setLocationLoading(false);
        },
        () => {
          setMessage("Location permission denied. You can still book manually.");
          setLocationLoading(false);
        },
        { enableHighAccuracy: true, timeout: 10000 },
      );
    }, 0);

    const watchId = navigator.geolocation.watchPosition(
      (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {},
      { enableHighAccuracy: true, maximumAge: 8000 },
    );

    return () => {
      window.clearTimeout(initialTimer);
      navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  const analyzeSymptoms = async (nextSymptoms: string) => {
    const text = nextSymptoms.trim();
    if (text.length < 3) return;

    setMessage(null);
    const cacheKey = `${text.toLowerCase()}::${userLocation?.lat ?? "na"}::${userLocation?.lng ?? "na"}`;
    if (cacheRef.current.has(cacheKey)) {
      const cached = cacheRef.current.get(cacheKey) ?? [];
      setRecommendedDoctors(cached);
      if (!selectedDoctorId && cached[0]) setSelectedDoctorId(cached[0].id);
      return;
    }

    setLoading("Analyzing symptoms...");
    const token = await withToken();
    const res = await fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ symptom: text, location: userLocation ?? undefined }),
    });
    const data = (await res.json()) as { error?: string } | (TriageResult & { doctors: Doctor[] });
    if (!res.ok) {
      setLoading("");
      setMessage((data as { error?: string }).error ?? "AI failed.");
      return;
    }

    const ok = data as TriageResult & { doctors: Doctor[] };
    setTriage({ specialty: ok.specialty, urgency: ok.urgency });
    setLoading("Finding nearby doctors...");
    const doctors = ok.doctors ?? [];
    setRecommendedDoctors(doctors);
    cacheRef.current.set(cacheKey, doctors);
    if (doctors.length === 0) {
      setMessage("No exact specialty match found. Showing all available doctors.");
      setSelectedDoctorId(allDoctors[0]?.id ?? null);
    } else {
      setSelectedDoctorId(doctors[0]?.id ?? null);
    }
    setLoading("");
  };

  const onSymptomsChange = (value: string) => {
    setSymptoms(value);
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      void analyzeSymptoms(value);
    }, 600);
  };

  const searchClosestDoctors = async () => {
    if (!symptoms.trim()) {
      setMessage("Enter symptoms first, then search.");
      return;
    }
    await analyzeSymptoms(symptoms);
  };

  useEffect(() => {
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, []);

  const visibleDoctors = recommendedDoctors.length ? recommendedDoctors : allDoctors;

  useEffect(() => {
    const selectedDoctor = visibleDoctors.find((doctor) => doctor.id === selectedDoctorId);
    if (!selectedDoctor) {
      const timer = window.setTimeout(() => {
        setSelectedClinicId(null);
        setSelectedSlotId(null);
      }, 0);
      return () => window.clearTimeout(timer);
    }

    const doctorClinics = selectedDoctor.clinics ?? [];
    if (doctorClinics.length === 0) {
      const timer = window.setTimeout(() => {
        setSelectedClinicId(null);
        setSelectedSlotId(null);
      }, 0);
      return () => window.clearTimeout(timer);
    }

    if (!selectedClinicId || !doctorClinics.some((clinic) => clinic.id === selectedClinicId)) {
      const firstClinic = doctorClinics[0];
      const timer = window.setTimeout(() => {
        setSelectedClinicId(firstClinic.id);
        setSelectedSlotId(firstClinic.doctor_slots?.[0]?.id ?? null);
      }, 0);
      return () => window.clearTimeout(timer);
    }

    const activeClinic = doctorClinics.find((clinic) => clinic.id === selectedClinicId);
    if (activeClinic && (!selectedSlotId || !activeClinic.doctor_slots?.some((slot) => slot.id === selectedSlotId))) {
      const timer = window.setTimeout(() => {
        setSelectedSlotId(activeClinic.doctor_slots?.[0]?.id ?? null);
      }, 0);
      return () => window.clearTimeout(timer);
    }

    return;
  }, [selectedClinicId, selectedDoctorId, selectedSlotId, visibleDoctors]);

  useEffect(() => {
    const loadRoute = async () => {
      if (!userLocation || !selectedClinicId) {
        setRouteInfo(null);
        return;
      }
      const clinic = visibleDoctors.flatMap((d) => d.clinics ?? []).find((c) => c.id === selectedClinicId);
      if (!clinic) return;

      const res = await fetch("/api/route", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userLat: userLocation.lat,
          userLng: userLocation.lng,
          clinicLat: clinic.location_lat,
          clinicLng: clinic.location_lng,
        }),
      });
      const data = (await res.json()) as {
        coordinates?: Array<[number, number]>;
        distanceKm?: number;
        durationMin?: number;
      };
      if (res.ok && data.coordinates) {
        setRouteInfo({
          coordinates: data.coordinates,
          distanceKm: data.distanceKm ?? 0,
          durationMin: data.durationMin ?? 0,
        });
      }
    };
    void loadRoute();
  }, [selectedClinicId, userLocation, visibleDoctors]);

  const applyManualLocation = () => {
    const lat = Number(manualLocation.lat);
    const lng = Number(manualLocation.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      setMessage("Enter valid latitude and longitude values.");
      return;
    }
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      setMessage("Latitude must be [-90, 90] and longitude must be [-180, 180].");
      return;
    }
    setUserLocation({ lat, lng });
    setMessage(null);
  };

  const book = async () => {
    if (!selectedDoctorId) {
      setMessage("Select a doctor first.");
      return;
    }
    if (!selectedClinicId || !selectedSlotId) {
      setMessage("Choose a clinic and available slot.");
      return;
    }
    setLoading("Confirming booking...");
    setMessage(null);
    const token = await withToken();
    const res = await fetch("/api/appointments", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        doctorId: selectedDoctorId,
        clinicId: selectedClinicId,
        slotId: selectedSlotId,
      }),
    });
    const data = (await res.json()) as { error?: string };
    if (!res.ok) {
      setLoading("");
      setMessage(data.error ?? "Booking failed.");
      return;
    }
    setLoading("");
    await refreshPatientData();
  };

  const currentAppointment = appointments[appointments.length - 1] ?? null;
  const selectedDoctor = visibleDoctors.find((d) => d.id === selectedDoctorId) ?? null;
  const clinics = (selectedDoctor?.clinics ?? []) as Clinic[];
  const selectedClinic = clinics.find((c) => c.id === selectedClinicId) ?? null;
  const selectedSlot = (selectedClinic?.doctor_slots ?? []).find((s) => s.id === selectedSlotId) ?? null;
  const mapClinics = visibleDoctors.flatMap((d) => d.clinics ?? []);
  const selectedDoctorName = selectedDoctor?.users?.name ?? "Doctor";

  const normalizedMedicines = (prescription: Prescription): PrescriptionMedicine[] =>
    (prescription.medicines ?? prescription.medications ?? []).map((medicine) => {
      const m = medicine as PrescriptionMedicine;
      if (m.frequency || m.duration) return m;
      const schedule = m.schedule ?? "";
      const [frequencyPart, durationPart] = schedule.split("for");
      return {
        ...m,
        frequency: m.frequency ?? (frequencyPart?.trim() || m.schedule || "-"),
        duration: m.duration ?? (durationPart?.trim() || "-"),
      };
    });

  return (
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-3xl border border-zinc-200 bg-gradient-to-br from-slate-900 via-zinc-900 to-blue-950 p-6 text-white shadow-xl">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.18),transparent_42%)]" />
        <div className="relative z-10">
          <h2 className="text-2xl font-semibold">Find care instantly</h2>
          <p className="mt-1 text-sm text-blue-100">
            Premium smart booking with live routing, auto-zoom, and clinic-based scheduling.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs">
              {locationLoading ? "Locating you..." : userLocation ? "Location ready" : "Location unavailable"}
            </span>
            {triage && (
              <span className="rounded-full bg-blue-500/30 px-3 py-1 text-xs">
                {triage.specialty} · {triage.urgency}
              </span>
            )}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              value={manualLocation.lat}
              onChange={(e) => setManualLocation((prev) => ({ ...prev, lat: e.target.value }))}
              placeholder="Latitude"
              className="w-28 rounded-lg border border-white/20 bg-white/10 px-2 py-1 text-xs text-white placeholder:text-blue-100"
            />
            <input
              value={manualLocation.lng}
              onChange={(e) => setManualLocation((prev) => ({ ...prev, lng: e.target.value }))}
              placeholder="Longitude"
              className="w-28 rounded-lg border border-white/20 bg-white/10 px-2 py-1 text-xs text-white placeholder:text-blue-100"
            />
            <button
              type="button"
              onClick={applyManualLocation}
              className="btn-ripple rounded-lg bg-white/20 px-3 py-1 text-xs font-medium text-white hover:bg-white/30"
            >
              Use manual location
            </button>
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-lg">
        <div className="absolute left-4 right-4 top-4 z-[500] rounded-2xl border border-white/20 bg-white/85 p-3 shadow-md backdrop-blur-md">
          <label className="text-xs font-medium text-zinc-600">Symptoms</label>
          <textarea
            value={symptoms}
            onChange={(e) => onSymptomsChange(e.target.value)}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                e.preventDefault();
                void searchClosestDoctors();
              }
            }}
            rows={2}
            className="mt-1 w-full resize-none rounded-xl border border-zinc-200 bg-white/90 p-3 text-sm outline-none focus:border-blue-500"
            placeholder="Search care needs (e.g. chest pain, skin rash, fever...)"
          />
          <div className="mt-2 flex items-center gap-2 text-xs">
            {loading ? (
              <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-blue-700">
                <span className="h-2 w-2 animate-pulse rounded-full bg-blue-600" />
                {loading}
              </span>
            ) : (
              <span className="rounded-full bg-zinc-100 px-3 py-1 text-zinc-600">AI ready</span>
            )}
            {message && <span className="text-amber-700">{message}</span>}
          </div>
          <div className="mt-2">
            <button
              type="button"
              onClick={() => void searchClosestDoctors()}
              disabled={Boolean(loading)}
              className="btn-ripple rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              Search closest doctors
            </button>
          </div>
        </div>
        <div className="pt-28">
          <DoctorMap
            userLocation={userLocation}
            clinics={mapClinics}
            selectedClinicId={selectedClinicId}
            onSelectClinic={(clinicId) => {
              setSelectedClinicId(clinicId);
              const owner = visibleDoctors.find((d) => (d.clinics ?? []).some((c) => c.id === clinicId));
              if (owner) {
                setSelectedDoctorId(owner.id);
                const clinic = owner.clinics?.find((c) => c.id === clinicId);
                setSelectedSlotId(clinic?.doctor_slots?.[0]?.id ?? null);
              } else {
                setSelectedSlotId(null);
              }
            }}
            routeCoords={routeInfo?.coordinates}
          />
        </div>
        {routeInfo && selectedClinic && (
          <div className="absolute bottom-4 left-4 right-4 z-[500] rounded-2xl border border-white/40 bg-white/90 p-4 shadow-lg backdrop-blur">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-zinc-900">{selectedDoctorName}</p>
                <p className="text-xs text-zinc-600">{selectedClinic.name}</p>
                <p className="text-xs text-zinc-500">
                  {routeInfo.distanceKm.toFixed(1)} km · {Math.max(1, Math.round(routeInfo.durationMin))} mins
                </p>
              </div>
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${selectedClinic.location_lat},${selectedClinic.location_lng}`}
                target="_blank"
                rel="noreferrer"
                className="btn-ripple rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                Navigate
              </a>
            </div>
          </div>
        )}
      </section>

      <section className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-md">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-zinc-900">Nearby doctors</h3>
          <span className="text-xs text-zinc-500">{visibleDoctors.length} results</span>
        </div>
        <div className="max-h-[320px] space-y-3 overflow-y-auto pr-1">
          {visibleDoctors.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => {
                setSelectedDoctorId(d.id);
                setSelectedClinicId(d.clinics?.[0]?.id ?? null);
                setSelectedSlotId(d.clinics?.[0]?.doctor_slots?.[0]?.id ?? null);
              }}
              className={`w-full rounded-2xl border p-4 text-left transition-all ${
                d.id === selectedDoctorId
                  ? "border-blue-600 bg-blue-50 shadow-md"
                  : "border-zinc-200 hover:-translate-y-0.5 hover:bg-zinc-50"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold text-zinc-900">{d.users?.name ?? "Doctor"}</div>
                  <div className="text-sm text-zinc-600">{d.specialty}</div>
                  <div className="mt-1 text-xs text-zinc-500">
                    ⭐ {d.rating.toFixed(1)} ·{" "}
                    {Number.isFinite(d.distance_km) ? `${d.distance_km!.toFixed(1)} km` : "Distance unavailable"}
                  </div>
                </div>
                <div className="flex gap-2">
                  <span className="rounded-lg bg-zinc-100 px-2 py-1 text-xs text-zinc-600">
                    {d.next_available_slot ? "Next available" : "No open slots"}
                  </span>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <span className="rounded-lg border border-zinc-200 px-2 py-1 text-xs text-zinc-600">View on map</span>
                <span className="rounded-lg bg-blue-600 px-2 py-1 text-xs text-white">Book now</span>
              </div>
            </button>
          ))}
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm text-zinc-700">Clinic</label>
            <select
              value={selectedClinicId ?? ""}
              onChange={(e) => {
                setSelectedClinicId(e.target.value || null);
                setSelectedSlotId(null);
              }}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2"
            >
              <option value="">Select clinic</option>
              {clinics.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} - {c.address}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm text-zinc-700">Available slot</label>
            <select
              value={selectedSlotId ?? ""}
              onChange={(e) => setSelectedSlotId(e.target.value || null)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2"
              disabled={!selectedClinic}
            >
              <option value="">{selectedClinic ? "Select slot" : "Select clinic first"}</option>
              {(selectedClinic?.doctor_slots ?? []).map((slot: DoctorSlot) => (
                <option key={slot.id} value={slot.id} disabled={slot.is_booked}>
                  {formatDateTime(slot.start_time)} - {slot.is_booked ? "Booked" : "Available"}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-zinc-600">
            Selected: {selectedClinic?.name ?? "-"} · {selectedSlot ? formatDateTime(selectedSlot.start_time) : "-"}
          </div>
          <button
            type="button"
            onClick={book}
            disabled={Boolean(loading)}
            className="btn-ripple h-10 rounded-xl bg-zinc-900 px-5 text-sm font-semibold text-white hover:bg-zinc-700 disabled:opacity-60"
          >
            Book appointment
          </button>
        </div>

        {currentAppointment && (
          <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
            <div className="text-sm text-zinc-700">
              Status: <strong className="capitalize">{currentAppointment.status}</strong>
            </div>
            <div className="text-sm text-zinc-600">{formatDateTime(currentAppointment.time)}</div>
          </div>
        )}
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <article className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h4 className="text-base font-semibold text-zinc-900">Prescription</h4>
          <button
            type="button"
            onClick={refreshPatientData}
            className="mt-2 rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
          >
            Refresh
          </button>
          <div className="mt-3 space-y-2">
            {prescriptions.length === 0 ? (
              <p className="text-sm text-zinc-600">No prescriptions yet.</p>
            ) : (
              prescriptions.slice(0, 2).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedPrescription(p)}
                  className="w-full rounded-lg border border-zinc-200 p-3 text-left transition hover:bg-zinc-50"
                >
                  <div className="text-sm font-medium text-zinc-900">{p.doctor_notes ?? p.diagnosis ?? "Prescription"}</div>
                  <div className="text-xs text-zinc-500">
                    Meds: {(p.medicines ?? p.medications ?? []).length} · Click for details
                  </div>
                </button>
              ))
            )}
          </div>
        </article>

        <article className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h4 className="text-base font-semibold text-zinc-900">Medication reminders</h4>
          <div className="mt-3 space-y-2">
            {reminders.length === 0 ? (
              <p className="text-sm text-zinc-600">No reminders yet.</p>
            ) : (
              reminders.slice(0, 4).map((r) => (
                <div key={r.id} className="rounded-lg border border-zinc-200 p-3">
                  <div className="text-sm font-medium text-zinc-900">{r.medication_name}</div>
                  <div className="text-xs text-zinc-500">{r.schedule}</div>
                </div>
              ))
            )}
          </div>
        </article>
      </section>
      <section className="hidden">
        <div className="mt-4 space-y-3">
          {prescriptions.length === 0 ? (
            <p className="text-sm text-zinc-600">No prescriptions yet.</p>
          ) : (
            prescriptions.slice(0, 3).map((p) => (
              <article key={p.id} className="rounded-lg border border-zinc-200 p-4">
                <div className="text-sm font-medium text-zinc-900">{p.doctor_notes ?? p.diagnosis ?? "Prescription"}</div>
                <div className="mt-2 text-sm text-zinc-600">
                  Medicines: {(p.medicines ?? p.medications ?? []).length}
                </div>
              </article>
            ))
          )}
        </div>
      </section>

      {selectedPrescription && (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm transition"
          onClick={() => setSelectedPrescription(null)}
        >
          <div
            className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-3xl border border-zinc-200 bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-200 bg-white/95 px-6 py-4 backdrop-blur">
              <div>
                <h3 className="text-lg font-semibold text-zinc-900">Medical Prescription</h3>
                <p className="text-xs text-zinc-500">Healoz Digital Care Record</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPrescription(null)}
                className="rounded-md border border-zinc-300 px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-100"
              >
                Close
              </button>
            </div>
            <div className="space-y-6 p-6">
              <section className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Doctor</h4>
                  <p className="mt-1 text-sm font-semibold text-zinc-900">
                    {selectedPrescription.doctor?.users?.name ?? "Not available"}
                  </p>
                  <p className="text-sm text-zinc-700">{selectedPrescription.doctor?.specialty ?? "-"}</p>
                </div>
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Clinic</h4>
                  <p className="mt-1 text-sm font-semibold text-zinc-900">
                    {selectedPrescription.appointment?.clinics?.name ?? "Not available"}
                  </p>
                  <p className="text-sm text-zinc-700">{selectedPrescription.appointment?.clinics?.address ?? "-"}</p>
                </div>
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Patient</h4>
                  <p className="mt-1 text-sm font-semibold text-zinc-900">
                    {selectedPrescription.patient?.name ?? "Not available"}
                  </p>
                  <p className="text-sm text-zinc-700">{selectedPrescription.patient?.email ?? "-"}</p>
                </div>
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Prescription Date</h4>
                  <p className="mt-1 text-sm font-semibold text-zinc-900">{formatDateTime(selectedPrescription.created_at)}</p>
                </div>
              </section>

              <section className="rounded-2xl border border-zinc-200 p-4">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Diagnosis</h4>
                <p className="mt-2 text-sm text-zinc-800">
                  {selectedPrescription.diagnosis ?? selectedPrescription.doctor_notes ?? "No diagnosis provided"}
                </p>
              </section>

              <section className="rounded-2xl border border-zinc-200 p-4">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Medicines</h4>
                <div className="mt-3 overflow-x-auto">
                  <table className="min-w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-500">
                        <th className="px-3 py-2">Name</th>
                        <th className="px-3 py-2">Dosage</th>
                        <th className="px-3 py-2">Frequency</th>
                        <th className="px-3 py-2">Duration</th>
                      </tr>
                    </thead>
                    <tbody>
                      {normalizedMedicines(selectedPrescription).map((medicine, index) => (
                        <tr key={`${medicine.name}-${index}`} className="border-b border-zinc-100">
                          <td className="px-3 py-2 font-medium text-zinc-900">{medicine.name}</td>
                          <td className="px-3 py-2 text-zinc-700">{medicine.dosage ?? "-"}</td>
                          <td className="px-3 py-2 text-zinc-700">{medicine.frequency ?? medicine.schedule ?? "-"}</td>
                          <td className="px-3 py-2 text-zinc-700">{medicine.duration ?? "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="rounded-2xl border border-zinc-200 p-4">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Doctor Notes</h4>
                <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-800">
                  {selectedPrescription.doctor_notes ?? "No additional notes provided."}
                </p>
              </section>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

