# EventHub — Club Event Coordination Platform

A production-quality web app for coordinating ~30 event managers across
different clubs: shared calendar, monthly reports, manager/club management,
and a document resource center — built on React + TypeScript + Vite +
Tailwind CSS + Supabase (Auth, Postgres, Storage, Edge Functions).

---

## A. Architecture Overview

```
Browser (React SPA)
  │  supabase-js (anon key only)
  ▼
Supabase
  ├─ Auth            → real sessions, persisted, auto-refreshed
  ├─ Postgres + RLS   → clubs, profiles, events, reports, documents
  ├─ Storage          → "documents" bucket (private, signed URLs)
  └─ Edge Function     "manage-manager" → the ONLY place the service-role
                        key is used, for admin account operations
                        (create / replace / change password / disable)
```

Key principle: **the club is the stable entity, the manager is the person
currently assigned to it.** Events and reports have a `club_id` foreign key,
never a manager name — so replacing a manager never touches historical data
(see §35/§17 of the original spec).

Authorization is enforced twice, on purpose:
1. In the UI (so people don't hit walls), and
2. In Postgres via Row Level Security (so the UI's checks are not the only
   thing standing between a manager and another club's data).

## B. Database Schema

See [`supabase/schema.sql`](./supabase/schema.sql) for the full, ready-to-run
SQL. Summary:

| Table | Purpose | Key constraints |
|---|---|---|
| `clubs` | stable org entity | `name` unique |
| `profiles` | one row per human (admin or manager), 1:1 with `auth.users` | `role in ('admin','manager')`, manager requires `club_id` |
| `events` | shared calendar items | `club_id` FK, `created_by` FK |
| `reports` | monthly report per club | `UNIQUE(club_id, month, year)`, `active_members <= members` |
| `documents` | resource center metadata | `file_path` points into Storage |

## C. Complete Source Code

Everything is in `src/`:

```
src/
  components/   # layout (sidebar/mobile nav), ui primitives, event/report forms, calendar
  contexts/     # AuthContext — session + profile (role/club) state
  hooks/        # useClubs, useEvents, useReports, useManagers, useDocuments
  layouts/      # AppLayout (sidebar + content shell)
  lib/          # supabase.ts client
  pages/        # Login, dashboards, Calendar, Reports, Resources, Profile
  pages/admin/  # Managers, Clubs, admin Reports
  services/     # thin DB-access functions per table
  types/        # database.ts domain types
  utils/        # auth.ts (username↔email), reportStatus.ts
supabase/
  schema.sql               # tables, constraints, indexes, RLS
  seed.sql                 # example clubs + first-admin instructions
  functions/manage-manager/index.ts   # privileged account-management Edge Function
```

## D. Supabase SQL

Paste [`supabase/schema.sql`](./supabase/schema.sql) into the Supabase SQL
Editor and run it once. It's idempotent-ish (`create table if not exists`,
`on conflict do nothing` where relevant) so re-running is safe.

## E. RLS / Security Explanation

- `clubs`: readable by every authenticated user (needed for dropdowns);
  writable only by admins.
- `profiles`: a manager can read only their own row; admins can read all.
  Only admins can insert/update/delete profiles — a manager can never
  self-promote to admin or move themselves to another club.
- `events`: readable by everyone (genuinely shared calendar). A manager can
  **insert/update/delete only where `club_id` equals their own profile's
  `club_id`**, checked server-side via a `security definer` helper function
  (`current_profile_club_id()`) — sending a different `club_id` from the
  browser is rejected by Postgres, not just hidden by the UI.
- `reports`: same pattern — a manager can only read/write their own club's
  reports. Admins bypass via `is_admin()`.
- `documents`: readable by all authenticated users; only admins can
  upload/delete (both the DB row and the Storage object, via matching
  Storage bucket policies).
- Passwords are never stored by this app directly — Supabase Auth stores a
  salted hash. The frontend only ever holds a JWT session, not credentials.
- The Supabase **service role key** is never in the frontend. It lives only
  as a secret on the `manage-manager` Edge Function, which itself re-checks
  that the caller's own profile has `role = 'admin'` before doing anything
  privileged.

## F. Environment Variable Setup

```bash
cp .env.example .env
```

Fill in:
```
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_PUBLIC_KEY
```
Both are in Supabase Dashboard → Settings → API. Never put the
`service_role` key here — it belongs only in the Edge Function's secrets.

## G. How to Run Locally

```bash
npm install
cp .env.example .env   # then fill in your credentials
npm run dev
```
Open http://localhost:5173.

To deploy the Edge Function (requires the Supabase CLI):
```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase functions deploy manage-manager
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
```
(`SUPABASE_URL` and `SUPABASE_ANON_KEY` are already injected automatically
into Edge Functions by Supabase.)

Also create the Storage bucket policies and enable Storage if not already
enabled — `schema.sql` creates the `documents` bucket for you.

## H. How to Create the First Admin

1. In Supabase Dashboard → Authentication → Users → **Add user**, create a
   user with email `admin@members.eventhub.internal` (this matches the
   username→email mapping in `src/utils/auth.ts` for username `admin`) and
   a password of your choice. Confirm the email.
2. In the SQL editor, insert their profile as admin:
   ```sql
   insert into public.profiles (auth_user_id, manager_name, username, role, club_id)
   values (
     (select id from auth.users where email = 'admin@members.eventhub.internal'),
     'Coordinator',
     'admin',
     'admin',
     null
   );
   ```
3. Log in at `/login` with username `admin` and that password.
4. From there, use **Managers → Add Manager** in the app to create your ~30
   real event manager accounts (this goes through the Edge Function, so
   their passwords are set correctly and hashed by Supabase Auth — no more
   manual SQL needed after this point).

## I. How to Deploy

- **Frontend**: `npm run build` produces `dist/`; deploy it to Vercel,
  Netlify, Cloudflare Pages, or any static host. Set the two `VITE_*` env
  vars in that host's dashboard.
- **Backend**: already Supabase-hosted once you've run `schema.sql` and
  deployed the `manage-manager` function (see §G).

## J. Assumptions Made

- **Login uses "username" as requested**, but Supabase Auth is
  email-native, so each username is deterministically mapped to
  `username@members.eventhub.internal` for Auth purposes only — this is
  invisible to users, who only ever see/type their username.
- Initial manager password is whatever the admin sets in the "Add Manager"
  form (spec's "password = manager name" convention is easy to follow
  operationally, but the admin can choose anything ≥ 6 characters).
- "Replace a manager" is implemented as editing the existing profile's
  name/username/club (via the Edge Function) rather than deleting and
  recreating an account, since that's what actually preserves auth history
  cleanly; the club_id foreign key on events/reports means historical data
  is unaffected either way.
- Report `status` model is `draft | submitted`; "Overdue" is a derived UI
  label (draft/missing + past month-end), not a stored value, so it never
  needs a scheduled job to update it.
- Document files are stored in a private Supabase Storage bucket and served
  via short-lived signed URLs rather than public URLs.
- Calendar is a custom-built responsive month-grid component (no external
  calendar library) to keep the bundle small and the styling fully under
  the app's own design system.

## Roadmap hooks already in place

The schema and service-layer split make it straightforward to later add:
event attachments (extra table + Storage bucket), activity logs
(`created_by`/timestamps already present), email notifications (trigger an
Edge Function on `reports`/`events` changes), CSV/PDF export (client-side
from already-fetched data), and search/filtering (already-loaded arrays;
swap to server-side `.ilike()` filters if data volume grows).
