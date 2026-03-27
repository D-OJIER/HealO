export type UserRole = "patient" | "doctor";

export type AppointmentStatus = "booked" | "ongoing" | "completed" | "cancelled";

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface Doctor {
  id: string;
  user_id: string;
  specialty: string;
  rating: number;
  available_slots: string[];
  location_lat?: number | null;
  location_lng?: number | null;
  location_label?: string | null;
  distance_km?: number;
  users?: {
    id: string;
    name: string;
    email: string;
    role: UserRole;
  } | null;
  clinics?: Clinic[];
  next_available_slot?: string | null;
}

export interface Appointment {
  id: string;
  patient_id: string;
  doctor_id: string;
  clinic_id?: string | null;
  slot_id?: string | null;
  time: string;
  status: AppointmentStatus;
  notes?: string | null;
  doctors?: Doctor | null;
  patient?: UserProfile | null;
  clinics?: Clinic | null;
}

export interface TriageResult {
  specialty: string;
  urgency: "High" | "Medium" | "Low";
}

export interface Prescription {
  id: string;
  appointment_id: string;
  doctor_id: string;
  patient_id: string;
  diagnosis?: string;
  doctor_notes?: string | null;
  medicines?: PrescriptionMedicine[];
  medications?: Array<{ name: string; dosage?: string; instructions?: string }>;
  created_at: string;
  doctor?: Doctor | null;
  patient?: UserProfile | null;
  appointment?: Appointment | null;
}

export interface PrescriptionMedicine {
  name: string;
  dosage?: string;
  schedule?: string;
  frequency?: string;
  duration?: string;
  instructions?: string;
}

export interface MedicationReminder {
  id: string;
  patient_id: string;
  medication_name: string;
  schedule: string;
  enabled: boolean;
  created_at: string;
}

export interface Clinic {
  id: string;
  doctor_id: string;
  name: string;
  location_lat: number;
  location_lng: number;
  address: string;
  created_at?: string;
  distance_km?: number;
  doctor_slots?: DoctorSlot[];
}

export interface DoctorSlot {
  id: string;
  doctor_id: string;
  clinic_id: string;
  start_time: string;
  end_time: string;
  is_booked: boolean;
}

export interface MedicalHistoryEntry {
  id: string;
  patient_id: string;
  doctor_id: string;
  diagnosis: string;
  notes: string;
  created_at: string;
}
