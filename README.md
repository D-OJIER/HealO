# AI Clinic Appointment & Prescription System

Production-oriented Next.js healthcare platform with a local persistent demo backend:

- local file-backed auth, role-based access, and persistent JSON storage
- trusted doctor verification through SHA-256 registration matching
- AES-256-GCM encrypted PHI for symptoms, diagnoses, doctor notes, and medication payloads
- Grok-powered symptom triage and patient-history summarization with safe fallbacks
- patient doctor discovery with weighted rating, distance, map preview, and navigation links
- doctor clinic management, batch slot generation, appointment review, and encrypted prescriptions

## Environment setup

Copy `.env.example` to `.env.local` and fill in:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
APP_AES_SECRET=
XAI_API_KEY=
XAI_BASE_URL=https://api.x.ai/v1
XAI_MODEL=grok-4
```

Only `APP_AES_SECRET` and `XAI_API_KEY` matter in the current local-data mode. Supabase values can remain in place but are not required for the app to function.

## Local data

Persistent demo data is stored in [data/local-db.json](C:/Users/reijo/OneDrive/Documents/claudeCode/data/local-db.json).

The app auto-seeds this store with:

- multiple patients
- verified doctors
- clinics and upcoming slots
- completed and pending appointments
- encrypted symptoms, prescriptions, and reminders
- reviews and rating data

The schema reference is saved in [db_schema.txt](C:/Users/reijo/OneDrive/Documents/claudeCode/db_schema.txt) and mirrors the same table structure used by the local store.

Demo accounts:

- Patient: `riya@testclinic.local` / `TestPass123!`
- Patient: `aman@testclinic.local` / `TestPass123!`
- Patient: `sana@testclinic.local` / `TestPass123!`
- Doctor: `maya@doctor.local` / `TestPass123!`
- Doctor: `arjun@doctor.local` / `TestPass123!`
- Doctor: `nisha@doctor.local` / `TestPass123!`

Doctor verification registry numbers:

- `REG-1001`
- `REG-2002`
- `REG-3003`

## Run

1. `npm.cmd install`
2. `npm.cmd run dev`
3. Open `http://localhost:3000`
