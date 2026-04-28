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
  const [activeTab, setActiveTab] =
  useState("dashboard");

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

  /* ========================================= */
/* CLEAN PROFESSIONAL DOCTOR DASHBOARD UI */
/* REPLACE ONLY THE RETURN PART */
/* inside doctor/page.tsx */
/* ========================================= */

return (
  <main className="shell doctor-layout">

    {/* SIDEBAR */}

    <aside className="doctor-sidebar">

      <div className="sidebar-logo">

        <div className="logo-circle">
          AI
        </div>

        <div>
          <h2>HealO Doctor</h2>
          <p className="muted">
            Smart Healthcare
          </p>
        </div>

      </div>

      <div className="sidebar-menu">

  <button
    className={
      activeTab === "dashboard"
        ? "sidebar-item sidebar-active"
        : "sidebar-item"
    }

    onClick={() =>
      setActiveTab("dashboard")
    }
  >
    📋 Dashboard
  </button>

  <button
    className={
      activeTab === "appointments"
        ? "sidebar-item sidebar-active"
        : "sidebar-item"
    }

    onClick={() =>
      setActiveTab("appointments")
    }
  >
    👨‍⚕️ Appointments
  </button>

  <button
    className={
      activeTab === "clinics"
        ? "sidebar-item sidebar-active"
        : "sidebar-item"
    }

    onClick={() =>
      setActiveTab("clinics")
    }
  >
    🏥 Clinics
  </button>

  <button
    className={
      activeTab === "slots"
        ? "sidebar-item sidebar-active"
        : "sidebar-item"
    }

    onClick={() =>
      setActiveTab("slots")
    }
  >
    📅 Slots
  </button>

  <button
    className="sidebar-item"

    onClick={async () => {

      await fetch("/api/auth/logout", {
        method: "POST"
      });

      router.push("/");
    }}
  >
    🚪 Logout
  </button>

</div>
    </aside>

    {/* MAIN */}

    <section className="doctor-main">

      {/* HERO */}

      <section className="doctor-hero">

        <div>

          <span className="pill">
            Verified Doctor
          </span>

          <h1>
            {dashboard.doctor.name}
          </h1>

          <p>

            {dashboard.doctor.specialty || "Specialist"}

            {" • "}

            {dashboard.doctor.verification_status}

          </p>

        </div>

      </section>

      {/* ANALYTICS */}

{activeTab === "dashboard" && (

  <section className="analytics-grid">

    <div className="analytics-card">

      <div className="analytics-top">
        <span>Total Clinics</span>
        <div className="analytics-icon">
          🏥
        </div>
      </div>

      <h3>
        {dashboard.metrics.clinicCount}
      </h3>

      <p className="analytics-sub">
        Registered clinic locations
      </p>

    </div>

    <div className="analytics-card">

      <div className="analytics-top">
        <span>Total Slots</span>
        <div className="analytics-icon">
          📅
        </div>
      </div>

      <h3>
        {dashboard.metrics.slotCount}
      </h3>

      <p className="analytics-sub">
        Active consultation slots
      </p>

    </div>

    <div className="analytics-card">

      <div className="analytics-top">
        <span>Average Rating</span>
        <div className="analytics-icon">
          ⭐
        </div>
      </div>

      <h3>
        {dashboard.metrics.averageRating}
      </h3>

      <p className="analytics-sub">
        Patient satisfaction score
      </p>

    </div>

    <div className="analytics-card">

      <div className="analytics-top">
        <span>Appointments</span>
        <div className="analytics-icon">
          👨‍⚕️
        </div>
      </div>

      <h3>
        {dashboard.appointments.length}
      </h3>

      <p className="analytics-sub">
        Total patient consultations
      </p>

    </div>

  </section>

)}
      {/* APPOINTMENTS */}

{activeTab === "appointments" && (

<section className="workspace">

  <div className="workspace-header">

    <div>

      <h2>
        Patient Appointments
      </h2>

      <p className="muted">
        Manage consultations, approvals, and AI-assisted summaries.
      </p>

    </div>

    <div className="pill">
      {dashboard.appointments.length} Active
    </div>

  </div>

  <div className="appointment-grid">

    {dashboard.slotBoard
      .filter((slot) => slot.appointment)
      .map((slot) => (

        <div
          className="appointment-card"
          key={slot.id}
        >

          {/* TOP */}

          <div className="patient-top">

            <div>

              <h3>
                {slot.appointment?.patientName}
              </h3>

              <p className="muted">
                {slot.clinicName}
              </p>

            </div>

            <span className="status-badge">
              {slot.appointment?.status}
            </span>

          </div>

          {/* META */}

          <div className="patient-meta">

            <p>
              📅 {" "}
              {new Date(
                slot.startTime
              ).toLocaleDateString()}
            </p>

            <p>
              ⏰ {" "}
              {new Date(
                slot.startTime
              ).toLocaleTimeString()}
            </p>

            <p>
              📞 {" "}
              {
                slot.appointment
                  ?.patientPhoneMasked
              }
            </p>

          </div>

          {/* SYMPTOMS */}

          <div className="symptom-box">

            <strong>
              Symptoms
            </strong>

            <p className="patient-symptom">

              {
                slot.appointment?.symptoms
              }

            </p>

          </div>

          {/* AI SUMMARY */}

          <div className="ai-preview">

            <strong>
              🤖 AI Medical Summary
            </strong>

            <p>

              {
                slot.appointment
                  ?.patientHistorySummary
                  .slice(0, 140)
              }...

            </p>

          </div>

          {/* ARRIVAL */}

          {
            slot.appointment?.hasArrived
            && (
              <div className="arrival-pill">
                ✅ Patient Arrived
              </div>
            )
          }

          {/* ACTIONS */}

          <div className="card-actions">

            <button
              className="accept-btn"

              onClick={() =>
                updateAppointment(
                  slot.appointment!.id,
                  "accepted"
                )
              }
            >
              Accept
            </button>

            <button
              className="reject-btn"

              onClick={() =>
                updateAppointment(
                  slot.appointment!.id,
                  "rejected"
                )
              }
            >
              Reject
            </button>

          </div>

        </div>

      ))}

  </div>

</section>

)}

      {/* CLINIC + SLOT */}

<section className="grid-two">

  {/* ========================= */}
  {/* CLINIC SECTION */}
  {/* ========================= */}

  {activeTab === "clinics" && (

    <article className="workspace">

      <div className="workspace-header">

        <div>

          <h2>
            Add Clinic
          </h2>

          <p className="muted">
            Register clinic locations for consultation and scheduling.
          </p>

        </div>

        <div className="pill">
          🏥 Clinic Setup
        </div>

      </div>

      <div className="slot-grid">

        <input
          placeholder="Clinic name"
          value={clinicForm.name}

          onChange={(e) =>
            setClinicForm({
              ...clinicForm,
              name: e.target.value
            })
          }
        />

        <input
          placeholder="Address"
          value={clinicForm.address}

          onChange={(e) =>
            setClinicForm({
              ...clinicForm,
              address: e.target.value
            })
          }
        />

        <input
          placeholder="Latitude"
          value={clinicForm.latitude}

          onChange={(e) =>
            setClinicForm({
              ...clinicForm,
              latitude: e.target.value
            })
          }
        />

        <input
          placeholder="Longitude"
          value={clinicForm.longitude}

          onChange={(e) =>
            setClinicForm({
              ...clinicForm,
              longitude: e.target.value
            })
          }
        />

      </div>

      {/* MAP */}

      <iframe
        className="map-frame"
        src={clinicMapUrl}
      />

      <div
        className="card-actions"
        style={{ marginTop: "24px" }}
      >

        <button
          className="accept-btn"
          onClick={addClinic}
        >
          Save Clinic
        </button>

        <button
          className="reject-btn"
          onClick={useCurrentLocation}
        >
          Use Current Location
        </button>

      </div>

    </article>

  )}

  {/* ========================= */}
  {/* SLOT SECTION */}
  {/* ========================= */}

  {activeTab === "slots" && (

    <article className="workspace">

      <div className="workspace-header">

        <div>

          <h2>
            Generate Slots
          </h2>

          <p className="muted">
            Create consultation schedules and appointment timings.
          </p>

        </div>

        <div className="pill">
          📅 Smart Scheduling
        </div>

      </div>

      <div className="slot-grid">

        <select
          value={slotForm.clinicId}

          onChange={(e) =>
            setSlotForm({
              ...slotForm,
              clinicId: e.target.value
            })
          }
        >

          <option value="">
            Choose clinic
          </option>

          {dashboard.clinics.map(
            (clinic) => (

              <option
                key={clinic.id}
                value={clinic.id}
              >
                {clinic.name}
              </option>

            )
          )}

        </select>

        <input
          type="date"
          value={slotForm.date}

          onChange={(e) =>
            setSlotForm({
              ...slotForm,
              date: e.target.value
            })
          }
        />

        <input
          type="time"
          value={slotForm.sessionStart}

          onChange={(e) =>
            setSlotForm({
              ...slotForm,
              sessionStart:
                e.target.value
            })
          }
        />

        <input
          type="time"
          value={slotForm.sessionEnd}

          onChange={(e) =>
            setSlotForm({
              ...slotForm,
              sessionEnd:
                e.target.value
            })
          }
        />

      </div>

      <div
        className="card-actions"
        style={{ marginTop: "24px" }}
      >

        <button
          className="accept-btn"
          onClick={addSlot}
        >
          Generate Slots
        </button>

      </div>

    </article>

  )}

</section>
    </section>

  </main>
);}
