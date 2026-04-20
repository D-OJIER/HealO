"use client";

import type { KeyboardEvent } from "react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const MEDICINE_OPTIONS = [
  "Aceclofenac",
  "Amoxicillin",
  "Azithromycin",
  "Calamine Lotion",
  "Cetirizine",
  "Cold Pack",
  "Ibuprofen",
  "Levocetirizine",
  "ORS",
  "Paracetamol",
  "Paracetamol Syrup",
  "Saline Nasal Spray",
  "Salt Water Gargle"
] as const;

const TIMING_OPTIONS = [
  { value: "morning", label: "Morning" },
  { value: "afternoon", label: "Afternoon" },
  { value: "evening", label: "Evening" },
  { value: "night", label: "Night" }
] as const;

type TimingValue = (typeof TIMING_OPTIONS)[number]["value"];

type MedicationRow = {
  name: string;
  dosage: string;
  timing: TimingValue[];
  foodRelation: "before_food" | "after_food";
};

type SuggestionItem = {
  name: string;
  dosage: string;
  timing: TimingValue[];
  foodRelation: "before_food" | "after_food";
  schedule: string;
  reason: string;
  blocked: boolean;
  conflictReason?: string;
};

type PrescriptionSuggestion = {
  diagnosisHint: string;
  rationale: string;
  allergySummary: string[];
  cautions: string[];
  suggestions: SuggestionItem[];
};

type Dashboard = {
  doctor: {
    name: string;
    specialty?: string | null;
    verification_status: "pending" | "verified" | "rejected";
    location_lat?: number | null;
    location_lng?: number | null;
  };
  metrics: { clinicCount: number; slotCount: number; averageRating: number };
  clinics: Array<{ id: string; name: string; address: string; location_lat: number; location_lng: number }>;
  slots: Array<{ id: string; clinic_id: string; start_time: string; end_time: string }>;
  slotBoard: Array<{
    id: string;
    clinicId: string;
    clinicName: string;
    startTime: string;
    endTime: string;
    isBooked: boolean;
    appointment?: {
      id: string;
      slotId: string;
      patientName: string;
      patientPhoneMasked: string;
      status: string;
      symptoms: string;
      slotStart: string | null;
      patientHistorySummary: string;
      allergies: Array<{ allergen: string; reaction: string; severity: "low" | "medium" | "high" }>;
      prescriptionSuggestions: PrescriptionSuggestion;
      hasArrived: boolean;
      patientArrivedAt: string | null;
      previousPrescriptions: Array<{
        diagnosis: string;
        notes: string;
        medications: Array<{ name: string; dosage: string; schedule: string }>;
      }>;
      prescription: { diagnosis: string; notes: string; medications: Array<{ name: string; dosage: string; schedule: string }> } | null;
    };
  }>;
  appointments: Array<{
    id: string;
    slotId: string;
    patientName: string;
    patientPhoneMasked: string;
    status: string;
    symptoms: string;
    slotStart: string | null;
    patientHistorySummary: string;
    allergies: Array<{ allergen: string; reaction: string; severity: "low" | "medium" | "high" }>;
    prescriptionSuggestions: PrescriptionSuggestion;
    hasArrived: boolean;
    patientArrivedAt: string | null;
    previousPrescriptions: Array<{
      diagnosis: string;
      notes: string;
      medications: Array<{ name: string; dosage: string; schedule: string }>;
    }>;
    prescription: { diagnosis: string; notes: string; medications: Array<{ name: string; dosage: string; schedule: string }> } | null;
  }>;
};

const emptyMedicationRow = (): MedicationRow => ({
  name: "",
  dosage: "",
  timing: [],
  foodRelation: "after_food"
});

