-- Healoz MVP schema
create extension if not exists "pgcrypto";

do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type user_role as enum ('patient', 'doctor');
  end if;
  if not exists (select 1 from pg_type where typname = 'appointment_status') then
    create type appointment_status as enum ('booked', 'completed', 'cancelled');
  end if;
end $$;

do $$
begin
  if exists (select 1 from pg_type where typname = 'appointment_status') then
    if not exists (
      select 1
      from pg_enum e
      join pg_type t on t.oid = e.enumtypid
      where t.typname = 'appointment_status' and e.enumlabel = 'ongoing'
    ) then
      alter type appointment_status add value 'ongoing';
    end if;
  end if;
end $$;

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text unique not null,
  role user_role not null,
  created_at timestamptz not null default now()
);

create table if not exists public.doctors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  specialty text not null,
  rating float not null default 0,
  available_slots jsonb not null default '[]'::jsonb,
  location_lat double precision,
  location_lng double precision,
  location_label text,
  created_at timestamptz not null default now()
);

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.users(id) on delete cascade,
  doctor_id uuid not null references public.doctors(id) on delete cascade,
  clinic_id uuid,
  slot_id uuid,
  time timestamptz not null,
  status appointment_status not null default 'booked',
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_appointments_patient_id on public.appointments(patient_id);
create index if not exists idx_appointments_doctor_id on public.appointments(doctor_id);
create index if not exists idx_appointments_clinic_id on public.appointments(clinic_id);
create index if not exists idx_doctors_specialty on public.doctors(specialty);
create unique index if not exists uniq_appointments_doctor_time on public.appointments(doctor_id, time);

alter table public.users enable row level security;
alter table public.doctors enable row level security;
alter table public.appointments enable row level security;

drop policy if exists "users_select_own" on public.users;
create policy "users_select_own" on public.users
for select using (auth.uid() = id);

drop policy if exists "users_insert_own" on public.users;
create policy "users_insert_own" on public.users
for insert with check (auth.uid() = id);

drop policy if exists "users_update_own" on public.users;
create policy "users_update_own" on public.users
for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "doctors_select_all_authenticated" on public.doctors;
create policy "doctors_select_all_authenticated" on public.doctors
for select using (auth.uid() is not null);

drop policy if exists "doctors_insert_own" on public.doctors;
create policy "doctors_insert_own" on public.doctors
for insert with check (auth.uid() = user_id);

drop policy if exists "appointments_select_related" on public.appointments;
create policy "appointments_select_related" on public.appointments
for select using (
  auth.uid() = patient_id
  or exists (
    select 1 from public.doctors d
    where d.id = appointments.doctor_id and d.user_id = auth.uid()
  )
);

drop policy if exists "appointments_insert_patient" on public.appointments;
create policy "appointments_insert_patient" on public.appointments
for insert with check (auth.uid() = patient_id);

drop policy if exists "appointments_update_related" on public.appointments;
create policy "appointments_update_related" on public.appointments
for update using (
  auth.uid() = patient_id
  or exists (
    select 1 from public.doctors d
    where d.id = appointments.doctor_id and d.user_id = auth.uid()
  )
) with check (
  auth.uid() = patient_id
  or exists (
    select 1 from public.doctors d
    where d.id = appointments.doctor_id and d.user_id = auth.uid()
  )
);

