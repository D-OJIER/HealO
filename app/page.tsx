"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type FormState = {
  name: string;
  email: string;
  password: string;
  phone: string;
  registrationNumber: string;
};

const emptyForm: FormState = {
  name: "",
  email: "",
  password: "",
  phone: "",
  registrationNumber: ""
};

export default function HomePage() {
  const router = useRouter();
  const [patientForm, setPatientForm] = useState<FormState>(emptyForm);
  const [doctorForm, setDoctorForm] = useState<FormState>(emptyForm);
  const [login, setLogin] = useState({ email: "", password: "" });
  const [message, setMessage] = useState("Create a patient or doctor account. Doctor verification is checked against your trusted registry in Supabase.");

  useEffect(() => {
    async function loadSession() {
      const response = await fetch("/api/auth/session");
      const data = await response.json();
      if (data.user?.role === "patient") {
        router.push("/patient");
      }
      if (data.user?.role === "doctor") {
        router.push("/doctor");
      }
    }

    loadSession();
  }, [router]);

  async function submitRegister(role: "patient" | "doctor", form: FormState) {
    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        role,
        name: form.name,
        email: form.email,
        password: form.password,
        phone: form.phone,
        registrationNumber: form.registrationNumber
      })
    });
    const data = await response.json();
    setMessage([data.error || data.message, data.details].filter(Boolean).join(" "));
  }

  async function submitLogin() {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(login)
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error || "Login failed.");
      return;
    }

    const sessionResponse = await fetch("/api/auth/session");
    const sessionData = await sessionResponse.json();
    if (!sessionData.user) {
      setMessage("Signed in, but the profile record was not found.");
      return;
    }

    router.push(sessionData.user.role === "patient" ? "/patient" : "/doctor");
  }

  return (
    <main className="shell">
      <section className="hero">
        <div>
          <span className="pill">Healthcare AI + Security</span>
          <h1>Clinic scheduling and e-prescriptions built around trust, privacy, and faster decisions.</h1>
          <p>
            Patients get symptom-guided doctor discovery and appointment booking. Verified doctors manage clinics,
            slots, diagnosis notes, and encrypted prescriptions.
          </p>
        </div>
        <div className="hero-card">
          <h3>Security model</h3>
          <ul>
            <li>Supabase Auth with role-based dashboards and RLS-backed APIs</li>
            <li>SHA-256 hashed doctor registry verification in database triggers</li>
            <li>AES-256 encrypted symptoms, diagnosis notes, and prescriptions</li>
            <li>PHI masking for analytics-friendly UI surfaces</li>
            <li>Gemini-powered specialty mapping and patient-history summaries</li>
          </ul>
        </div>
      </section>

      <section className="grid-two">
        <article className="panel">
          <h2>Patient Signup</h2>
          <input placeholder="Full name" value={patientForm.name} onChange={(e) => setPatientForm({ ...patientForm, name: e.target.value })} />
          <input placeholder="Email" value={patientForm.email} onChange={(e) => setPatientForm({ ...patientForm, email: e.target.value })} />
          <input placeholder="Phone" value={patientForm.phone} onChange={(e) => setPatientForm({ ...patientForm, phone: e.target.value })} />
          <input placeholder="Password" type="password" value={patientForm.password} onChange={(e) => setPatientForm({ ...patientForm, password: e.target.value })} />
          <button onClick={() => submitRegister("patient", patientForm)}>Create patient account</button>
        </article>

        <article className="panel">
          <h2>Doctor Signup</h2>
          <input placeholder="Doctor name" value={doctorForm.name} onChange={(e) => setDoctorForm({ ...doctorForm, name: e.target.value })} />
          <input placeholder="Email" value={doctorForm.email} onChange={(e) => setDoctorForm({ ...doctorForm, email: e.target.value })} />
          <input placeholder="Phone" value={doctorForm.phone} onChange={(e) => setDoctorForm({ ...doctorForm, phone: e.target.value })} />
          <input placeholder="Password" type="password" value={doctorForm.password} onChange={(e) => setDoctorForm({ ...doctorForm, password: e.target.value })} />
          <input
            placeholder="Trusted registration number"
            value={doctorForm.registrationNumber}
            onChange={(e) => setDoctorForm({ ...doctorForm, registrationNumber: e.target.value })}
          />
          <button onClick={() => submitRegister("doctor", doctorForm)}>Create doctor account</button>
        </article>
      </section>

      <section className="grid-two">
        <article className="panel">
          <h2>Unified Login</h2>
          <input placeholder="Email" value={login.email} onChange={(e) => setLogin({ ...login, email: e.target.value })} />
          <input
            placeholder="Password"
            type="password"
            value={login.password}
            onChange={(e) => setLogin({ ...login, password: e.target.value })}
          />
          <button onClick={submitLogin}>Login</button>
          <p className="muted">{message}</p>
        </article>

        <article className="panel accent">
          <h2>What this demo includes</h2>
          <ul>
            <li>AI symptom-to-specialty recommendations</li>
            <li>Verified doctor discovery with distance, map preview, and rationale</li>
            <li>Pending to accepted or rejected appointment flow</li>
            <li>Doctor-side AI summary of patient history</li>
            <li>Clinic map preview and batch slot generation for doctors</li>
            <li>Encrypted prescriptions with medication reminders</li>
          </ul>
        </article>
      </section>
    </main>
  );
}
