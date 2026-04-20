"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Coordinates = { lat: number; lng: number };
type MedicationView = {
  name: string;
  dosage: string;
  timing: Array<"morning" | "afternoon" | "evening" | "night">;
  foodRelation: "before_food" | "after_food";
  schedule?: string;
};

type Dashboard = {
  patient: { name: string; emailMasked: string; phoneMasked: string };
  doctorDirectory: {
    specialty: string;
    rationale: string;
    urgency: string;
    doctors: Array<{
      id: string;
      doctorProfileId: string;
      name: string;
      specialty: string;
      clinicName: string;
      address: string;
      nextSlotId: string | null;
      nextSlotStart: string | null;
      directionsUrl: string;
      mapEmbedUrl: string;
      weightedRating: number;
      reviewCount: number;
      distanceKm: number | null;
      whyRecommended: string;
      consultationFee: number;
      languages: string[];
      experienceYears: number;
      bio: string;
      clinics: Array<{
        clinicId: string;
        clinicName: string;
        address: string;
        distanceKm: number | null;
        directionsUrl: string;
        mapEmbedUrl: string;
        availableSlots: Array<{
          id: string;
          start: string;
          end: string;
        }>;
      }>;
    }>;
  };
  appointments: Array<{
    id: string;
    doctorName: string;
    specialty: string;
    status: string;
    slotStart: string | null;
    symptoms: string;
  }>;
  prescriptions: Array<{
    id: string;
    doctorName: string;
    prescribedAt: string;
    consultationAt: string | null;
    diagnosis: string;
    medications: MedicationView[];
    notes: string;
  }>;
  reminders: Array<{ id: string; medication_name: string; schedule: string; enabled: boolean }>;
};

function formatMedicationTiming(item: MedicationView) {
  const timing = item.timing.map((slot) => `${slot.charAt(0).toUpperCase()}${slot.slice(1)}`).join(", ");
  return `${timing} | ${item.foodRelation === "before_food" ? "Before Food" : "After Food"}`;
}

