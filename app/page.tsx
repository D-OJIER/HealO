"use client";

import { useEffect, useRef, useState } from "react";
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

  const featureRef = useRef<HTMLElement | null>(null);

  const [activeAuth, setActiveAuth] =
    useState<"login" | "patient" | "doctor">(
      "login"
    );

  const [patientForm, setPatientForm] =
    useState<FormState>(emptyForm);

  const [doctorForm, setDoctorForm] =
    useState<FormState>(emptyForm);

  const [login, setLogin] = useState({
    email: "",
    password: ""
  });

  const [message, setMessage] = useState(
    "Secure access for patients and verified doctors."
  );

  useEffect(() => {

    async function loadSession() {

      const response =
        await fetch("/api/auth/session");

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

  async function submitRegister(
    role: "patient" | "doctor",
    form: FormState
  ) {

    const response =
      await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          role,
          name: form.name,
          email: form.email,
          password: form.password,
          phone: form.phone,
          registrationNumber:
            form.registrationNumber
        })
      });

    const data = await response.json();

    setMessage(
      [data.error || data.message, data.details]
        .filter(Boolean)
        .join(" ")
    );
  }

  async function submitLogin() {

    const response =
      await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(login)
      });

    const data = await response.json();

    if (!response.ok) {
      setMessage(data.error || "Login failed.");
      return;
    }

    const sessionResponse =
      await fetch("/api/auth/session");

    const sessionData =
      await sessionResponse.json();

    if (!sessionData.user) {
      setMessage("Profile record not found.");
      return;
    }

    router.push(
      sessionData.user.role === "patient"
        ? "/patient"
        : "/doctor"
    );
  }

  return (

    <main className="shell">

      {/* HERO */}

      <section className="hero">

        <div className="hero-left">

          <span className="hero-pill">
            🧠 AI Powered Healthcare
          </span>

          <h1>
            Smarter Clinics.
            <br />
            Better Patient Care.
          </h1>

          <p className="hero-description">

            Modern healthcare management platform
            with AI recommendations, verified
            doctors, appointment scheduling,
            and encrypted digital prescriptions.

          </p>

          <div className="hero-buttons">

            <button
              className="primary-btn"
              onClick={() =>
                router.push("/auth")
              }
            >
              Get Started
            </button>

            <button
              className="secondary-btn"
              onClick={() =>
                featureRef.current?.scrollIntoView({
                  behavior: "smooth"
                })
              }
            >
              Explore Platform
            </button>

          </div>

          <div className="stats-grid">

            <div className="stat-card">
              <h3>24/7</h3>
              <p>Appointments</p>
            </div>

            <div className="stat-card">
              <h3>120+</h3>
              <p>Doctors</p>
            </div>

            <div className="stat-card">
              <h3>15+</h3>
              <p>Clinics</p>
            </div>

            <div className="stat-card">
              <h3>500+</h3>
              <p>Patients</p>
            </div>

          </div>

        </div>

        {/* RIGHT SIDE */}

        <div className="hero-right">

          <div className="floating-card ai-card">

            <div className="card-top">

              <span className="online-dot"></span>

              AI Assistant Active

            </div>

            <h3>
              Smart symptom analysis completed
            </h3>

            <p>
              Recommended specialist:
              <strong> Cardiologist</strong>
            </p>

            <div className="ai-tags">

              <span>AI Recommendation</span>

              <span>Verified Match</span>

            </div>

          </div>

          <div className="floating-card doctor-card">

            <div className="doctor-header">

              <div className="doctor-avatar">
                DR
              </div>

              <div>

                <h4>
                  Dr. Sarah Williams
                </h4>

                <p>Cardiologist</p>

              </div>

            </div>

            <div className="doctor-meta">

              <span>Verified</span>

              <span>Available Today</span>

            </div>

          </div>

          <div className="floating-card analytics-card">

            <h4>Today's Activity</h4>

            <div className="activity-list">

              <div className="activity-item">
                <span className="activity-dot"></span>
                12 appointments scheduled
              </div>

              <div className="activity-item">
                <span className="activity-dot"></span>
                8 prescriptions generated
              </div>

              <div className="activity-item">
                <span className="activity-dot"></span>
                5 doctors available online
              </div>

            </div>

          </div>

        </div>

      </section>

      {/* FEATURES */}

      <section
        className="feature-section"
        ref={featureRef}
      >

        <div className="feature-heading">

          <span className="small-badge">
            🚀 Explore Platform
          </span>

          <h2>
            Everything Your Clinic
            <br />
            Needs In One Platform
          </h2>

          <p>

            Built for modern healthcare teams,
            doctors, and patients.

          </p>

        </div>

        <div className="feature-grid">

          <div className="feature-box">
            <span>🧠</span>
            <h4>AI Recommendations</h4>
            <p>
              Smart doctor and symptom matching.
            </p>
          </div>

          <div className="feature-box">
            <span>🔒</span>
            <h4>Secure Records</h4>
            <p>
              Encrypted healthcare data system.
            </p>
          </div>

          <div className="feature-box">
            <span>📅</span>
            <h4>Appointments</h4>
            <p>
              Real-time clinic scheduling workflow.
            </p>
          </div>

          <div className="feature-box">
            <span>💊</span>
            <h4>Prescriptions</h4>
            <p>
              Secure digital prescription management.
            </p>
          </div>

        </div>

      </section>

    </main>
  );
}