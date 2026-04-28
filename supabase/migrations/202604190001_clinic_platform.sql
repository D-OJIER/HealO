create extension if not exists pgcrypto;

do $$
begin
  create type public.user_role as enum ('patient', 'doctor', 'admin');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.doctor_verification_status as enum ('pending', 'verified', 'rejected');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.appointment_status as enum ('pending', 'accepted', 'rejected', 'cancelled', 'completed');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  email text not null unique,
  phone text,
  role public.user_role not null default 'patient',
  created_at timestamptz not null default now()
);

create table if not exists public.registered_doctors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  registration_number text,
  registration_number_hash text not null unique,
  specialty text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.doctors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  registration_number text,
  registration_number_hash text,
  specialty text,
  verification_status public.doctor_verification_status not null default 'pending',
  rating double precision default 0,
  location_lat double precision,
  location_lng double precision,
  location_label text,
  created_at timestamptz not null default now()
);

create table if not exists public.clinics (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text not null,
  location_lat double precision not null,
  location_lng double precision not null,
  created_at timestamptz not null default now()
);

create table if not exists public.doctor_clinics (
  doctor_id uuid not null references public.doctors(id) on delete cascade,
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  primary key (doctor_id, clinic_id)
);

create table if not exists public.doctor_slots (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null references public.doctors(id) on delete cascade,
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  start_time timestamptz not null,
  end_time timestamptz not null,
  created_at timestamptz not null default now(),
  constraint valid_slot_window check (end_time > start_time)
);

create table if not exists public.symptoms (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.users(id) on delete cascade,
  description text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.users(id) on delete cascade,
  doctor_id uuid not null references public.doctors(id) on delete cascade,
  slot_id uuid not null references public.doctor_slots(id) on delete cascade,
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  symptom_id uuid references public.symptoms(id) on delete set null,
  status public.appointment_status not null default 'pending',
  created_at timestamptz not null default now()
);

create unique index if not exists appointments_active_slot_unique
  on public.appointments (slot_id)
  where status in ('pending', 'accepted');

