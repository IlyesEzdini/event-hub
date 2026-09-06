create table if not exists public.event_requests (
  id                    uuid primary key default gen_random_uuid(),
  club_id               uuid not null references public.clubs(id) on delete cascade,
  created_by            uuid references public.profiles(id) on delete set null,
  -- Snapshot of the manager's name at submission time. A profile can later
  -- be renamed/replaced (see profiles.manager_name), but a request should
  -- always show who actually asked for it historically.
  submitted_by_name     text not null,

  objectifs             text,
  date_horaire          text,
  lieu                  text,
  plan_evenement        text,
  cibles                text,
  nombre_participants   int check (nombre_participants is null or nombre_participants >= 0),
  nombre_organisateurs  int check (nombre_organisateurs is null or nombre_organisateurs >= 0),
  liste_invites         text,
  interventions         text,
  besoins_logistiques   text,
  remarques             text,

  submitted_at          timestamptz not null default now()
);

create index if not exists idx_event_requests_club_id on public.event_requests(club_id);
create index if not exists idx_event_requests_submitted_at on public.event_requests(submitted_at desc);

alter table public.event_requests enable row level security;

-- A manager may read/create requests only for their own club; admins see
-- and manage all of them. Same club_id-verified-server-side pattern as
-- events/reports.
create policy event_requests_select_own_club_or_admin
  on public.event_requests for select
  to authenticated
  using (
    public.is_admin()
    or club_id = public.current_profile_club_id()
  );

create policy event_requests_insert_own_club_or_admin
  on public.event_requests for insert
  to authenticated
  with check (
    public.is_admin()
    or club_id = public.current_profile_club_id()
  );

create policy event_requests_delete_admin
  on public.event_requests for delete
  to authenticated
  using (public.is_admin());
EOF
echo written