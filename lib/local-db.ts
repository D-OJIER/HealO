import fs from "fs";
import path from "path";
import crypto from "crypto";
import { encryptJson, encryptPHI, hashPassword, sha256 } from "@/lib/security";
import type {
  Clinic,
  DoctorProfile,
  LocalDatabase,
  MedicationItem,
  UserProfile
} from "@/lib/types";

const DB_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DB_DIR, "local-db.json");

function nowIso() {
  return new Date().toISOString();
}

function future(hoursFromNow: number, durationMinutes: number) {
  const start = new Date(Date.now() + hoursFromNow * 60 * 60 * 1000);
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
  return {
    start: start.toISOString(),
    end: end.toISOString()
  };
}

export function makeId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function makeMedicationCipher(items: MedicationItem[]) {
  return { ciphertext: encryptJson(items) };
}

function createSeedDatabase(): LocalDatabase {
  const createdAt = nowIso();

  const users: UserProfile[] = [
    {
      id: "user-patient-riya",
      name: "Riya Sharma",
      email: "riya@testclinic.local",
      role: "patient",
      phone: "9876543210",
      created_at: createdAt
    },
    {
      id: "user-patient-aman",
      name: "Aman Verma",
      email: "aman@testclinic.local",
      role: "patient",
      phone: "9876500011",
      created_at: createdAt
    },
    {
      id: "user-patient-sana",
      name: "Sana Iqbal",
      email: "sana@testclinic.local",
      role: "patient",
      phone: "9876500022",
      created_at: createdAt
    },
    {
      id: "user-doctor-maya",
      name: "Dr. Maya Shah",
      email: "maya@doctor.local",
      role: "doctor",
      phone: "9000001001",
      created_at: createdAt
    },
    {
      id: "user-doctor-arjun",
      name: "Dr. Arjun Menon",
      email: "arjun@doctor.local",
      role: "doctor",
      phone: "9000002002",
      created_at: createdAt
    },
    {
      id: "user-doctor-nisha",
      name: "Dr. Nisha Rao",
      email: "nisha@doctor.local",
      role: "doctor",
      phone: "9000003003",
      created_at: createdAt
    }
  ];

  const doctors: DoctorProfile[] = [
    {
      id: "doctor-maya",
      user_id: "user-doctor-maya",
      specialty: "Cardiology",
      verification_status: "verified",
      rating: 4.8,
      location_lat: 13.0827,
      location_lng: 80.2707,
      location_label: "HeartCare Clinic",
      created_at: createdAt
    },
    {
      id: "doctor-arjun",
      user_id: "user-doctor-arjun",
      specialty: "Dermatology",
      verification_status: "verified",
      rating: 4.6,
      location_lat: 13.0604,
      location_lng: 80.2496,
      location_label: "SkinFirst Center",
      created_at: createdAt
    },
    {
      id: "doctor-nisha",
      user_id: "user-doctor-nisha",
      specialty: "General Medicine",
      verification_status: "verified",
      rating: 4.7,
      location_lat: 13.0487,
      location_lng: 80.2122,
      location_label: "WellSpring Family Clinic",
      created_at: createdAt
    }
  ];

  const clinics: Clinic[] = [
    {
      id: "clinic-heartcare",
      name: "HeartCare Clinic",
      address: "12 Residency Road, Chennai",
      location_lat: 13.0827,
      location_lng: 80.2707,
      created_at: createdAt
    },
    {
      id: "clinic-heartcare-south",
      name: "HeartCare South Wing",
      address: "18 T Nagar High Road, Chennai",
      location_lat: 13.0418,
      location_lng: 80.2337,
      created_at: createdAt
    },
    {
      id: "clinic-skinfirst",
      name: "SkinFirst Center",
      address: "44 MG Road, Chennai",
      location_lat: 13.0604,
      location_lng: 80.2496,
      created_at: createdAt
    },
    {
      id: "clinic-skinfirst-velachery",
      name: "SkinFirst Velachery",
      address: "21 Velachery Main Road, Chennai",
      location_lat: 12.9791,
      location_lng: 80.2212,
      created_at: createdAt
    },
    {
      id: "clinic-wellspring",
      name: "WellSpring Family Clinic",
      address: "7 Anna Nagar Main Road, Chennai",
      location_lat: 13.0487,
      location_lng: 80.2122,
      created_at: createdAt
    }
  ];

  const heart1 = future(24, 20);
  const heart2 = future(26, 20);
  const heart3 = future(50, 20);
  const skin1 = future(30, 20);
  const skin2 = future(54, 20);
  const skin3 = future(78, 20);
  const med1 = future(22, 20);
  const med2 = future(46, 20);
  const med3 = future(70, 20);
  const heartSouth1 = future(28, 20);
  const skinVel1 = future(32, 20);
  const past1 = future(-120, 20);
  const past2 = future(-96, 20);

  return {
    auth_users: [
      {
        id: "user-patient-riya",
        email: "riya@testclinic.local",
        password_hash: hashPassword("TestPass123!"),
        created_at: createdAt
      },
      {
        id: "user-patient-aman",
        email: "aman@testclinic.local",
        password_hash: hashPassword("TestPass123!"),
        created_at: createdAt
      },
      {
        id: "user-patient-sana",
        email: "sana@testclinic.local",
        password_hash: hashPassword("TestPass123!"),
        created_at: createdAt
      },
      {
        id: "user-doctor-maya",
        email: "maya@doctor.local",
        password_hash: hashPassword("TestPass123!"),
        created_at: createdAt
      },
      {
        id: "user-doctor-arjun",
        email: "arjun@doctor.local",
        password_hash: hashPassword("TestPass123!"),
        created_at: createdAt
      },
      {
        id: "user-doctor-nisha",
        email: "nisha@doctor.local",
        password_hash: hashPassword("TestPass123!"),
        created_at: createdAt
      }
    ],
    users,
    registered_doctors: [
      {
        id: "regdoc-maya",
        name: "Dr. Maya Shah",
        registration_number_hash: sha256("REG-1001"),
        specialty: "Cardiology",
        created_at: createdAt
      },
      {
        id: "regdoc-arjun",
        name: "Dr. Arjun Menon",
        registration_number_hash: sha256("REG-2002"),
        specialty: "Dermatology",
        created_at: createdAt
      },
      {
        id: "regdoc-nisha",
        name: "Dr. Nisha Rao",
        registration_number_hash: sha256("REG-3003"),
        specialty: "General Medicine",
        created_at: createdAt
      }
    ],
    doctors,
    clinics,
    doctor_clinics: [
      { doctor_id: "doctor-maya", clinic_id: "clinic-heartcare" },
      { doctor_id: "doctor-maya", clinic_id: "clinic-heartcare-south" },
      { doctor_id: "doctor-arjun", clinic_id: "clinic-skinfirst" },
      { doctor_id: "doctor-arjun", clinic_id: "clinic-skinfirst-velachery" },
      { doctor_id: "doctor-nisha", clinic_id: "clinic-wellspring" }
    ],
    doctor_slots: [
      { id: "slot-heart-1", doctor_id: "doctor-maya", clinic_id: "clinic-heartcare", start_time: heart1.start, end_time: heart1.end, created_at: createdAt },
      { id: "slot-heart-2", doctor_id: "doctor-maya", clinic_id: "clinic-heartcare", start_time: heart2.start, end_time: heart2.end, created_at: createdAt },
      { id: "slot-heart-3", doctor_id: "doctor-maya", clinic_id: "clinic-heartcare", start_time: heart3.start, end_time: heart3.end, created_at: createdAt },
      { id: "slot-heart-south-1", doctor_id: "doctor-maya", clinic_id: "clinic-heartcare-south", start_time: heartSouth1.start, end_time: heartSouth1.end, created_at: createdAt },
      { id: "slot-skin-1", doctor_id: "doctor-arjun", clinic_id: "clinic-skinfirst", start_time: skin1.start, end_time: skin1.end, created_at: createdAt },
      { id: "slot-skin-2", doctor_id: "doctor-arjun", clinic_id: "clinic-skinfirst", start_time: skin2.start, end_time: skin2.end, created_at: createdAt },
      { id: "slot-skin-3", doctor_id: "doctor-arjun", clinic_id: "clinic-skinfirst", start_time: skin3.start, end_time: skin3.end, created_at: createdAt },
      { id: "slot-skin-vel-1", doctor_id: "doctor-arjun", clinic_id: "clinic-skinfirst-velachery", start_time: skinVel1.start, end_time: skinVel1.end, created_at: createdAt },
      { id: "slot-med-1", doctor_id: "doctor-nisha", clinic_id: "clinic-wellspring", start_time: med1.start, end_time: med1.end, created_at: createdAt },
      { id: "slot-med-2", doctor_id: "doctor-nisha", clinic_id: "clinic-wellspring", start_time: med2.start, end_time: med2.end, created_at: createdAt },
      { id: "slot-med-3", doctor_id: "doctor-nisha", clinic_id: "clinic-wellspring", start_time: med3.start, end_time: med3.end, created_at: createdAt },
      { id: "slot-past-1", doctor_id: "doctor-nisha", clinic_id: "clinic-wellspring", start_time: past1.start, end_time: past1.end, created_at: createdAt },
      { id: "slot-past-2", doctor_id: "doctor-arjun", clinic_id: "clinic-skinfirst", start_time: past2.start, end_time: past2.end, created_at: createdAt }
    ],
    symptoms: [
      {
        id: "symptom-riya-1",
        patient_id: "user-patient-riya",
        description: encryptPHI("Fever, sore throat, and fatigue for three days"),
        created_at: past1.start
      },
      {
        id: "symptom-aman-1",
        patient_id: "user-patient-aman",
        description: encryptPHI("Itchy rash on arms and neck after travel"),
        created_at: past2.start
      },
      {
        id: "symptom-sana-1",
        patient_id: "user-patient-sana",
        description: encryptPHI("Occasional chest tightness during exertion"),
        created_at: createdAt
      }
    ],
    appointments: [
      {
        id: "appt-riya-1",
        patient_id: "user-patient-riya",
        doctor_id: "doctor-nisha",
        slot_id: "slot-past-1",
        clinic_id: "clinic-wellspring",
        symptom_id: "symptom-riya-1",
        status: "completed",
        patient_arrived_at: past1.start,
        created_at: past1.start
      },
      {
        id: "appt-aman-1",
        patient_id: "user-patient-aman",
        doctor_id: "doctor-arjun",
        slot_id: "slot-past-2",
        clinic_id: "clinic-skinfirst",
        symptom_id: "symptom-aman-1",
        status: "completed",
        patient_arrived_at: past2.start,
        created_at: past2.start
      },
      {
        id: "appt-sana-1",
        patient_id: "user-patient-sana",
        doctor_id: "doctor-maya",
        slot_id: "slot-heart-1",
        clinic_id: "clinic-heartcare",
        symptom_id: "symptom-sana-1",
        status: "pending",
        patient_arrived_at: null,
        created_at: createdAt
      }
    ],
    prescriptions: [
      {
        id: "rx-riya-1",
        appointment_id: "appt-riya-1",
        doctor_id: "doctor-nisha",
        patient_id: "user-patient-riya",
        diagnosis: encryptPHI("Viral upper respiratory infection"),
        medications: makeMedicationCipher([
          { name: "Paracetamol", dosage: "650mg", schedule: "08:00,14:00,21:00" },
          { name: "Salt Water Gargle", dosage: "N/A", schedule: "09:00,18:00" }
        ]),
        doctor_notes: encryptPHI("Hydration, rest, and monitor for worsening fever."),
        created_at: past1.end
      },
      {
        id: "rx-aman-1",
        appointment_id: "appt-aman-1",
        doctor_id: "doctor-arjun",
        patient_id: "user-patient-aman",
        diagnosis: encryptPHI("Allergic contact dermatitis"),
        medications: makeMedicationCipher([
          { name: "Cetirizine", dosage: "10mg", schedule: "22:00" },
          { name: "Calamine Lotion", dosage: "Topical", schedule: "08:00,20:00" }
        ]),
        doctor_notes: encryptPHI("Avoid suspected irritants and use hypoallergenic soap."),
        created_at: past2.end
      }
    ],
    reviews: [
      { id: "review-1", doctor_id: "doctor-maya", patient_id: "user-patient-sana", rating: 5, comment: "Very reassuring consultation.", created_at: createdAt },
      { id: "review-2", doctor_id: "doctor-maya", patient_id: "user-patient-riya", rating: 4, comment: "Explained preventive steps well.", created_at: createdAt },
      { id: "review-3", doctor_id: "doctor-arjun", patient_id: "user-patient-aman", rating: 5, comment: "Quick diagnosis and helpful treatment.", created_at: createdAt },
      { id: "review-4", doctor_id: "doctor-nisha", patient_id: "user-patient-riya", rating: 5, comment: "Great for family medicine follow-up.", created_at: createdAt }
    ],
    medication_reminders: [
      {
        id: "reminder-riya-1",
        patient_id: "user-patient-riya",
        medication_name: "Paracetamol (650mg)",
        schedule: "08:00,14:00,21:00",
        enabled: true,
        created_at: createdAt
      },
      {
        id: "reminder-aman-1",
        patient_id: "user-patient-aman",
        medication_name: "Cetirizine (10mg)",
        schedule: "22:00",
        enabled: true,
        created_at: createdAt
      }
    ],
    sessions: []
  };
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
