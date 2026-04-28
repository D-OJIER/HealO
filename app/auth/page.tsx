"use client";

import { useState } from "react";

export default function AuthPage() {

  const [role, setRole] =
    useState("patient");

  const [mode, setMode] =
    useState("signup");

  const [loading, setLoading] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    registrationId: ""
  });

  async function handleSubmit() {

    setLoading(true);
    setMessage("");

    try {

      const endpoint =
        mode === "signup"
          ? "/api/auth/register"
          : "/api/auth/login";

      const response = await fetch(endpoint, {
        method: "POST",

        headers: {
          "Content-Type": "application/json"
        },

        body: JSON.stringify({
          role,
          name: form.name,
          email: form.email,
          phone: form.phone,
          password: form.password,
          trustedRegistrationNumber:
            form.registrationId
        })
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error || "Something went wrong");
        setLoading(false);
        return;
      }

      setMessage(data.message || "Success");

      // LOGIN REDIRECTS
      if (mode === "login") {

        if (data.user.role === "doctor") {
          window.location.href = "/doctor";
        } else {
          window.location.href = "/patient";
        }

      }

      // AUTO SWITCH TO LOGIN AFTER SIGNUP
      if (mode === "signup") {

        setTimeout(() => {
          setMode("login");
        }, 1500);

      }

    } catch (error) {

      console.error(error);

      setMessage("Server error");

    }

    setLoading(false);
  }

  return (

    <main className="neo-auth-page">

      {/* LEFT */}

      <section className="neo-left">

        <div className="neo-overlay"></div>

        <span className="neo-badge">
          🧠 AI Healthcare Platform
        </span>

        <h1>
          Healthcare
          <br />
          Reimagined
        </h1>

        <p>

          Smart clinic management with AI-powered
          recommendations, secure digital records,
          appointment workflows, and verified doctors.

        </p>

        <div className="neo-stats">

          <div>
            <h3>24+</h3>
            <span>Clinics</span>
          </div>

          <div>
            <h3>120+</h3>
            <span>Doctors</span>
          </div>

          <div>
            <h3>10K+</h3>
            <span>Patients</span>
          </div>

        </div>

      </section>

      {/* RIGHT */}

      <section className="neo-right">

        <div className="neo-card">

          {/* ROLE SWITCH */}

          <div className="role-switch">

            <button
              className={
                role === "patient"
                  ? "active-role"
                  : ""
              }
              onClick={() =>
                setRole("patient")
              }
            >
              Patient
            </button>

            <button
              className={
                role === "doctor"
                  ? "active-role"
                  : ""
              }
              onClick={() =>
                setRole("doctor")
              }
            >
              Doctor
            </button>

          </div>

          {/* HEADER */}

          <div className="neo-header">

            <h2>
              {
                mode === "signup"
                  ? `Create ${role} account`
                  : "Welcome back"
              }
            </h2>

            <p>

              {
                mode === "signup"
                  ? "Secure onboarding for modern healthcare."
                  : "Login securely to continue."
              }

            </p>

          </div>

          {/* FORM */}

          <div className="neo-form">

            {mode === "signup" && (

              <input
                placeholder={
                  role === "doctor"
                    ? "Doctor name"
                    : "Full name"
                }

                value={form.name}

                onChange={(e) =>
                  setForm({
                    ...form,
                    name: e.target.value
                  })
                }
              />

            )}

            <input
              placeholder="Email address"

              value={form.email}

              onChange={(e) =>
                setForm({
                  ...form,
                  email: e.target.value
                })
              }
            />

            {mode === "signup" && (

              <input
                placeholder="Phone number"

                value={form.phone}

                onChange={(e) =>
                  setForm({
                    ...form,
                    phone: e.target.value
                  })
                }
              />

            )}

            <input
              type="password"
              placeholder="Password"

              value={form.password}

              onChange={(e) =>
                setForm({
                  ...form,
                  password: e.target.value
                })
              }
            />

            {
              role === "doctor"
              &&
              mode === "signup"
              && (

                <input
                  placeholder="Medical registration ID"

                  value={form.registrationId}

                  onChange={(e) =>
                    setForm({
                      ...form,
                      registrationId: e.target.value
                    })
                  }
                />

              )
            }

            <button
              className="neo-submit"
              onClick={handleSubmit}
            >

              {
                loading
                  ? "Processing..."
                  : mode === "signup"
                    ? role === "doctor"
                      ? "Register Doctor"
                      : "Create Account"
                    : "Login"
              }

            </button>

            {message && (
              <p
                style={{
                  marginTop: "15px",
                  color: "#2563eb",
                  fontWeight: 600
                }}
              >
                {message}
              </p>
            )}

          </div>

          {/* FOOTER */}

          <div className="neo-footer">

            {
              mode === "signup"
              ? (
                <p>

                  Already have an account?

                  <span
                    onClick={() =>
                      setMode("login")
                    }
                  >
                    Login
                  </span>

                </p>
              )
              : (
                <p>

                  Don’t have an account?

                  <span
                    onClick={() =>
                      setMode("signup")
                    }
                  >
                    Create one
                  </span>

                </p>
              )
            }

          </div>

        </div>

      </section>

    </main>
  );
} 