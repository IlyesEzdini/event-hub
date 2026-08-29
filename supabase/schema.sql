-- =====================================================================
-- EventHub — Supabase schema, constraints, indexes, and RLS policies
-- Paste this whole file into the Supabase SQL Editor and run it once.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------

-- Clubs are the stable organizational entity. Events and reports attach
-- to a club_id, never to a manager's name, so replacing a manager never
-- touches historical data.
create table if not exists public.clubs (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  created_at  timestamptz not null default now()
);

-- One row per human user (admin or manager), linked 1:1 to a Supabase
-- auth.users row. role and club_id are read from THIS table server-side,
-- never trusted from the frontend.
create table if not exists public.profiles (
  id             uuid primary key default gen_random_uuid(),
  auth_user_id   uuid not null unique references auth.users(id) on delete cascade,
  manager_name   text not null,
  username       text not null unique,
  club_id        uuid references public.clubs(id) on delete set null,
  role           text not null default 'manager' check (role in ('admin', 'manager')),
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- A manager (non-admin) must always belong to a club.
alter table public.profiles
  add constraint manager_requires_club
  check (role = 'admin' or club_id is not null);

create table if not exists public.events (
  id                 uuid primary key default gen_random_uuid(),
  club_id            uuid not null references public.clubs(id) on delete cascade,
  created_by         uuid references public.profiles(id) on delete set null,
  event_name         text not null,
  event_date         date not null,
  event_location     text not null,
  event_timing       text not null,
  event_description  text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create table if not exists public.reports (
  id              uuid primary key default gen_random_uuid(),
  club_id         uuid not null references public.clubs(id) on delete cascade,
  month           int not null check (month between 1 and 12),
  year            int not null check (year between 2000 and 2100),
  members         int not null default 0 check (members >= 0),
  active_members  int not null default 0 check (active_members >= 0),
  events          int not null default 0 check (events >= 0),
  meetings        int not null default 0 check (meetings >= 0),
  evaluation      text,
  remarks         text,
  status          text not null default 'draft' check (status in ('draft', 'submitted')),
  submitted_at    timestamptz,
  created_by      uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint active_members_within_members check (active_members <= members),
  constraint one_report_per_club_per_month unique (club_id, month, year)
);

create table if not exists public.documents (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  description   text,
  file_path     text not null, -- storage object path in the "documents" bucket
  uploaded_by   uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------
create index if not exists idx_profiles_club_id on public.profiles(club_id);
create index if not exists idx_profiles_auth_user_id on public.profiles(auth_user_id);
create index if not exists idx_events_club_id on public.events(club_id);
create index if not exists idx_events_date on public.events(event_date);
create index if not exists idx_reports_club_id on public.reports(club_id);
create index if not exists idx_reports_month_year on public.reports(year, month);

-- ---------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists trg_events_updated_at on public.events;
create trigger trg_events_updated_at before update on public.events
  for each row execute function public.set_updated_at();

drop trigger if exists trg_reports_updated_at on public.reports;
create trigger trg_reports_updated_at before update on public.reports
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Helper functions used inside RLS policies.
-- SECURITY DEFINER + a fixed search_path so they can read public.profiles
-- (bypassing RLS on profiles internally) without causing recursive RLS
-- evaluation or being hijacked by a mutable search_path.
-- ---------------------------------------------------------------------
create or replace function public.current_profile_role()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select role from public.profiles where auth_user_id = auth.uid();
$$;

create or replace function public.current_profile_club_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select club_id from public.profiles where auth_user_id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(public.current_profile_role() = 'admin', false);
$$;

create or replace function public.current_profile_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select id from public.profiles where auth_user_id = auth.uid();
$$;

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
alter table public.clubs enable row level security;
alter table public.profiles enable row level security;
alter table public.events enable row level security;
alter table public.reports enable row level security;
alter table public.documents enable row level security;

-- CLUBS ------------------------------------------------------------
-- Every authenticated user (admin or manager) may read the list of clubs
-- (needed to render dropdowns and club names on shared events/calendar).
-- Only admins may create/update/delete clubs.
create policy clubs_select_authenticated
  on public.clubs for select
  to authenticated
  using (true);

create policy clubs_insert_admin
  on public.clubs for insert
  to authenticated
  with check (public.is_admin());

create policy clubs_update_admin
  on public.clubs for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy clubs_delete_admin
  on public.clubs for delete
  to authenticated
  using (public.is_admin());

-- PROFILES -----------------------------------------------------------
-- A manager may read their own profile. Admins may read every profile
-- (needed for the Managers admin page). Only admins may insert/update/
-- delete profiles — a manager can never grant themselves admin or move
-- themselves to another club.
create policy profiles_select_self_or_admin
  on public.profiles for select
  to authenticated
  using (auth_user_id = auth.uid() or public.is_admin());

create policy profiles_insert_admin
  on public.profiles for insert
  to authenticated
  with check (public.is_admin());

create policy profiles_update_admin
  on public.profiles for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy profiles_delete_admin
  on public.profiles for delete
  to authenticated
  using (public.is_admin());

-- EVENTS ---------------------------------------------------------------
-- Shared calendar: every authenticated user can SEE every event (so the
-- calendar is genuinely shared across clubs), but a manager may only
-- INSERT/UPDATE/DELETE events for their OWN club — the club_id is
-- verified against the manager's profile on the database side, so a
-- manager can never spoof another club's club_id from the frontend.
create policy events_select_authenticated
  on public.events for select
  to authenticated
  using (true);

create policy events_insert_own_club_or_admin
  on public.events for insert
  to authenticated
  with check (
    public.is_admin()
    or club_id = public.current_profile_club_id()
  );

create policy events_update_own_club_or_admin
  on public.events for update
  to authenticated
  using (
    public.is_admin()
    or club_id = public.current_profile_club_id()
  )
  with check (
    public.is_admin()
    or club_id = public.current_profile_club_id()
  );

create policy events_delete_own_club_or_admin
  on public.events for delete
  to authenticated
  using (
    public.is_admin()
    or club_id = public.current_profile_club_id()
  );

-- REPORTS ----------------------------------------------------------------
-- A manager may only read/write their OWN club's reports. Admins can
-- read/write every report. club_id is verified server-side.
create policy reports_select_own_club_or_admin
  on public.reports for select
  to authenticated
  using (
    public.is_admin()
    or club_id = public.current_profile_club_id()
  );

create policy reports_insert_own_club_or_admin
  on public.reports for insert
  to authenticated
  with check (
    public.is_admin()
    or club_id = public.current_profile_club_id()
  );

create policy reports_update_own_club_or_admin
  on public.reports for update
  to authenticated
  using (
    public.is_admin()
    or club_id = public.current_profile_club_id()
  )
  with check (
    public.is_admin()
    or club_id = public.current_profile_club_id()
  );

create policy reports_delete_admin
  on public.reports for delete
  to authenticated
  using (public.is_admin());

-- DOCUMENTS ----------------------------------------------------------------
-- Every authenticated user can read the document list/metadata. Only
-- admins can add or remove documents.
create policy documents_select_authenticated
  on public.documents for select
  to authenticated
  using (true);

create policy documents_insert_admin
  on public.documents for insert
  to authenticated
  with check (public.is_admin());

create policy documents_delete_admin
  on public.documents for delete
  to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------
-- Storage bucket + policies for uploaded documents
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

create policy documents_bucket_read_authenticated
  on storage.objects for select
  to authenticated
  using (bucket_id = 'documents');

create policy documents_bucket_write_admin
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'documents' and public.is_admin());

create policy documents_bucket_delete_admin
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'documents' and public.is_admin());
