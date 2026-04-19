"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

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
    doctorNotes: "",
    medicationsText: "Paracetamol | 650mg | 08:00,14:00,21:00"
  });
  const [message, setMessage] = useState("");

  const clinicMapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${Number(clinicForm.longitude) - 0.02}%2C${Number(clinicForm.latitude) - 0.02}%2C${Number(clinicForm.longitude) + 0.02}%2C${Number(clinicForm.latitude) + 0.02}&layer=mapnik&marker=${clinicForm.latitude}%2C${clinicForm.longitude}`;

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
      body: JSON.stringify(prescriptionForm)
    });
    if (!response) return;
    const data = await response.json();
    setMessage(data.message);
    await loadDashboard();
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
        <textarea rows={4} placeholder="Diagnosis notes" value={prescriptionForm.diagnosis} onChange={(e) => setPrescriptionForm({ ...prescriptionForm, diagnosis: e.target.value })} />
        <textarea rows={4} placeholder="Doctor notes" value={prescriptionForm.doctorNotes} onChange={(e) => setPrescriptionForm({ ...prescriptionForm, doctorNotes: e.target.value })} />
        <textarea rows={5} placeholder="One medication per line: name | dosage | schedule" value={prescriptionForm.medicationsText} onChange={(e) => setPrescriptionForm({ ...prescriptionForm, medicationsText: e.target.value })} />
        <button disabled={dashboard.doctor.verification_status !== "verified"} onClick={savePrescription}>Store encrypted prescription</button>
      </section>
    </main>
  );
}
