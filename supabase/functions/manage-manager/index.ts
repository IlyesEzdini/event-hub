// Supabase Edge Function: manage-manager
//
// Creating/updating Supabase Auth users (setting passwords, changing email,
// disabling accounts) requires the SERVICE ROLE key, which must never be
// shipped to the browser. This function runs on Supabase's servers, holds
// the service role key only as a function secret, and is the single place
// privileged account-management operations happen.
//
// Deploy with:
//   supabase functions deploy manage-manager
// Set secrets with:
//   supabase secrets set SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=...
// (SUPABASE_URL / SUPABASE_ANON_KEY are already provided automatically in
// the Edge Function runtime; SUPABASE_SERVICE_ROLE_KEY must be set manually.)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const USERNAME_DOMAIN = 'members.eventhub.internal'
function usernameToEmail(username: string): string {
  const normalized = username.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '')
  return `${normalized}@${USERNAME_DOMAIN}`
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!

    const authHeader = req.headers.get('Authorization') ?? ''
    if (!authHeader) return json({ error: 'Missing Authorization header' }, 401)

    // Client scoped to the CALLER's JWT — used only to verify who is calling.
    const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })
    const {
      data: { user: caller },
    } = await callerClient.auth.getUser()
    if (!caller) return json({ error: 'Not authenticated' }, 401)

    const { data: callerProfile, error: callerProfileError } = await callerClient
      .from('profiles')
      .select('role')
      .eq('auth_user_id', caller.id)
      .single()

    if (callerProfileError || callerProfile?.role !== 'admin') {
      return json({ error: 'Only the admin can manage manager accounts.' }, 403)
    }

    // Elevated client — only used after the admin check above.
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

    const body = await req.json()
    const { action } = body

    if (action === 'create') {
      const { manager_name, username, password, club_id } = body
      if (!manager_name || !username || !password || !club_id) {
        return json({ error: 'manager_name, username, password and club_id are required.' }, 400)
      }
      const email = usernameToEmail(username)
      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      })
      if (createError) return json({ error: createError.message }, 400)

      const { data: profile, error: profileError } = await admin
        .from('profiles')
        .insert({
          auth_user_id: created.user.id,
          manager_name,
          username,
          club_id,
          role: 'manager',
        })
        .select('*, club:clubs(*)')
        .single()

      if (profileError) {
        // Roll back the auth user so we don't leave an orphaned account.
        await admin.auth.admin.deleteUser(created.user.id)
        return json({ error: profileError.message }, 400)
      }
      return json({ profile })
    }

    if (action === 'replace' || action === 'updateProfile') {
      // Rename the manager assigned to a club (or edit their display name),
      // WITHOUT touching club_id on any historical events/reports — those
      // stay linked to the club, not the manager.
      const { profile_id, manager_name, username, club_id } = body
      if (!profile_id) return json({ error: 'profile_id is required.' }, 400)

      const { data: existingProfile, error: findError } = await admin
        .from('profiles')
        .select('*')
        .eq('id', profile_id)
        .single()
      if (findError || !existingProfile) return json({ error: 'Manager not found.' }, 404)

      const updates: Record<string, unknown> = {}
      if (manager_name) updates.manager_name = manager_name
      if (club_id) updates.club_id = club_id
      if (username && username !== existingProfile.username) {
        const newEmail = usernameToEmail(username)
        const { error: emailError } = await admin.auth.admin.updateUserById(existingProfile.auth_user_id, {
          email: newEmail,
        })
        if (emailError) return json({ error: emailError.message }, 400)
        updates.username = username
      }

      const { data: profile, error: updateError } = await admin
        .from('profiles')
        .update(updates)
        .eq('id', profile_id)
        .select('*, club:clubs(*)')
        .single()
      if (updateError) return json({ error: updateError.message }, 400)
      return json({ profile })
    }

    if (action === 'updateCredentials') {
      const { profile_id, new_password } = body
      if (!profile_id || !new_password) return json({ error: 'profile_id and new_password are required.' }, 400)

      const { data: existingProfile, error: findError } = await admin
        .from('profiles')
        .select('auth_user_id')
        .eq('id', profile_id)
        .single()
      if (findError || !existingProfile) return json({ error: 'Manager not found.' }, 404)

      const { error: pwError } = await admin.auth.admin.updateUserById(existingProfile.auth_user_id, {
        password: new_password,
      })
      if (pwError) return json({ error: pwError.message }, 400)
      return json({ success: true })
    }

    if (action === 'setActive') {
      const { profile_id, is_active } = body
      if (!profile_id || typeof is_active !== 'boolean') {
        return json({ error: 'profile_id and is_active are required.' }, 400)
      }
      const { data: existingProfile, error: findError } = await admin
        .from('profiles')
        .select('auth_user_id')
        .eq('id', profile_id)
        .single()
      if (findError || !existingProfile) return json({ error: 'Manager not found.' }, 404)

      // Ban/unban in Supabase Auth so a disabled manager truly cannot sign in,
      // in addition to flagging is_active for UI purposes.
      await admin.auth.admin.updateUserById(existingProfile.auth_user_id, {
        ban_duration: is_active ? 'none' : '87600h',
      })
      const { data: profile, error: updateError } = await admin
        .from('profiles')
        .update({ is_active })
        .eq('id', profile_id)
        .select('*, club:clubs(*)')
        .single()
      if (updateError) return json({ error: updateError.message }, 400)
      return json({ profile })
    }

    return json({ error: `Unknown action: ${action}` }, 400)
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Unexpected error' }, 500)
  }
})
