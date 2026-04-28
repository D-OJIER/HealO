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
       <button
  className="logout-btn"
  onClick={async () => {
    await fetch("/api/auth/logout", {
      method: "POST"
    });

    router.push("/");
  }}
>
  Logout
</button>
      </section>

      <section className="hero-grid">

  {/* LEFT AI PANEL */}

  <article className="ai-panel">

    <div className="hero-heading">

      <span className="hero-badge">
        AI Powered
      </span>

      <h2>
        AI Symptom Analysis
      </h2>

      <p className="hero-subtext">

        Describe symptoms and receive
        AI-assisted recommendations
        for the right specialist.

      </p>

    </div>

    <textarea
      rows={5}
      placeholder="Describe your symptoms for AI triage..."
      value={symptoms}
      onChange={(e) =>
        setSymptoms(e.target.value)
      }
    />

    <button onClick={analyzeSymptoms}>
      Analyze Symptoms
    </button>

    {doctorDirectory ? (

      <div className="ai-result">

        <div className="result-top">

          <strong>
            Suggested Specialty
          </strong>

          <span className="urgency-pill">
            {doctorDirectory.urgency}
          </span>

        </div>

        <h4>
          {doctorDirectory.specialty}
        </h4>

        <p>
          {doctorDirectory.rationale}
        </p>

      </div>

    ) : null}

  </article>

  {/* RIGHT BOOKING PANEL */}

  <article className="booking-panel">

    <div className="booking-header">

      <span className="hero-badge dark">
        Quick Booking
      </span>

      <h2>
        Booking Flow
      </h2>

    </div>

    <div className="booking-steps">

      <div className="booking-step">

        <span>1</span>

        <p>
          Select doctor
        </p>

      </div>

      <div className="booking-step">

        <span>2</span>

        <p>
          Choose clinic
        </p>

      </div>

      <div className="booking-step">

        <span>3</span>

        <p>
          Confirm slot
        </p>

      </div>

    </div>

    <select
      value={slotId}
      onChange={(e) =>
        setSlotId(e.target.value)
      }
      disabled={!selectedClinic}
    >

      <option value="">
        Choose an available slot
      </option>

      {(selectedClinic?.availableSlots || []).map((slot) => (

        <option
          key={slot.id}
          value={slot.id}
        >

          {new Date(slot.start).toLocaleString()}

        </option>

      ))}

    </select>

    <button
      onClick={bookAppointment}
      disabled={!slotId || !symptoms}
    >
      Submit Booking
    </button>

    <p className="booking-note">

      Appointments remain pending
      until reviewed by the doctor.

    </p>

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
              
              <p>{doctor.distanceKm !== null ? `${doctor.distanceKm.toFixed(1)} km away` : "Distance unavailable"}</p>
              <p>{doctor.languages.join(", ")}</p>
              <p>{doctor.bio}</p>
            </button>
          ))}
        </div>
      </section>

     {selectedDoctor ? (

  <section className="doctor-showcase">

    {/* LEFT SIDE */}

    <div className="doctor-profile-card">

      <div className="doctor-profile-top">

        <div className="doctor-avatar">

          {selectedDoctor.name.charAt(4)}

        </div>

        <div>

          <h2>
            {selectedDoctor.name}
          </h2>

          <p className="doctor-speciality">
            {selectedDoctor.specialty}
          </p>

        </div>

      </div>

      <div className="doctor-stats-row">

        <div>

          <span>
            Experience
          </span>

          <strong>
            {selectedDoctor.experienceYears}+ yrs
          </strong>

        </div>

        <div>

          <span>
            Consultation
          </span>

          <strong>
            ₹ {selectedDoctor.consultationFee}
          </strong>

        </div>

        <div>

          <span>
            Distance
          </span>

          <strong>

            {
              selectedDoctor.distanceKm !== null
              ? `${selectedDoctor.distanceKm.toFixed(1)} km`
              : "N/A"
            }

          </strong>

        </div>

      </div>

      <div className="doctor-about">

        <h4>
          About Doctor
        </h4>

        <p>
          {selectedDoctor.bio}
        </p>

      </div>

      <div className="doctor-tags">

        {selectedDoctor.languages.map((lang) => (

          <span key={lang}>
            {lang}
          </span>

        ))}

      </div>

    </div>

    {/* RIGHT SIDE */}

    <div className="clinic-side">

      <div className="clinic-side-top">

        <h3>
          Clinic Selection
        </h3>

        <p>
          Select your preferred clinic
        </p>

      </div>

      <div className="clinic-layout">

        {selectedDoctor.clinics.map((clinic) => (

          <button
            className={`clinic-card ${
              selectedClinicId === clinic.clinicId
                ? "clinic-active"
                : ""
            }`}
            key={clinic.clinicId}
            onClick={() => {

              setSelectedClinicId(
                clinic.clinicId
              );

              setSlotId(
                clinic.availableSlots[0]?.id || ""
              );

            }}
          >

            <div className="clinic-card-top">

              <div>

                <h4>
                  {clinic.clinicName}
                </h4>

                <p>
                  {clinic.address}
                </p>

              </div>

              <span>

                {
                  clinic.distanceKm !== null
                  ? `${clinic.distanceKm.toFixed(1)} km`
                  : "N/A"
                }

              </span>

            </div>

            <div className="clinic-bottom">

              <span>
                {clinic.availableSlots.length} slots available
              </span>

            </div>

          </button>

        ))}

      </div>

      {selectedClinic?.mapEmbedUrl ? (

        <iframe
          className="premium-map"
          src={selectedClinic.mapEmbedUrl}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />

      ) : null}

    </div>

    {/* AVAILABLE SLOTS */}

    {selectedClinic ? (

      <div className="slot-panel">

        <div className="slot-panel-top">

          <div>

            <p className="eyebrow">
              AVAILABLE TIME SLOTS
            </p>

            <h2>
              {selectedClinic.clinicName}
            </h2>

          </div>

          <a
            href={selectedClinic.directionsUrl}
            target="_blank"
            rel="noreferrer"
            className="nav-btn"
          >
            Open Navigation
          </a>

        </div>

        <div className="slot-grid-modern">

          {selectedClinic.availableSlots.map((slot) => (

            <button
              key={slot.id}
              className={`slot-modern ${
                slotId === slot.id
                  ? "slot-modern-active"
                  : ""
              }`}
              onClick={() => setSlotId(slot.id)}
            >

              <strong>

                {
                  new Date(
                    slot.start
                  ).toLocaleTimeString([], {
                    hour:"2-digit",
                    minute:"2-digit"
                  })
                }

              </strong>

              <span>

                {
                  new Date(
                    slot.start
                  ).toLocaleDateString()
                }

              </span>

            </button>

          ))}

        </div>

      </div>

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
