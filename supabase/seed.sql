-- =====================================================================
-- OPTIONAL example/seed data. Uses clearly fake placeholder names —
-- replace with your real clubs/managers via the Admin > Managers UI.
--
-- IMPORTANT: Supabase Auth users cannot be created with plain SQL
-- (passwords must go through supabase-js/GoTrue so they're hashed
-- correctly). Do ONE of the following instead:
--
--   1) Recommended: log in as the admin and use Admin > Managers >
--      "Add Manager" in the app itself — it calls supabase.auth to
--      create each account correctly, then this schema's trigger-free
--      design lets you insert the matching profile row.
--
--   2) Use the Supabase Dashboard > Authentication > Users > "Add user"
--      to create the auth user (email = username@members.eventhub.internal,
--      per src/utils/auth.ts), then run the INSERT statements below with
--      the resulting auth user's UUID.
--
-- The block below only seeds the CLUBS table, which is pure data and
-- safe to run directly.
-- =====================================================================

insert into public.clubs (name) values
  ('Club Alpha (example)'),
  ('Club Beta (example)'),
  ('Club Gamma (example)')
on conflict (name) do nothing;

-- After creating your admin auth user (see README "Create the first
-- admin"), promote it to role = 'admin' with:
--
-- update public.profiles set role = 'admin', club_id = null
-- where username = 'admin';
