"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Appointment, Clinic, DoctorSlot, MedicalHistoryEntry, Prescription } from "@/models/types";
import { formatDateTime } from "@/utils/format";

export function DoctorDashboard({ initialAppointments }: { initialAppointments: Appointment[] }) {
  const supabase = useMemo(() => createClient(), []);
  const [appointments, setAppointments] = useState<Appointment[]>(initialAppointments);
  const [selected, setSelected] = useState<Appointment | null>(initialAppointments[0] ?? null);
  const [notes, setNotes] = useState("");
  const [doctorNotes, setDoctorNotes] = useState("");
  const [meds, setMeds] = useState<Array<{ name: string; schedule: string }>>([{ name: "", schedule: "" }]);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [slots, setSlots] = useState<DoctorSlot[]>([]);
  const [newClinic, setNewClinic] = useState({ name: "", address: "", lat: "", lng: "" });
  const [newSlot, setNewSlot] = useState({ clinicId: "", startTime: "", endTime: "" });
  const [patientSummary, setPatientSummary] = useState("");
  const [patientHistory, setPatientHistory] = useState<MedicalHistoryEntry[]>([]);
  const [patientPrescriptions, setPatientPrescriptions] = useState<Prescription[]>([]);
  const [patientAppointments, setPatientAppointments] = useState<Appointment[]>([]);

  const withToken = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token ?? "";
  };

  const refresh = async () => {
    setBusy(true);
    const token = await withToken();
    const [apptRes, clinicRes, slotRes] = await Promise.all([
      fetch("/api/appointments", { headers: { Authorization: `Bearer ${token}` } }),
      fetch("/api/doctor/clinics", { headers: { Authorization: `Bearer ${token}` } }),
      fetch("/api/doctor/slots", { headers: { Authorization: `Bearer ${token}` } }),
    ]);
    if (apptRes.ok) {
      const data = (await apptRes.json()) as Appointment[];
      setAppointments(data);
      setSelected((prev) => data.find((a) => a.id === prev?.id) ?? data[0] ?? null);
    }
    if (clinicRes.ok) setClinics((await clinicRes.json()) as Clinic[]);
    if (slotRes.ok) setSlots((await slotRes.json()) as DoctorSlot[]);
    setBusy(false);
  };

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => {
      void refresh();
    }, 8000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const loadContext = async () => {
      if (!selected?.patient_id) return;
      const token = await withToken();
      const res = await fetch(`/api/doctor/patient-context?patientId=${selected.patient_id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = (await res.json()) as {
        summary: string;
        history: MedicalHistoryEntry[];
        prescriptions: Prescription[];
        appointments: Appointment[];
      };
      setPatientSummary(data.summary ?? "");
      setPatientHistory(data.history ?? []);
      setPatientPrescriptions(data.prescriptions ?? []);
      setPatientAppointments(data.appointments ?? []);
    };
    void loadContext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.patient_id]);

  const addClinic = async () => {
    if (!newClinic.name || !newClinic.address || !newClinic.lat || !newClinic.lng) return;
    setBusy(true);
    const token = await withToken();
    const res = await fetch("/api/doctor/clinics", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        name: newClinic.name,
        address: newClinic.address,
        locationLat: Number(newClinic.lat),
        locationLng: Number(newClinic.lng),
      }),
    });
    if (res.ok) {
      setNewClinic({ name: "", address: "", lat: "", lng: "" });
      await refresh();
    }
    setBusy(false);
  };

  const addSlot = async () => {
    if (!newSlot.clinicId || !newSlot.startTime || !newSlot.endTime) return;
    setBusy(true);
    const token = await withToken();
    const res = await fetch("/api/doctor/slots", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        clinicId: newSlot.clinicId,
        startTime: new Date(newSlot.startTime).toISOString(),
        endTime: new Date(newSlot.endTime).toISOString(),
      }),
    });
    if (res.ok) {
      setNewSlot({ clinicId: "", startTime: "", endTime: "" });
      await refresh();
    }
    setBusy(false);
  };

  const setAppointmentStatus = async (appointmentId: string, nextStatus: "ongoing" | "completed") => {
    setBusy(true);
    setStatus(null);
    const token = await withToken();
    const res = await fetch("/api/appointments", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ appointmentId, status: nextStatus, notes }),
    });
    const data = (await res.json()) as { error?: string } | Appointment;
    if (!res.ok) {
      setStatus((data as { error?: string }).error ?? "Failed to update appointment.");
      setBusy(false);
      return;
    }
    await refresh();
    setBusy(false);
  };

  const submitPrescription = async () => {
    if (!selected) return;
    const filtered = meds.filter((m) => m.name.trim() && m.schedule.trim());
    if (!doctorNotes.trim() || filtered.length === 0) {
      setStatus("Add doctor notes and at least one medicine with schedule.");
      return;
    }

    setBusy(true);
    setStatus(null);
    const token = await withToken();
    const res = await fetch("/api/prescription", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        appointmentId: selected.id,
        doctorNotes,
        medicines: filtered.map((m) => ({ name: m.name, schedule: m.schedule })),
      }),
    });
    const data = (await res.json()) as { error?: string };
    if (!res.ok) {
      setStatus(data.error ?? "Failed to create prescription.");
      setBusy(false);
      return;
    }
    setStatus("Prescription sent to patient (and reminders generated).");
    setBusy(false);
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-zinc-900">Clinic + availability management</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-4">
          <input
            value={newClinic.name}
            onChange={(e) => setNewClinic((p) => ({ ...p, name: e.target.value }))}
            className="rounded-lg border border-zinc-300 px-3 py-2"
            placeholder="Clinic name"
          />
          <input
            value={newClinic.address}
            onChange={(e) => setNewClinic((p) => ({ ...p, address: e.target.value }))}
            className="rounded-lg border border-zinc-300 px-3 py-2"
            placeholder="Address"
          />
          <input
            value={newClinic.lat}
            onChange={(e) => setNewClinic((p) => ({ ...p, lat: e.target.value }))}
            className="rounded-lg border border-zinc-300 px-3 py-2"
            placeholder="Latitude"
          />
          <input
            value={newClinic.lng}
            onChange={(e) => setNewClinic((p) => ({ ...p, lng: e.target.value }))}
            className="rounded-lg border border-zinc-300 px-3 py-2"
            placeholder="Longitude"
          />
        </div>
        <button
          type="button"
          onClick={addClinic}
          disabled={busy}
          className="mt-3 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-60"
        >
          Add clinic
        </button>
        <div className="mt-3 text-sm text-zinc-600">Clinics: {clinics.length}</div>

        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <select
            value={newSlot.clinicId}
            onChange={(e) => setNewSlot((p) => ({ ...p, clinicId: e.target.value }))}
            className="rounded-lg border border-zinc-300 px-3 py-2"
          >
            <option value="">Select clinic</option>
            {clinics.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <input
            type="datetime-local"
            value={newSlot.startTime}
            onChange={(e) => setNewSlot((p) => ({ ...p, startTime: e.target.value }))}
            className="rounded-lg border border-zinc-300 px-3 py-2"
          />
          <input
            type="datetime-local"
            value={newSlot.endTime}
            onChange={(e) => setNewSlot((p) => ({ ...p, endTime: e.target.value }))}
            className="rounded-lg border border-zinc-300 px-3 py-2"
          />
          <button
            type="button"
            onClick={addSlot}
            disabled={busy}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            Add slot
          </button>
        </div>
        <div className="mt-3 text-sm text-zinc-600">
          Future open slots: {slots.filter((s) => !s.is_booked && new Date(s.start_time) > new Date()).length}
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-zinc-900">Incoming appointments</h2>
        <button
          type="button"
          onClick={refresh}
          disabled={busy}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-100 disabled:opacity-60"
        >
          Refresh
        </button>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm md:col-span-1">
          <div className="space-y-2">
            {appointments.length === 0 ? (
              <p className="text-sm text-zinc-600">No appointments yet.</p>
            ) : (
              appointments.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => {
                    setSelected(a);
                    setNotes(a.notes ?? "");
                  }}
                  className={`w-full rounded-lg border p-3 text-left ${
                    selected?.id === a.id ? "border-blue-600 bg-blue-50" : "border-zinc-200 hover:bg-zinc-50"
                  }`}
                >
                  <div className="text-sm font-medium text-zinc-900">{a.patient?.name ?? "Patient"}</div>
                  <div className="text-xs text-zinc-600">{formatDateTime(a.time)}</div>
                  <div className="text-xs text-zinc-500 capitalize">{a.status}</div>
                </button>
              ))
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm md:col-span-2">
          <h3 className="text-lg font-semibold text-zinc-900">Consultation</h3>
          {!selected ? (
            <p className="mt-2 text-sm text-zinc-600">Select an appointment.</p>
          ) : (
            <div className="mt-4 space-y-4">
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
                <div className="text-sm text-zinc-700">
                  Patient: <strong>{selected.patient?.name ?? "Patient"}</strong>
                </div>
                <div className="text-sm text-zinc-600">{formatDateTime(selected.time)}</div>
                <div className="text-sm text-zinc-600">Clinic: {selected.clinics?.name ?? "N/A"}</div>
                <div className="text-sm text-zinc-600">
                  Status: <strong className="capitalize">{selected.status}</strong>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm text-zinc-700">Doctor notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-zinc-300 p-3"
                  placeholder="Consultation notes..."
                />
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={busy || selected.status !== "booked"}
                  onClick={() => setAppointmentStatus(selected.id, "ongoing")}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  Start consultation
                </button>
                <button
                  type="button"
                  disabled={busy || selected.status === "completed" || selected.status === "cancelled"}
                  onClick={() => setAppointmentStatus(selected.id, "completed")}
                  className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-60"
                >
                  Mark completed
                </button>
              </div>

              <div className="border-t border-zinc-200 pt-4">
                <h4 className="text-sm font-semibold text-zinc-900">Create prescription</h4>
                <p className="mt-1 text-sm text-zinc-600">This sends medicines to patient and generates reminders.</p>
                <textarea
                  value={doctorNotes}
                  onChange={(e) => setDoctorNotes(e.target.value)}
                  rows={2}
                  className="mt-3 w-full rounded-lg border border-zinc-300 p-3"
                  placeholder="Diagnosis / instructions..."
                />

                <div className="mt-3 space-y-2">
                  {meds.map((m, idx) => (
                    <div key={idx} className="grid gap-2 md:grid-cols-2">
                      <input
                        value={m.name}
                        onChange={(e) => {
                          const next = meds.slice();
                          next[idx] = { ...next[idx], name: e.target.value };
                          setMeds(next);
                        }}
                        className="rounded-lg border border-zinc-300 px-3 py-2"
                        placeholder="Medicine name"
                      />
                      <input
                        value={m.schedule}
                        onChange={(e) => {
                          const next = meds.slice();
                          next[idx] = { ...next[idx], schedule: e.target.value };
                          setMeds(next);
                        }}
                        className="rounded-lg border border-zinc-300 px-3 py-2"
                        placeholder="Schedule (e.g., 2x/day after meals)"
                      />
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setMeds((prev) => [...prev, { name: "", schedule: "" }])}
                    className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-100"
                  >
                    Add medicine
                  </button>
                </div>

                <button
                  type="button"
                  disabled={busy}
                  onClick={submitPrescription}
                  className="mt-3 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  Send prescription
                </button>
              </div>
            </div>
          )}

          {status && <p className="mt-3 text-sm text-zinc-700">{status}</p>}

          {selected && (
            <div className="mt-6 border-t border-zinc-200 pt-4">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-semibold text-zinc-900">Patient summary</h4>
                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700">
                  AI generated
                </span>
              </div>
              <p className="mt-1 text-sm text-zinc-700">{patientSummary || "No summary available."}</p>
              <div className="mt-3 grid gap-4 md:grid-cols-3">
                <div>
                  <p className="text-xs font-semibold text-zinc-600">Appointments timeline</p>
                  <div className="mt-2 space-y-2">
                    {patientAppointments.slice(0, 6).map((a) => (
                      <div key={a.id} className="rounded border border-zinc-200 p-2 text-xs">
                        {formatDateTime(a.time)} · {a.status}
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-zinc-600">Prescriptions</p>
                  <div className="mt-2 space-y-2">
                    {patientPrescriptions.slice(0, 6).map((p) => (
                      <div key={p.id} className="rounded border border-zinc-200 p-2 text-xs">
                        {p.doctor_notes ?? p.diagnosis ?? "Prescription"}
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-zinc-600">Medical history</p>
                  <div className="mt-2 space-y-2">
                    {patientHistory.slice(0, 6).map((h) => (
                      <div key={h.id} className="rounded border border-zinc-200 p-2 text-xs">
                        <div className="font-medium">{h.diagnosis}</div>
                        <div>{h.notes}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

