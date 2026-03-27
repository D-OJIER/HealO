"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { UserRole } from "@/models/types";

export function AuthForm() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [role, setRole] = useState<UserRole>("patient");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [specialty, setSpecialty] = useState("General");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setStatus(null);

    if (mode === "signup") {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { name, role } },
      });

      if (error) {
        setStatus(error.message);
        setLoading(false);
        return;
      }

      const userId = data.user?.id;
      if (userId) {
        const { error: userErr } = await supabase.from("users").upsert({
          id: userId,
          name,
          email,
          role,
        });

        if (userErr) {
          setStatus(userErr.message);
          setLoading(false);
          return;
        }

        if (role === "doctor") {
          const { error: doctorErr } = await supabase.from("doctors").upsert({
            user_id: userId,
            specialty,
            rating: 4.8,
            available_slots: [],
          });

          if (doctorErr) {
            setStatus(doctorErr.message);
            setLoading(false);
            return;
          }
        }
      }
    } else {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setStatus(error.message);
        setLoading(false);
        return;
      }
    }

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data: profile } = await supabase.from("users").select("role").eq("id", user?.id).single();
    setLoading(false);
    setStatus("Authenticated.");

    if (profile?.role === "doctor") {
      router.push("/doctor");
    } else {
      router.push("/patient");
    }
    router.refresh();
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="flex gap-2 rounded-lg bg-zinc-100 p-1">
        <button
          type="button"
          onClick={() => setMode("signin")}
          className={`flex-1 rounded-md px-3 py-2 text-sm font-medium ${
            mode === "signin" ? "bg-white shadow" : "text-zinc-600"
          }`}
        >
          Sign In
        </button>
        <button
          type="button"
          onClick={() => setMode("signup")}
          className={`flex-1 rounded-md px-3 py-2 text-sm font-medium ${
            mode === "signup" ? "bg-white shadow" : "text-zinc-600"
          }`}
        >
          Sign Up
        </button>
      </div>

      {mode === "signup" && (
        <>
          <input
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Full Name"
            className="w-full rounded-lg border border-zinc-300 px-3 py-2"
          />
          <select
            value={role}
            onChange={(event) => setRole(event.target.value as UserRole)}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2"
          >
            <option value="patient">Patient</option>
            <option value="doctor">Doctor</option>
          </select>
          {role === "doctor" && (
            <input
              required
              value={specialty}
              onChange={(event) => setSpecialty(event.target.value)}
              placeholder="Specialty (e.g. Cardiology)"
              className="w-full rounded-lg border border-zinc-300 px-3 py-2"
            />
          )}
        </>
      )}

      <input
        required
        type="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="Email"
        className="w-full rounded-lg border border-zinc-300 px-3 py-2"
      />
      <input
        required
        type="password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        placeholder="Password"
        className="w-full rounded-lg border border-zinc-300 px-3 py-2"
      />
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-60"
      >
        {loading ? "Please wait..." : mode === "signup" ? "Create account" : "Sign in"}
      </button>
      {status && <p className="text-sm text-zinc-600">{status}</p>}
    </form>
  );
}