export default function PatientPage() {
  const router = useRouter();
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [symptoms, setSymptoms] = useState("");
  const [aiResult, setAiResult] = useState<Dashboard["doctorDirectory"] | null>(null);
  const [slotId, setSlotId] = useState("");
  const [symptomId, setSymptomId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [location, setLocation] = useState<Coordinates | null>(null);
  const [loadingError, setLoadingError] = useState("");
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>("");
  const [selectedClinicId, setSelectedClinicId] = useState<string>("");

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

  async function loadDashboard(coords?: Coordinates | null) {
    const search = coords ? `?lat=${coords.lat}&lng=${coords.lng}` : "";
    const response = await authedFetch(`/api/patient/dashboard${search}`);
    if (!response) return;
    const text = await response.text();
    const data = text ? JSON.parse(text) : null;
    if (!response.ok || !data) {
      setLoadingError(data?.error || "Unable to load patient dashboard.");
      return;
    }
    setLoadingError("");
    setDashboard(data);
    const defaultDoctor = data.doctorDirectory.doctors[0];
    setSelectedDoctorId(defaultDoctor?.id || "");
    setSelectedClinicId(defaultDoctor?.clinics[0]?.clinicId || "");
    setSlotId(defaultDoctor?.clinics[0]?.availableSlots[0]?.id || "");
  }

  useEffect(() => {
    if (!navigator.geolocation) {
      loadDashboard(null);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        setLocation(coords);
        loadDashboard(coords);
      },
      () => {
        loadDashboard(null);
      }
    );
  }, []);

  async function analyzeSymptoms() {
    const response = await authedFetch("/api/patient/analyze", {
      method: "POST",
      body: JSON.stringify({
        symptoms,
        lat: location?.lat,
        lng: location?.lng
      })
    });
    if (!response) return;
    const text = await response.text();
    const data = text ? JSON.parse(text) : null;
    if (!response.ok || !data) {
      setMessage(data?.error || "Unable to analyze symptoms right now.");
      return;
    }
    setAiResult({
      specialty: data.specialty,
      rationale: data.rationale,
      urgency: data.urgency,
      doctors: data.doctors
    });
    setSymptomId(data.symptomId);
    setSelectedDoctorId(data.doctors[0]?.id || "");
    setSelectedClinicId(data.doctors[0]?.clinics[0]?.clinicId || "");
    setSlotId(data.doctors[0]?.clinics[0]?.availableSlots[0]?.id || "");
  }

  async function bookAppointment() {
    const response = await authedFetch("/api/patient/appointments", {
      method: "POST",
      body: JSON.stringify({ symptoms, slotId, symptomId })
    });
    if (!response) return;
    const text = await response.text();
    const data = text ? JSON.parse(text) : null;
    setMessage(data.error || data.message);
    await loadDashboard(location);
  }

  if (!dashboard) {
    return (
      <main className="shell">
        <p>{loadingError || "Loading patient workspace..."}</p>
      </main>
    );
  }

  const doctorDirectory = aiResult || dashboard.doctorDirectory;
  const doctorCards = doctorDirectory.doctors;
  const selectedDoctor =
    doctorCards.find((doctor) => doctor.id === selectedDoctorId) || doctorCards[0] || null;
  const selectedClinic =
    selectedDoctor?.clinics.find((clinic) => clinic.clinicId === selectedClinicId) ||
    selectedDoctor?.clinics[0] ||
    null;

  return (
    <main className="shell">
      <section className="topbar">
        <div>
          <span className="pill">Patient Dashboard</span>
          <h1>Welcome, {dashboard.patient.name}</h1>
          <p className="muted">
            Masked identity view: {dashboard.patient.emailMasked} | {dashboard.patient.phoneMasked}
          </p>
        </div>
        <button onClick={async () => {
          await fetch("/api/auth/logout", { method: "POST" });
          router.push("/");
        }}>
          Logout
        </button>
      </section>

      <section className="grid-two">
        <article className="panel">
          <h2>AI Symptom Analysis</h2>
          <textarea
            rows={5}
            placeholder="Describe your symptoms for AI triage..."
            value={symptoms}
            onChange={(e) => setSymptoms(e.target.value)}
          />
          <button onClick={analyzeSymptoms}>Analyze symptoms</button>
          {doctorDirectory ? (
            <div className="callout">
              <strong>Suggested specialty:</strong> {doctorDirectory.specialty}
              <p>{doctorDirectory.rationale}</p>
              <p>Urgency: {doctorDirectory.urgency}</p>
            </div>
          ) : null}
        </article>

        <article className="panel accent">
          <h2>Booking Flow</h2>
          <p>1. Pick a doctor</p>
          <p>2. Choose the clinic that suits you</p>
          <p>3. Select a slot from that clinic</p>
          <select
            value={slotId}
            onChange={(e) => setSlotId(e.target.value)}
            disabled={!selectedClinic}
          >
            <option value="">Choose an available slot</option>
            {(selectedClinic?.availableSlots || []).map((slot) => (
              <option key={slot.id} value={slot.id}>
                {new Date(slot.start).toLocaleString()}
              </option>
            ))}
          </select>
          <button onClick={bookAppointment} disabled={!slotId || !symptoms}>
            Submit booking request
          </button>
          <p className="muted">{message || "Bookings begin in pending state until the doctor reviews them."}</p>
        </article>
      </section>

      <section className="panel">
        <h2>Search & Browse Doctors</h2>
        <div className="cards">
          {doctorCards.map((doctor) => (
            <button
              className="card select-card"
              key={doctor.id}
              onClick={() => {
                setSelectedDoctorId(doctor.id);
                setSelectedClinicId(doctor.clinics[0]?.clinicId || "");
                setSlotId(doctor.clinics[0]?.availableSlots[0]?.id || "");
              }}
            >
              <h3>{doctor.name}</h3>
              <p>{doctor.specialty}</p>
              <p>Weighted rating: {doctor.weightedRating.toFixed(1)} ({doctor.reviewCount} reviews)</p>
              <p>{doctor.distanceKm !== null ? `${doctor.distanceKm.toFixed(1)} km away` : "Distance unavailable"}</p>
              <p>{doctor.languages.join(", ")}</p>
              <p>{doctor.bio}</p>
            </button>
          ))}
        </div>
      </section>

      {selectedDoctor ? (
        <section className="panel">
          <h2>Doctor Detail</h2>
          <div className="grid-two">
            <article className="panel">
              <h3>{selectedDoctor.name}</h3>
              <p>{selectedDoctor.specialty}</p>
              <p>Fee: Rs. {selectedDoctor.consultationFee}</p>
              <p>Languages: {selectedDoctor.languages.join(", ")}</p>
              <p>Experience: {selectedDoctor.experienceYears} years</p>
              <p>Why this doctor: {selectedDoctor.whyRecommended}</p>
            </article>
            <article className="panel accent">
              <h3>Clinic Selection</h3>
              <div className="cards">
                {selectedDoctor.clinics.map((clinic) => (
                  <button
                    className="card select-card"
                    key={clinic.clinicId}
                    onClick={() => {
                      setSelectedClinicId(clinic.clinicId);
                      setSlotId(clinic.availableSlots[0]?.id || "");
                    }}
                  >
                    <h4>{clinic.clinicName}</h4>
                    <p>{clinic.address}</p>
                    <p>{clinic.distanceKm !== null ? `${clinic.distanceKm.toFixed(1)} km away` : "Distance unavailable"}</p>
                    <p>{clinic.availableSlots.length} slots available</p>
                    {clinic.mapEmbedUrl ? (
                      <iframe
                        className="map-frame"
                        src={clinic.mapEmbedUrl}
                        loading="lazy"
                        referrerPolicy="no-referrer-when-downgrade"
                      />
                    ) : null}
                  </button>
                ))}
              </div>
            </article>
          </div>
          {selectedClinic ? (
            <article className="panel">
              <h3>Available Slots at {selectedClinic.clinicName}</h3>
              <div className="cards">
                {selectedClinic.availableSlots.map((slot) => (
                  <button
                    className={`card select-card${slotId === slot.id ? " selected-card" : ""}`}
                    key={slot.id}
                    onClick={() => setSlotId(slot.id)}
                  >
                    <p>{new Date(slot.start).toLocaleString()}</p>
                    <p>Ends {new Date(slot.end).toLocaleTimeString()}</p>
                  </button>
                ))}
              </div>
              <a href={selectedClinic.directionsUrl} target="_blank" rel="noreferrer">
                Open navigation for this clinic
              </a>
            </article>
          ) : null}
        </section>
      ) : null}

      <section className="grid-two">
        <article className="panel">
          <h2>Appointments</h2>
          <div className="cards">
            {dashboard.appointments.map((appointment) => (
              <div className="card" key={appointment.id}>
                <h3>{appointment.doctorName}</h3>
                <p>{appointment.specialty}</p>
                <p>Status: {appointment.status}</p>
                <p>{appointment.slotStart ? new Date(appointment.slotStart).toLocaleString() : "Time unavailable"}</p>
                <p>Symptoms: {appointment.symptoms}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="panel">
          <h2>Prescriptions & Reminders</h2>
          <div className="cards">
            {dashboard.prescriptions.map((prescription) => (
              <div className="card" key={prescription.id}>
                <h3>{prescription.doctorName}</h3>
                <p>Visit: {new Date(prescription.consultationAt || prescription.prescribedAt).toLocaleString()}</p>
                <p>Diagnosis: {prescription.diagnosis}</p>
                <p>Notes: {prescription.notes}</p>
                <div className="prescription-table">
                  <div className="prescription-table-row prescription-table-head">
                    <strong>Tablet Name</strong>
                    <strong>Dosage</strong>
                    <strong>Timing</strong>
                  </div>
                  {prescription.medications.map((item, index) => (
                    <div className="prescription-table-row" key={`${prescription.id}-${index}`}>
                      <span>{item.name}</span>
                      <span>{item.dosage}</span>
                      <span>{formatMedicationTiming(item)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {dashboard.reminders.map((reminder) => (
              <div className="card" key={reminder.id}>
                <h3>{reminder.medication_name}</h3>
                <p>Schedule: {reminder.schedule}</p>
                <p>{reminder.enabled ? "Reminders active" : "Reminder disabled"}</p>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="panel">
        <h2>Consultation History</h2>
        <div className="cards">
          {dashboard.prescriptions.map((prescription) => (
            <article className="card" key={`history-${prescription.id}`}>
              <h3>{prescription.doctorName}</h3>
              <p>When: {new Date(prescription.consultationAt || prescription.prescribedAt).toLocaleString()}</p>
              <p>Whom: {prescription.doctorName}</p>
              <p>Why: {prescription.diagnosis}</p>
              <div className="prescription-table">
                <div className="prescription-table-row prescription-table-head">
                  <strong>Tablet Name</strong>
                  <strong>Dosage</strong>
                  <strong>Timing</strong>
                </div>
                {prescription.medications.map((item, index) => (
                  <div className="prescription-table-row" key={`history-med-${prescription.id}-${index}`}>
                    <span>{item.name}</span>
                    <span>{item.dosage}</span>
                    <span>{formatMedicationTiming(item)}</span>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