create table if not exists public.prescriptions (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  doctor_id uuid not null references public.doctors(id) on delete cascade,
  patient_id uuid not null references public.users(id) on delete cascade,
  diagnosis text not null,
  medications jsonb not null default '[]'::jsonb,
  doctor_notes text,
  medicines jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_prescriptions_patient_id on public.prescriptions(patient_id);
create index if not exists idx_prescriptions_doctor_id on public.prescriptions(doctor_id);

create table if not exists public.medication_reminders (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.users(id) on delete cascade,
  medication_name text not null,
  schedule text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_medication_reminders_patient_id on public.medication_reminders(patient_id);

alter table public.prescriptions enable row level security;
alter table public.medication_reminders enable row level security;

drop policy if exists "prescriptions_select_related" on public.prescriptions;
create policy "prescriptions_select_related" on public.prescriptions
for select using (
  auth.uid() = patient_id
  or exists (
    select 1
    from public.doctors d
    where d.id = prescriptions.doctor_id and d.user_id = auth.uid()
  )
);

drop policy if exists "prescriptions_insert_doctor" on public.prescriptions;
create policy "prescriptions_insert_doctor" on public.prescriptions
for insert with check (
  exists (
    select 1
    from public.doctors d
    where d.id = prescriptions.doctor_id and d.user_id = auth.uid()
  )
);

drop policy if exists "reminders_select_own" on public.medication_reminders;
create policy "reminders_select_own" on public.medication_reminders
for select using (auth.uid() = patient_id);

drop policy if exists "reminders_insert_own" on public.medication_reminders;
create policy "reminders_insert_own" on public.medication_reminders
for insert with check (auth.uid() = patient_id);

drop policy if exists "reminders_update_own" on public.medication_reminders;
create policy "reminders_update_own" on public.medication_reminders
for update using (auth.uid() = patient_id) with check (auth.uid() = patient_id);

create table if not exists public.clinics (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null references public.doctors(id) on delete cascade,
  name text not null,
  location_lat double precision not null,
  location_lng double precision not null,
  address text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_clinics_doctor_id on public.clinics(doctor_id);

create table if not exists public.doctor_slots (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null references public.doctors(id) on delete cascade,
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  start_time timestamptz not null,
  end_time timestamptz not null,
  is_booked boolean not null default false
);

create index if not exists idx_doctor_slots_doctor_id on public.doctor_slots(doctor_id);
create index if not exists idx_doctor_slots_clinic_id on public.doctor_slots(clinic_id);
create unique index if not exists uniq_slot_per_doctor_window on public.doctor_slots(doctor_id, start_time, end_time);

create table if not exists public.medical_history (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.users(id) on delete cascade,
  doctor_id uuid not null references public.doctors(id) on delete cascade,
  diagnosis text not null,
  notes text not null,
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'appointments_clinic_id_fkey'
  ) then
    alter table public.appointments
    add constraint appointments_clinic_id_fkey
    foreign key (clinic_id) references public.clinics(id) on delete set null;
  end if;
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'appointments_slot_id_fkey'
  ) then
    alter table public.appointments
    add constraint appointments_slot_id_fkey
    foreign key (slot_id) references public.doctor_slots(id) on delete set null;
  end if;
end $$;

create index if not exists idx_medical_history_patient_id on public.medical_history(patient_id);
create index if not exists idx_medical_history_doctor_id on public.medical_history(doctor_id);

alter table public.clinics enable row level security;
alter table public.doctor_slots enable row level security;
alter table public.medical_history enable row level security;

drop policy if exists "clinics_select_authenticated" on public.clinics;
create policy "clinics_select_authenticated" on public.clinics
for select using (auth.uid() is not null);

drop policy if exists "clinics_insert_doctor" on public.clinics;
create policy "clinics_insert_doctor" on public.clinics
for insert with check (
  exists (
    select 1 from public.doctors d
    where d.id = clinics.doctor_id and d.user_id = auth.uid()
  )
);

drop policy if exists "doctor_slots_select_authenticated" on public.doctor_slots;
create policy "doctor_slots_select_authenticated" on public.doctor_slots
for select using (auth.uid() is not null);

drop policy if exists "doctor_slots_insert_doctor" on public.doctor_slots;
create policy "doctor_slots_insert_doctor" on public.doctor_slots
for insert with check (
  exists (
    select 1 from public.doctors d
    where d.id = doctor_slots.doctor_id and d.user_id = auth.uid()
  )
);

drop policy if exists "doctor_slots_update_doctor" on public.doctor_slots;
create policy "doctor_slots_update_doctor" on public.doctor_slots
for update using (
  exists (
    select 1 from public.doctors d
    where d.id = doctor_slots.doctor_id and d.user_id = auth.uid()
  )
) with check (
  exists (
    select 1 from public.doctors d
    where d.id = doctor_slots.doctor_id and d.user_id = auth.uid()
  )
);

drop policy if exists "medical_history_select_related" on public.medical_history;
create policy "medical_history_select_related" on public.medical_history
for select using (
  auth.uid() = patient_id
  or exists (
    select 1 from public.doctors d
    where d.id = medical_history.doctor_id and d.user_id = auth.uid()
  )
);

drop policy if exists "medical_history_insert_doctor" on public.medical_history;
create policy "medical_history_insert_doctor" on public.medical_history
for insert with check (
  exists (
    select 1 from public.doctors d
    where d.id = medical_history.doctor_id and d.user_id = auth.uid()
  )
);
