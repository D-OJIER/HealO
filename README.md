# AI Clinic Appointment & Prescription System

Production-oriented Next.js healthcare platform with a local persistent demo backend:

- local file-backed auth, role-based access, and persistent JSON storage
- trusted doctor verification through SHA-256 registration matching
- AES-256-GCM encrypted PHI for symptoms, diagnoses, doctor notes, and medication payloads
- Gemini-powered symptom triage and patient-history summarization with safe fallbacks
- allergy-aware prescription suggestions that use current symptoms and recent history
- patient doctor discovery with weighted rating, distance, map preview, and navigation links
- doctor clinic management, batch slot generation, appointment review, and encrypted prescriptions

## Environment setup

Fill `HealO/.env.local` with:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
APP_AES_SECRET=
GEMINI_API_KEY=
GEMINI_MODEL=gemini-3-flash-preview
```

Only `APP_AES_SECRET` and `GEMINI_API_KEY` matter in the current local-data mode. Supabase values can remain in place but are not required for the app to function.

## Local data

Persistent demo data is stored in [data/local-db.json](/home/alfredreijophilominf/Basic/clg/HealO/data/local-db.json).

The seeded store now includes:

- batch 1 and batch 2 demo accounts
- 6 verified doctors across cardiology, dermatology, general medicine, orthopedics, pediatrics, and ENT
- 9 clinics with linked doctor locations
- upcoming and completed appointments
- encrypted symptoms, prescription history, and medication reminders
- richer patient history so doctor AI summaries have enough context to work with

## Demo accounts

Password for every demo account: `TestPass123!`

Batch 1 patients:

- `riya@testclinic.local`
- `aman@testclinic.local`
- `sana@testclinic.local`

Batch 1 doctors:

- `maya@doctor.local`  Reg: `REG-1001`
- `arjun@doctor.local`  Reg: `REG-2002`
- `nisha@doctor.local`  Reg: `REG-3003`

Batch 2 patients:

- `kavya@testclinic.local`
- `rohan@testclinic.local`
- `meera@testclinic.local`

Batch 2 doctors:

- `vivek@doctor.local`  Reg: `REG-4004`
- `farah@doctor.local`  Reg: `REG-5005`
- `karthik@doctor.local`  Reg: `REG-6006`

## AI check

After adding your Gemini key, the app uses Gemini for:

- patient symptom-to-specialty analysis
- doctor-side patient history summaries

If `GEMINI_API_KEY` is empty or Gemini fails, the app falls back to its built-in local logic so the demo still works.

## Run

1. `npm install`
2. `npm run dev`
3. Open `http://localhost:3000`