export default function DoctorPage() {
  const router = useRouter();
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [clinicForm, setClinicForm] = useState({ name: "", address: "", latitude: "12.9716", longitude: "77.5946" });
  const [slotForm, setSlotForm] = useState({
    clinicId: "",
    date: "",
    sessionStart: "09:00",
    sessionEnd: "12:00",
    slotMinutes: "20",
    breakMinutes: "10"
  });
  const [prescriptionForm, setPrescriptionForm] = useState({
    appointmentId: "",
    diagnosis: "",
    doctorNotes: ""
  });
  const [medicationRows, setMedicationRows] = useState<MedicationRow[]>([emptyMedicationRow()]);
  const [message, setMessage] = useState("");

  const clinicMapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${Number(clinicForm.longitude) - 0.02}%2C${Number(clinicForm.latitude) - 0.02}%2C${Number(clinicForm.longitude) + 0.02}%2C${Number(clinicForm.latitude) + 0.02}&layer=mapnik&marker=${clinicForm.latitude}%2C${clinicForm.longitude}`;
  const selectedAppointment =
    dashboard?.appointments.find((appointment) => appointment.id === prescriptionForm.appointmentId) || null;
  const suggestionDraft = selectedAppointment
    ? {
        diagnosis: selectedAppointment.prescriptionSuggestions.diagnosisHint,
        doctorNotes:
          `${selectedAppointment.prescriptionSuggestions.rationale} ${selectedAppointment.prescriptionSuggestions.cautions.join(" ")}`.trim(),
        medications: selectedAppointment.prescriptionSuggestions.suggestions
          .filter((item) => !item.blocked)
          .map((item) => ({
            name: item.name,
            dosage: item.dosage,
            timing: item.timing,
            foodRelation: item.foodRelation
          }))
      }
    : { diagnosis: "", doctorNotes: "", medications: [] as MedicationRow[] };

  function getAutocompletePreview(currentValue: string, suggestedValue: string) {
    if (!suggestedValue) {
      return "";
    }

    if (!currentValue) {
      return suggestedValue;
    }

    if (suggestedValue.toLowerCase().startsWith(currentValue.toLowerCase())) {
      return suggestedValue.slice(currentValue.length);
    }

    return "";
  }

  const diagnosisPreview = getAutocompletePreview(prescriptionForm.diagnosis, suggestionDraft.diagnosis);
  const doctorNotesPreview = getAutocompletePreview(prescriptionForm.doctorNotes, suggestionDraft.doctorNotes);

  async function authedFetch(url: string, init?: RequestInit) {
    const response = await fetch(url, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers || {})
      }
    });
    if (response.status === 401) {
      router.push("/");
      return null;
    }
    return response;
  }

  async function loadDashboard() {
    const response = await authedFetch("/api/doctor/dashboard");
    if (!response) return;
    const data = await response.json();
    setDashboard(data);
    setSlotForm((current) => ({ ...current, clinicId: data.clinics[0]?.id || "" }));
    setPrescriptionForm((current) => ({ ...current, appointmentId: data.appointments[0]?.id || "" }));
    setMedicationRows((current) => current.length ? current : [emptyMedicationRow()]);
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  async function addClinic() {
    const response = await authedFetch("/api/doctor/clinics", {
      method: "POST",
      body: JSON.stringify(clinicForm)
    });
    if (!response) return;
    const data = await response.json();
    setMessage(data.message);
    await loadDashboard();
  }

  async function addSlot() {
    const response = await authedFetch("/api/doctor/slots", {
      method: "POST",
      body: JSON.stringify(slotForm)
    });
    if (!response) return;
    const data = await response.json();
    setMessage(data.message);
    await loadDashboard();
  }

  async function updateAppointment(appointmentId: string, status: "accepted" | "rejected") {
    const response = await authedFetch("/api/doctor/appointments", {
      method: "POST",
      body: JSON.stringify({ appointmentId, status })
    });
    if (!response) return;
    const data = await response.json();
    setMessage(data.message);
    await loadDashboard();
  }

  async function markArrived(appointmentId: string) {
    const response = await authedFetch("/api/doctor/appointments", {
      method: "POST",
      body: JSON.stringify({ appointmentId, markArrived: true })
    });
    if (!response) return;
    const data = await response.json();
    setMessage(data.message || data.error);
    await loadDashboard();
  }

  async function savePrescription() {
    const response = await authedFetch("/api/doctor/prescriptions", {
      method: "POST",
      body: JSON.stringify({
        ...prescriptionForm,
        medications: medicationRows.filter((item) => item.name && item.dosage && item.timing.length)
      })
    });
    if (!response) return;
    const data = await response.json();
    setMessage(data.message || data.error);
    if (!response.ok) {
      return;
    }
    await loadDashboard();
  }

  function useSuggestedDraft() {
    if (!selectedAppointment) return;

    setPrescriptionForm((current) => ({
      ...current,
      appointmentId: selectedAppointment.id,
      diagnosis: current.diagnosis || suggestionDraft.diagnosis,
      doctorNotes: current.doctorNotes || suggestionDraft.doctorNotes,
    }));
    setMedicationRows(suggestionDraft.medications.length ? suggestionDraft.medications : [emptyMedicationRow()]);
  }

  function acceptAutocomplete(field: "diagnosis" | "doctorNotes") {
    const targetValue = suggestionDraft[field];
    if (!targetValue) {
      return;
    }

    setPrescriptionForm((current) => ({
      ...current,
      [field]: targetValue
    }));
  }

  function handleAutocompleteKeyDown(
    event: KeyboardEvent<HTMLTextAreaElement>,
    field: "diagnosis" | "doctorNotes"
  ) {
    const previewByField = {
      diagnosis: diagnosisPreview,
      doctorNotes: doctorNotesPreview
    };

    if (event.key === "Tab" && previewByField[field]) {
      event.preventDefault();
      acceptAutocomplete(field);
    }
  }

  function useCurrentLocation() {
    navigator.geolocation?.getCurrentPosition((position) => {
      setClinicForm((current) => ({
        ...current,
        latitude: position.coords.latitude.toFixed(6),
      longitude: position.coords.longitude.toFixed(6)
      }));
    });
  }

  function updateMedicationRow(index: number, patch: Partial<MedicationRow>) {
    setMedicationRows((current) =>
      current.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row))
    );
  }

  function toggleTiming(index: number, timing: TimingValue) {
    setMedicationRows((current) =>
      current.map((row, rowIndex) => {
        if (rowIndex !== index) return row;
        return {
          ...row,
          timing: row.timing.includes(timing)
            ? row.timing.filter((item) => item !== timing)
            : [...row.timing, timing]
        };
      })
    );
  }

  function addMedicationRow() {
    setMedicationRows((current) => [...current, emptyMedicationRow()]);
  }

  function removeMedicationRow(index: number) {
    setMedicationRows((current) => (current.length === 1 ? [emptyMedicationRow()] : current.filter((_, rowIndex) => rowIndex !== index)));
  }

  function getMedicineMatches(value: string) {
    const normalized = value.trim().toLowerCase();
    if (!normalized) {
      return MEDICINE_OPTIONS.slice(0, 6);
    }

    return MEDICINE_OPTIONS.filter((item) => item.toLowerCase().includes(normalized)).slice(0, 6);
  }

  function medicinePreview(value: string) {
    const match = getMedicineMatches(value)[0];
    if (!match) return "";
    if (!value) return match;
    return match.toLowerCase().startsWith(value.toLowerCase()) ? match.slice(value.length) : "";
  }

  function acceptMedicinePreview(index: number) {
    const row = medicationRows[index];
    if (!row) return;
    const match = getMedicineMatches(row.name)[0];
    if (!match) return;
    updateMedicationRow(index, { name: match });
  }

  if (!dashboard) {
    return <main className="shell"><p>Loading doctor workspace...</p></main>;
  }

  return (
    <main className="shell">
      <section className="topbar">
        <div>
          <span className="pill">Doctor Dashboard</span>
          <h1>{dashboard.doctor.name}</h1>
          <p className="muted">
            Specialty: {dashboard.doctor.specialty || "Pending"} | Verification: {dashboard.doctor.verification_status}
          </p>
          <p className="muted">
            Clinics: {dashboard.metrics.clinicCount} | Slots: {dashboard.metrics.slotCount} | Avg rating: {dashboard.metrics.averageRating}
          </p>
        </div>
        <button onClick={async () => {
          await fetch("/api/auth/logout", { method: "POST" });
          router.push("/");
        }}>
          Logout
        </button>
      </section>

      {dashboard.doctor.verification_status !== "verified" ? (
        <section className="panel accent">
          <h2>Verification pending</h2>
          <p>Unverified doctors can sign in but cannot manage patient appointments, diagnosis, or prescriptions.</p>
        </section>
      ) : null}

      <section className="grid-two">
        <article className="panel">
          <h2>Add Clinic</h2>
          <input placeholder="Clinic name" value={clinicForm.name} onChange={(e) => setClinicForm({ ...clinicForm, name: e.target.value })} />
          <input placeholder="Address" value={clinicForm.address} onChange={(e) => setClinicForm({ ...clinicForm, address: e.target.value })} />
          <input placeholder="Latitude" value={clinicForm.latitude} onChange={(e) => setClinicForm({ ...clinicForm, latitude: e.target.value })} />
          <input placeholder="Longitude" value={clinicForm.longitude} onChange={(e) => setClinicForm({ ...clinicForm, longitude: e.target.value })} />
          <div className="actions">
            <button className="ghost" type="button" onClick={useCurrentLocation}>Use current location</button>
            <button disabled={dashboard.doctor.verification_status !== "verified"} onClick={addClinic}>Save clinic</button>
          </div>
          <iframe className="map-frame" src={clinicMapUrl} loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
        </article>

        <article className="panel">
          <h2>Batch Slot Generator</h2>
          <select value={slotForm.clinicId} onChange={(e) => setSlotForm({ ...slotForm, clinicId: e.target.value })}>
            <option value="">Choose clinic</option>
            {dashboard.clinics.map((clinic) => (
              <option key={clinic.id} value={clinic.id}>{clinic.name}</option>
            ))}
          </select>
          <input type="date" value={slotForm.date} onChange={(e) => setSlotForm({ ...slotForm, date: e.target.value })} />
          <input type="time" value={slotForm.sessionStart} onChange={(e) => setSlotForm({ ...slotForm, sessionStart: e.target.value })} />
          <input type="time" value={slotForm.sessionEnd} onChange={(e) => setSlotForm({ ...slotForm, sessionEnd: e.target.value })} />
          <input value={slotForm.slotMinutes} onChange={(e) => setSlotForm({ ...slotForm, slotMinutes: e.target.value })} placeholder="Slot minutes" />
          <input value={slotForm.breakMinutes} onChange={(e) => setSlotForm({ ...slotForm, breakMinutes: e.target.value })} placeholder="Break minutes" />
          <button disabled={dashboard.doctor.verification_status !== "verified"} onClick={addSlot}>Generate slots</button>
        </article>
      </section>

      <section className="panel">
        <h2>All Slots</h2>
        <p className="muted">{message || "Booked slots now show AI patient summaries. Full history unlocks after arrival is marked."}</p>
        <div className="cards">
          {dashboard.slotBoard.map((slot) => (
            <div className="card" key={slot.id}>
              <h3>{slot.clinicName}</h3>
              <p>{new Date(slot.startTime).toLocaleString()}</p>
              <p>Ends {new Date(slot.endTime).toLocaleTimeString()}</p>
              <p>{slot.isBooked ? "Booked / fulfilled slot" : "Open slot"}</p>
              {slot.appointment ? (
                <>
                  <p>Patient: {slot.appointment.patientName}</p>
                  <p>Masked phone: {slot.appointment.patientPhoneMasked}</p>
                  <p>Status: {slot.appointment.status}</p>
                  <p>Current symptoms: {slot.appointment.symptoms}</p>
                  <p>AI summary: {slot.appointment.patientHistorySummary}</p>
                  <p>
                    Allergies: {slot.appointment.allergies.length
                      ? slot.appointment.allergies.map((item) => `${item.allergen} (${item.reaction})`).join(", ")
                      : "No allergies recorded"}
                  </p>
                  <p>
                    Arrival: {slot.appointment.hasArrived ? `marked at ${new Date(slot.appointment.patientArrivedAt || "").toLocaleString()}` : "not marked"}
                  </p>
                  {slot.appointment.hasArrived ? (
                    <div className="callout">
                      <strong>Full prescription history</strong>
                      {slot.appointment.previousPrescriptions.length ? (
                        slot.appointment.previousPrescriptions.map((history, index) => (
                          <p key={`${slot.appointment?.id}-${index}`}>
                            {history.diagnosis} | {history.medications.map((item) => `${item.name} ${item.dosage}`).join(", ")} | {history.notes}
                          </p>
                        ))
                      ) : (
                        <p>No prior prescription history available.</p>
                      )}
                    </div>
                  ) : (
                    <p>Full prescription history becomes visible after the patient arrives.</p>
                  )}
                  <div className="actions">
                    <button disabled={dashboard.doctor.verification_status !== "verified"} onClick={() => updateAppointment(slot.appointment!.id, "accepted")}>Accept</button>
                    <button className="ghost" disabled={dashboard.doctor.verification_status !== "verified"} onClick={() => updateAppointment(slot.appointment!.id, "rejected")}>Reject</button>
                  </div>
                  <button disabled={dashboard.doctor.verification_status !== "verified" || slot.appointment.hasArrived} onClick={() => markArrived(slot.appointment!.id)}>
                    Mark arrived
                  </button>
                </>
              ) : (
                <p>This slot is currently unbooked.</p>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <h2>Diagnosis & Prescription</h2>
        <select value={prescriptionForm.appointmentId} onChange={(e) => setPrescriptionForm({ ...prescriptionForm, appointmentId: e.target.value })}>
          <option value="">Choose appointment</option>
          {dashboard.appointments.map((appointment) => (
            <option key={appointment.id} value={appointment.id}>{appointment.patientName} | {appointment.status}</option>
          ))}
        </select>
        {selectedAppointment ? (
          <div className="callout">
            <strong>Prescription suggestions</strong>
            <p>Current issue: {selectedAppointment.symptoms || "No symptom note available."}</p>
            <p>History summary: {selectedAppointment.patientHistorySummary}</p>
            <p>
              Recorded allergies: {selectedAppointment.prescriptionSuggestions.allergySummary.length
                ? selectedAppointment.prescriptionSuggestions.allergySummary.join(", ")
                : "No allergies recorded"}
            </p>
            <p>Suggestion logic: {selectedAppointment.prescriptionSuggestions.rationale}</p>
            {selectedAppointment.prescriptionSuggestions.suggestions.length ? (
              selectedAppointment.prescriptionSuggestions.suggestions.map((item, index) => (
                <p key={`${selectedAppointment.id}-suggestion-${index}`}>
                  {item.blocked ? "Blocked" : "Suggested"}: {item.name} {item.dosage} | {item.schedule} | {item.reason}
                  {item.conflictReason ? ` ${item.conflictReason}` : ""}
                </p>
              ))
            ) : (
              <p>No medication suggestions available yet for this issue.</p>
            )}
            {selectedAppointment.prescriptionSuggestions.cautions.map((item, index) => (
              <p key={`${selectedAppointment.id}-caution-${index}`}>Caution: {item}</p>
            ))}
            <p>Tip: press Tab inside the prescription fields to accept the suggested preview.</p>
            <button type="button" className="ghost" onClick={useSuggestedDraft}>Use suggested draft</button>
          </div>
        ) : null}
        <textarea rows={4} placeholder="Diagnosis notes" value={prescriptionForm.diagnosis} onChange={(e) => setPrescriptionForm({ ...prescriptionForm, diagnosis: e.target.value })} onKeyDown={(e) => handleAutocompleteKeyDown(e, "diagnosis")} />
        {diagnosisPreview ? <p className="muted">Tab to autocomplete: {diagnosisPreview}</p> : null}
        <textarea rows={4} placeholder="Doctor notes" value={prescriptionForm.doctorNotes} onChange={(e) => setPrescriptionForm({ ...prescriptionForm, doctorNotes: e.target.value })} onKeyDown={(e) => handleAutocompleteKeyDown(e, "doctorNotes")} />
        {doctorNotesPreview ? <p className="muted">Tab to autocomplete: {doctorNotesPreview}</p> : null}
        <div className="prescription-grid prescription-grid-header">
          <span>Tablet Name</span>
          <span>Dosage</span>
          <span>Timing</span>
          <span>Food</span>
          <span>Action</span>
        </div>
        {medicationRows.map((row, index) => {
          const preview = medicinePreview(row.name);
          const matches = getMedicineMatches(row.name);
          return (
            <div className="prescription-grid prescription-grid-row" key={`med-row-${index}`}>
              <div className="medicine-cell">
                <input
                  placeholder="Tablet name"
                  value={row.name}
                  onChange={(e) => updateMedicationRow(index, { name: e.target.value })}
                  onKeyDown={(event) => {
                    if (event.key === "Tab" && preview) {
                      event.preventDefault();
                      acceptMedicinePreview(index);
                    }
                  }}
                />
                {preview ? <p className="muted">Tab to autocomplete: {preview}</p> : null}
                {matches.length ? (
                  <div className="autocomplete-list">
                    {matches.map((item) => (
                      <button
                        key={`${index}-${item}`}
                        type="button"
                        className="autocomplete-item"
                        onClick={() => updateMedicationRow(index, { name: item })}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              <input
                placeholder="500mg / 1 tablet"
                value={row.dosage}
                onChange={(e) => updateMedicationRow(index, { dosage: e.target.value })}
              />
              <div className="timing-pills">
                {TIMING_OPTIONS.map((item) => (
                  <button
                    key={`${index}-${item.value}`}
                    type="button"
                    className={row.timing.includes(item.value) ? "ghost timing-pill active-pill" : "ghost timing-pill"}
                    onClick={() => toggleTiming(index, item.value)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <select
                value={row.foodRelation}
                onChange={(e) => updateMedicationRow(index, { foodRelation: e.target.value as MedicationRow["foodRelation"] })}
              >
                <option value="before_food">Before Food</option>
                <option value="after_food">After Food</option>
              </select>
              <button type="button" className="ghost" onClick={() => removeMedicationRow(index)}>
                Remove
              </button>
            </div>
          );
        })}
        <button type="button" className="ghost" onClick={addMedicationRow}>Add medicine row</button>
        <button disabled={dashboard.doctor.verification_status !== "verified"} onClick={savePrescription}>Store encrypted prescription</button>
      </section>
    </main>
  );
}