create table if not exists public.prescriptions (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  doctor_id uuid not null references public.doctors(id) on delete cascade,
  patient_id uuid not null references public.users(id) on delete cascade,
  diagnosis text not null,
  medications jsonb not null default '{}'::jsonb,
  doctor_notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null references public.doctors(id) on delete cascade,
  patient_id uuid not null references public.users(id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now()
);

create table if not exists public.medication_reminders (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.users(id) on delete cascade,
  medication_name text not null,
  schedule text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists doctors_user_id_idx on public.doctors(user_id);
create index if not exists doctor_slots_doctor_id_idx on public.doctor_slots(doctor_id, start_time);
create index if not exists appointments_patient_idx on public.appointments(patient_id, created_at desc);
create index if not exists appointments_doctor_idx on public.appointments(doctor_id, created_at desc);
create index if not exists symptoms_patient_idx on public.symptoms(patient_id, created_at desc);
create index if not exists prescriptions_patient_idx on public.prescriptions(patient_id, created_at desc);
create index if not exists reviews_doctor_idx on public.reviews(doctor_id, created_at desc);

create or replace function public.current_role()
returns public.user_role
language sql
stable
as $$
  select role from public.users where id = auth.uid()
$$;

create or replace function public.current_doctor_id()
returns uuid
language sql
stable
as $$
  select id from public.doctors where user_id = auth.uid()
$$;

create or replace function public.is_verified_doctor()
returns boolean
language sql
stable
as $$
  select exists(
    select 1
    from public.doctors
    where user_id = auth.uid()
      and verification_status = 'verified'
  )
$$;

create or replace function public.verify_doctor(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  doctor_name text;
  doctor_hash text;
  matched_specialty text;
begin
  select u.name, d.registration_number_hash
  into doctor_name, doctor_hash
  from public.users u
  join public.doctors d on d.user_id = u.id
  where u.id = p_user_id;

  select rd.specialty
  into matched_specialty
  from public.registered_doctors rd
  where lower(trim(rd.name)) = lower(trim(doctor_name))
    and rd.registration_number_hash = doctor_hash
  limit 1;

  if matched_specialty is not null then
    update public.doctors
    set verification_status = 'verified',
        specialty = matched_specialty
    where user_id = p_user_id;
  else
    update public.doctors
    set verification_status = 'rejected'
    where user_id = p_user_id;
  end if;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role public.user_role;
  raw_registration text;
begin
  requested_role := coalesce((new.raw_user_meta_data ->> 'role')::public.user_role, 'patient');
  raw_registration := coalesce(new.raw_user_meta_data ->> 'registration_number', '');

  insert into public.users (id, name, email, phone, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    new.email,
    nullif(new.raw_user_meta_data ->> 'phone', ''),
    requested_role
  )
  on conflict (id) do update
  set
    name = excluded.name,
    email = excluded.email,
    phone = excluded.phone,
    role = excluded.role;

  if requested_role = 'doctor' then
    insert into public.doctors (user_id, registration_number_hash, verification_status)
    values (
      new.id,
      encode(digest(raw_registration, 'sha256'), 'hex'),
      'pending'
    )
    on conflict (user_id) do update
    set registration_number_hash = excluded.registration_number_hash,
        verification_status = 'pending';

    perform public.verify_doctor(new.id);
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.verify_doctor_on_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.verify_doctor(new.user_id);
  return new;
end;
$$;

drop trigger if exists doctors_verify_after_change on public.doctors;
create trigger doctors_verify_after_change
after insert or update of registration_number_hash on public.doctors
for each row execute procedure public.verify_doctor_on_change();

alter table public.users enable row level security;
alter table public.registered_doctors enable row level security;
alter table public.doctors enable row level security;
alter table public.clinics enable row level security;
alter table public.doctor_clinics enable row level security;
alter table public.doctor_slots enable row level security;
alter table public.appointments enable row level security;
alter table public.prescriptions enable row level security;
alter table public.symptoms enable row level security;
alter table public.reviews enable row level security;
alter table public.medication_reminders enable row level security;

drop policy if exists users_self_select on public.users;
create policy users_self_select on public.users
for select using (id = auth.uid() or public.current_role() = 'admin');

drop policy if exists users_doctor_directory_select on public.users;
create policy users_doctor_directory_select on public.users
for select using (
  exists (
    select 1
    from public.doctors d
    where d.user_id = users.id
      and d.verification_status = 'verified'
  )
  or exists (
    select 1
    from public.appointments a
    join public.doctors d on d.id = a.doctor_id
    where a.patient_id = users.id
      and d.user_id = auth.uid()
  )
);

drop policy if exists users_self_update on public.users;
create policy users_self_update on public.users
for update using (id = auth.uid() or public.current_role() = 'admin')
with check (id = auth.uid() or public.current_role() = 'admin');

drop policy if exists registered_doctors_admin_only on public.registered_doctors;
create policy registered_doctors_admin_only on public.registered_doctors
for all using (public.current_role() = 'admin')
with check (public.current_role() = 'admin');

drop policy if exists doctors_visible_verified_or_self on public.doctors;
create policy doctors_visible_verified_or_self on public.doctors
for select using (verification_status = 'verified' or user_id = auth.uid() or public.current_role() = 'admin');

drop policy if exists doctors_self_update on public.doctors;
create policy doctors_self_update on public.doctors
for update using (user_id = auth.uid() or public.current_role() = 'admin')
with check (user_id = auth.uid() or public.current_role() = 'admin');

drop policy if exists clinics_visible_to_authenticated on public.clinics;
create policy clinics_visible_to_authenticated on public.clinics
for select to authenticated using (true);

drop policy if exists clinics_verified_doctor_insert on public.clinics;
create policy clinics_verified_doctor_insert on public.clinics
for insert to authenticated with check (public.is_verified_doctor() or public.current_role() = 'admin');

drop policy if exists doctor_clinics_visible on public.doctor_clinics;
create policy doctor_clinics_visible on public.doctor_clinics
for select to authenticated using (true);

drop policy if exists doctor_clinics_verified_insert on public.doctor_clinics;
create policy doctor_clinics_verified_insert on public.doctor_clinics
for insert to authenticated with check (
  doctor_id = public.current_doctor_id() or public.current_role() = 'admin'
);

drop policy if exists doctor_slots_visible on public.doctor_slots;
create policy doctor_slots_visible on public.doctor_slots
for select to authenticated using (true);

drop policy if exists doctor_slots_verified_doctor_insert on public.doctor_slots;
create policy doctor_slots_verified_doctor_insert on public.doctor_slots
for insert to authenticated with check (
  (doctor_id = public.current_doctor_id() and public.is_verified_doctor()) or public.current_role() = 'admin'
);

drop policy if exists doctor_slots_verified_doctor_update on public.doctor_slots;
create policy doctor_slots_verified_doctor_update on public.doctor_slots
for update to authenticated using (
  (doctor_id = public.current_doctor_id() and public.is_verified_doctor()) or public.current_role() = 'admin'
)
with check (
  (doctor_id = public.current_doctor_id() and public.is_verified_doctor()) or public.current_role() = 'admin'
);

drop policy if exists symptoms_patient_access on public.symptoms;
create policy symptoms_patient_access on public.symptoms
for select using (
  patient_id = auth.uid()
  or public.current_role() = 'admin'
  or exists (
    select 1
    from public.appointments a
    join public.doctors d on d.id = a.doctor_id
    where a.symptom_id = symptoms.id
      and d.user_id = auth.uid()
  )
);

drop policy if exists symptoms_patient_insert on public.symptoms;
create policy symptoms_patient_insert on public.symptoms
for insert to authenticated with check (
  patient_id = auth.uid() and public.current_role() = 'patient'
);

drop policy if exists appointments_patient_or_doctor_select on public.appointments;
create policy appointments_patient_or_doctor_select on public.appointments
for select using (
  patient_id = auth.uid()
  or public.current_role() = 'admin'
  or exists (
    select 1 from public.doctors d
    where d.id = appointments.doctor_id and d.user_id = auth.uid()
  )
);

drop policy if exists appointments_patient_insert on public.appointments;
create policy appointments_patient_insert on public.appointments
for insert to authenticated with check (
  patient_id = auth.uid()
  and public.current_role() = 'patient'
);

drop policy if exists appointments_doctor_update on public.appointments;
create policy appointments_doctor_update on public.appointments
for update to authenticated using (
  public.current_role() = 'admin'
  or exists (
    select 1 from public.doctors d
    where d.id = appointments.doctor_id
      and d.user_id = auth.uid()
      and d.verification_status = 'verified'
  )
)
with check (
  public.current_role() = 'admin'
  or exists (
    select 1 from public.doctors d
    where d.id = appointments.doctor_id
      and d.user_id = auth.uid()
      and d.verification_status = 'verified'
  )
);

drop policy if exists prescriptions_patient_or_doctor_select on public.prescriptions;
create policy prescriptions_patient_or_doctor_select on public.prescriptions
for select using (
  patient_id = auth.uid()
  or public.current_role() = 'admin'
  or exists (
    select 1 from public.doctors d
    where d.id = prescriptions.doctor_id and d.user_id = auth.uid()
  )
);

drop policy if exists prescriptions_verified_doctor_insert on public.prescriptions;
create policy prescriptions_verified_doctor_insert on public.prescriptions
for insert to authenticated with check (
  public.current_role() = 'admin'
  or exists (
    select 1 from public.doctors d
    where d.id = prescriptions.doctor_id
      and d.user_id = auth.uid()
      and d.verification_status = 'verified'
  )
);

drop policy if exists reviews_read_all on public.reviews;
create policy reviews_read_all on public.reviews
for select to authenticated using (true);

drop policy if exists reviews_patient_insert on public.reviews;
create policy reviews_patient_insert on public.reviews
for insert to authenticated with check (
  patient_id = auth.uid() and public.current_role() = 'patient'
);

drop policy if exists reminders_patient_access on public.medication_reminders;
create policy reminders_patient_access on public.medication_reminders
for all to authenticated using (patient_id = auth.uid() or public.current_role() = 'admin')
with check (patient_id = auth.uid() or public.current_role() = 'admin');
