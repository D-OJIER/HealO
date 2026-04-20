export type Role = "patient" | "doctor" | "admin";

export type VerificationStatus = "pending" | "verified" | "rejected";

export type AppointmentStatus =
  | "pending"
  | "accepted"
  | "rejected"
  | "cancelled"
  | "completed";

export type UserProfile = {
  id: string;
  name: string;
  email: string;
  role: Role;
  phone: string | null;
  created_at: string;
};

export type DoctorProfile = {
  id: string;
  user_id: string;
  specialty: string | null;
  verification_status: VerificationStatus;
  rating: number | null;
  location_lat: number | null;
  location_lng: number | null;
  location_label: string | null;
  created_at: string;
};

export type Coordinates = {
  lat: number;
  lng: number;
};

export type DoctorRecommendation = {
  id: string;
  doctorProfileId: string;
  name: string;
  specialty: string;
  verificationStatus: VerificationStatus;
  weightedRating: number;
  reviewCount: number;
  clinicName: string;
  address: string;
  distanceKm: number | null;
  whyRecommended: string;
  nextSlotId: string | null;
  nextSlotStart: string | null;
  directionsUrl: string;
  mapEmbedUrl: string;
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
};

export type MedicationItem = {
  name: string;
  dosage: string;
  schedule: string;
};

export type AuthUser = {
  id: string;
  email: string;
  password_hash: string;
  created_at: string;
};

export type RegisteredDoctor = {
  id: string;
  name: string;
  registration_number_hash: string;
  specialty: string;
  created_at: string;
};

export type Clinic = {
  id: string;
  name: string;
  address: string;
  location_lat: number;
  location_lng: number;
  created_at: string;
};

export type DoctorClinic = {
  doctor_id: string;
  clinic_id: string;
};

export type DoctorSlot = {
  id: string;
  doctor_id: string;
  clinic_id: string;
  start_time: string;
  end_time: string;
  created_at: string;
};

export type SymptomRecord = {
  id: string;
  patient_id: string;
  description: string;
  created_at: string;
};

export type AllergyRecord = {
  id: string;
  patient_id: string;
  allergen: string;
  reaction: string;
  severity: "low" | "medium" | "high";
  created_at: string;
};

export type AppointmentRecord = {
  id: string;
  patient_id: string;
  doctor_id: string;
  slot_id: string;
  clinic_id: string;
  symptom_id: string | null;
  status: AppointmentStatus;
  patient_arrived_at: string | null;
  created_at: string;
};

export type PrescriptionRecord = {
  id: string;
  appointment_id: string;
  doctor_id: string;
  patient_id: string;
  diagnosis: string;
  medications: { ciphertext: string };
  doctor_notes: string;
  created_at: string;
};

export type ReviewRecord = {
  id: string;
  doctor_id: string;
  patient_id: string;
  rating: number;
  comment: string;
  created_at: string;
};

export type MedicationReminderRecord = {
  id: string;
  patient_id: string;
  medication_name: string;
  schedule: string;
  enabled: boolean;
  created_at: string;
};

export type SessionRecord = {
  id: string;
  user_id: string;
  created_at: string;
};

export type PrescriptionSuggestionItem = {
  name: string;
  dosage: string;
  schedule: string;
  reason: string;
  blocked: boolean;
  conflictReason?: string;
};

export type PrescriptionSuggestion = {
  diagnosisHint: string;
  rationale: string;
  allergySummary: string[];
  cautions: string[];
  suggestions: PrescriptionSuggestionItem[];
};

export type LocalDatabase = {
  auth_users: AuthUser[];
  users: UserProfile[];
  registered_doctors: RegisteredDoctor[];
  doctors: DoctorProfile[];
  clinics: Clinic[];
  doctor_clinics: DoctorClinic[];
  doctor_slots: DoctorSlot[];
  appointments: AppointmentRecord[];
  prescriptions: PrescriptionRecord[];
  symptoms: SymptomRecord[];
  allergies: AllergyRecord[];
  reviews: ReviewRecord[];
  medication_reminders: MedicationReminderRecord[];
  sessions: SessionRecord[];
};
