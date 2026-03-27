"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Doctor, TriageResult } from "@/models/types";

export function PatientDashboard({ doctors }: { doctors: Doctor[] }) {
  const [symptoms, setSymptoms] = useState("");
  const [triage, setTriage] = useState<TriageResult | null>(null);
  const [recommendedDoctors, setRecommendedDoctors] = useState<Doctor[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [appointmentTime, setAppointmentTime] = useState("");
  const [busy, setBusy] = useState(false);

  const withToken = async () => {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token ?? "";
  };

  const runAiTriage = async () => {
    setBusy(true);
    setMessage(null);
    const token = await withToken();
    const response = await fetch("/api/ai", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ symptom: symptoms }),
    });
    const data = (await response.json()) as
      | (TriageResult & { doctors: Doctor[] })
      | { error?: string };

    if (!response.ok) {
      setMessage((data as { error?: string }).error ?? "Could not run triage.");
      setBusy(false);
      return;
    }

    const ok = data as TriageResult & { doctors: Doctor[] };
    setTriage({ specialty: ok.specialty, urgency: ok.urgency });
    setRecommendedDoctors(ok.doctors ?? []);
    setBusy(false);
  };

  const bookAppointment = async (doctorId: string) => {
    if (!appointmentTime) {
      setMessage("Please pick an appointment time first.");
      return;
    }

    setBusy(true);
    setMessage(null);
    const token = await withToken();
    const time = new Date(appointmentTime).toISOString();
    const response = await fetch("/api/appointments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ doctorId, time }),
    });

    const data = (await response.json()) as { id?: string; error?: string };
    if (!response.ok) {
      setMessage(data.error ?? "Unable to book appointment.");
      setBusy(false);
      return;
    }

    setMessage("Appointment booked successfully.");
    setBusy(false);
  };

  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-xl font-semibold text-zinc-900">AI Symptom Triage</h2>
        <p className="mt-1 text-sm text-zinc-600">Describe your symptoms and get a specialty recommendation.</p>
        <textarea
          value={symptoms}
          onChange={(event) => setSymptoms(event.target.value)}
          className="mt-4 w-full rounded-lg border border-zinc-300 p-3"
          rows={4}
          placeholder="Example: I have chest pain and shortness of breath."
        />
        <button
          type="button"
          disabled={busy || !symptoms.trim()}
          onClick={runAiTriage}
          className="mt-3 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          Get AI Triage
        </button>
        {triage && (
          <p className="mt-3 rounded-lg bg-blue-50 p-3 text-sm text-blue-900">
            Recommended: <strong>{triage.specialty}</strong> (Urgency: <strong>{triage.urgency}</strong>)
          </p>
        )}
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-xl font-semibold text-zinc-900">Recommended doctors</h2>
        <div className="mt-3">
          <label htmlFor="time" className="mb-1 block text-sm text-zinc-700">
            Appointment time
          </label>
          <input
            id="time"
            type="datetime-local"
            value={appointmentTime}
            onChange={(event) => setAppointmentTime(event.target.value)}
            className="w-full max-w-sm rounded-lg border border-zinc-300 px-3 py-2"
          />
        </div>
        <div className="mt-4 grid gap-3">
          {!triage ? (
            <p className="text-sm text-zinc-600">Analyze symptoms to get recommended doctors.</p>
          ) : recommendedDoctors.length === 0 ? (
            <div className="space-y-2">
              <p className="text-sm text-zinc-600">
                No doctors found for <strong>{triage.specialty}</strong>.
              </p>
              <p className="text-sm text-zinc-600">
                Showing all doctors as fallback (so you can still book).
              </p>
              <div className="grid gap-3">
                {doctors.map((doctor) => (
                  <article key={doctor.id} className="rounded-lg border border-zinc-200 p-4">
                    <p className="font-semibold text-zinc-900">{doctor.users?.name ?? "Doctor"}</p>
                    <p className="text-sm text-zinc-700">{doctor.specialty}</p>
                    <p className="text-sm text-zinc-500">Rating: {doctor.rating.toFixed(1)}</p>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => bookAppointment(doctor.id)}
                      className="mt-3 rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-60"
                    >
                      Book appointment
                    </button>
                  </article>
                ))}
              </div>
            </div>
          ) : (
            recommendedDoctors.map((doctor) => (
              <article key={doctor.id} className="rounded-lg border border-zinc-200 p-4">
                <p className="font-semibold text-zinc-900">{doctor.users?.name ?? "Doctor"}</p>
                <p className="text-sm text-zinc-700">{doctor.specialty}</p>
                <p className="text-sm text-zinc-500">Rating: {doctor.rating.toFixed(1)}</p>
                <div className="mt-2">
                  <p className="text-xs font-medium text-zinc-700">Available slots</p>
                  <p className="text-xs text-zinc-500">
                    {Array.isArray(doctor.available_slots) && doctor.available_slots.length > 0
                      ? doctor.available_slots.slice(0, 3).join(", ")
                      : "No slots provided (you can still pick a time above)."}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => bookAppointment(doctor.id)}
                  className="mt-3 rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-60"
                >
                  Book appointment
                </button>
              </article>
            ))
          )}
        </div>
        {message && <p className="mt-3 text-sm text-zinc-700">{message}</p>}
      </div>
    </section>
  );
}
