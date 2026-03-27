## Healoz MVP

Production-ready MVP healthcare platform built with:

- Next.js App Router + TypeScript
- Tailwind CSS
- Supabase (PostgreSQL + Auth)

Core flows:

- Patient symptom input + AI triage recommendation
- Doctor discovery and booking appointments
- Doctor appointment dashboard
- Role-based access (patient / doctor)

## Getting Started

1) Install dependencies:

```bash
npm install
```

2) Configure environment variables:

```bash
cp .env.example .env.local
```

Fill in:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

3) Create tables in Supabase SQL editor:

- Run `db/schema.sql`

4) Run the app:

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

## API Endpoints

- `POST /api/ai` - returns `{ specialty, urgency }` from symptom text
- `POST /api/appointments` - creates appointment (patient only)
- `GET /api/appointments` - gets role-scoped appointments

## Project Structure

- `app/` - App Router pages and API routes
- `components/` - reusable UI components
- `lib/` - Supabase + auth helpers
- `services/` - business logic and data access
- `models/` - shared TypeScript types
- `ai/` - triage rules
- `db/` - SQL schema
- `utils/` - utility helpers

## Build & Lint

```bash
npm run lint
npm run build
```

Both should pass before deployment.
