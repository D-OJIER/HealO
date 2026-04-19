import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { readDb, updateDb, makeId } from "@/lib/local-db";
import { hashPassword, sha256 } from "@/lib/security";
import type { DoctorProfile, Role, UserProfile } from "@/lib/types";

const SESSION_COOKIE = "clinic-session";

export function registerUser(input: {
  role: Role;
  name: string;
  email: string;
  password: string;
  phone: string;
  registrationNumber?: string;
}) {
  return updateDb((db) => {
    const existing = db.auth_users.find((user) => user.email.toLowerCase() === input.email.toLowerCase());
    if (existing) {
      throw new Error("Email already registered.");
    }

    const userId = makeId("user");
    const createdAt = new Date().toISOString();

    db.auth_users.push({
      id: userId,
      email: input.email,
      password_hash: hashPassword(input.password),
      created_at: createdAt
    });

    const profile: UserProfile = {
      id: userId,
      name: input.name,
      email: input.email,
      role: input.role,
      phone: input.phone,
      created_at: createdAt
    };

    db.users.push(profile);

    let doctor: DoctorProfile | null = null;
    if (input.role === "doctor") {
      const registrationHash = sha256(input.registrationNumber || "");
      const registry = db.registered_doctors.find(
        (item) =>
          item.registration_number_hash === registrationHash &&
          item.name.trim().toLowerCase() === input.name.trim().toLowerCase()
      );

      doctor = {
        id: makeId("doctor"),
        user_id: userId,
        specialty: registry?.specialty || null,
        verification_status: registry ? "verified" : "rejected",
        rating: registry ? 4.5 : 0,
        location_lat: null,
        location_lng: null,
        location_label: null,
        created_at: createdAt
      };
      db.doctors.push(doctor);
    }

    return { profile, doctor };
  });
}

export function loginUser(email: string, password: string) {
  return updateDb((db) => {
    const authUser = db.auth_users.find(
      (user) =>
        user.email.toLowerCase() === email.toLowerCase() &&
        user.password_hash === hashPassword(password)
    );

    if (!authUser) {
      throw new Error("Invalid credentials.");
    }

    const profile = db.users.find((user) => user.id === authUser.id);
    if (!profile) {
      throw new Error("User profile not found.");
    }

    const session = {
      id: makeId("session"),
      user_id: authUser.id,
      created_at: new Date().toISOString()
    };
    db.sessions = db.sessions.filter((item) => item.user_id !== authUser.id);
    db.sessions.push(session);

    return { profile, session };
  });
}

export async function logoutCurrentSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) {
    return;
  }

  updateDb((db) => {
    db.sessions = db.sessions.filter((session) => session.id !== token);
  });
}

export async function getCurrentProfile() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const db = readDb();

  if (!token) {
    return { db, authUser: null, profile: null as UserProfile | null };
  }

  const session = db.sessions.find((item) => item.id === token);
  if (!session) {
    return { db, authUser: null, profile: null as UserProfile | null };
  }

  const authUser = db.auth_users.find((item) => item.id === session.user_id) || null;
  const profile = db.users.find((item) => item.id === session.user_id) || null;

  return { db, authUser, profile };
}

export async function requireProfile() {
  const { db, authUser, profile } = await getCurrentProfile();
  if (!authUser || !profile) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    };
  }

  return {
    ok: true as const,
    db,
    authUser,
    profile
  };
}

export async function requireRole(role: Role) {
  const result = await requireProfile();
  if (!result.ok) {
    return result;
  }

  if (result.profile.role !== role && result.profile.role !== "admin") {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 })
    };
  }

  return result;
}

export async function getDoctorProfileForUser(userId: string) {
  const db = readDb();
  return db.doctors.find((doctor) => doctor.user_id === userId) || null;
}

export async function requireVerifiedDoctor() {
  const result = await requireRole("doctor");
  if (!result.ok) {
    return result;
  }

  const doctor = result.db.doctors.find((item) => item.user_id === result.profile.id) || null;
  if (!doctor) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Doctor profile not found." }, { status: 404 })
    };
  }

  if (doctor.verification_status !== "verified") {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Doctor verification required." }, { status: 403 })
    };
  }

  return {
    ok: true as const,
    db: result.db,
    profile: result.profile,
    doctor
  };
}
