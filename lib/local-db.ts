import fs from "fs";
import path from "path";
import crypto from "crypto";
import seedDb from "@/data/local-db.json";
import type { LocalDatabase } from "@/lib/types";

const DB_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DB_DIR, "local-db.json");

export function makeId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function createSeedDatabase(): LocalDatabase {
  return structuredClone(seedDb) as LocalDatabase;
}

function mergeById<T extends { id: string }>(target: T[], seed: T[]) {
  const existingIds = new Set(target.map((item) => item.id));
  for (const row of seed) {
    if (!existingIds.has(row.id)) {
      target.push(row);
    }
  }
}

function mergeDoctorClinics(target: LocalDatabase["doctor_clinics"], seed: LocalDatabase["doctor_clinics"]) {
  const existing = new Set(target.map((item) => `${item.doctor_id}:${item.clinic_id}`));
  for (const row of seed) {
    const key = `${row.doctor_id}:${row.clinic_id}`;
    if (!existing.has(key)) {
      target.push(row);
    }
  }
}

function normalizeDb(db: LocalDatabase) {
  const seed = createSeedDatabase();

  mergeById(db.auth_users, seed.auth_users);
  mergeById(db.users, seed.users);
  mergeById(db.registered_doctors, seed.registered_doctors);
  mergeById(db.doctors, seed.doctors);
  mergeById(db.clinics, seed.clinics);
  mergeDoctorClinics(db.doctor_clinics, seed.doctor_clinics);
  mergeById(db.doctor_slots, seed.doctor_slots);
  mergeById(db.symptoms, seed.symptoms);
  mergeById(db.allergies, seed.allergies);
  mergeById(db.appointments as Array<{ id: string } & Record<string, unknown>>, seed.appointments as Array<{ id: string } & Record<string, unknown>>);
  mergeById(db.prescriptions, seed.prescriptions);
  mergeById(db.reviews, seed.reviews);
  mergeById(db.medication_reminders, seed.medication_reminders);

  for (const appointment of db.appointments) {
    const mutableAppointment = appointment as Record<string, unknown>;
    if (!("patient_arrived_at" in mutableAppointment)) {
      mutableAppointment.patient_arrived_at = null;
    }
  }

  return db;
}

function ensureDbFile() {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }

  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(createSeedDatabase(), null, 2), "utf8");
  }
}

export function readDb(): LocalDatabase {
  ensureDbFile();
  const parsed = JSON.parse(fs.readFileSync(DB_FILE, "utf8")) as Partial<LocalDatabase>;
  if (!parsed.users || !parsed.doctors || !parsed.auth_users) {
    const seeded = createSeedDatabase();
    writeDb(seeded);
    return seeded;
  }

  if (!parsed.allergies) {
    parsed.allergies = [];
  }

  const normalized = normalizeDb(parsed as LocalDatabase);
  writeDb(normalized);
  return normalized;
}

export function writeDb(db: LocalDatabase) {
  ensureDbFile();
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), "utf8");
}

export function updateDb<T>(updater: (db: LocalDatabase) => T): T {
  const db = readDb();
  const result = updater(db);
  writeDb(db);
  return result;
}
