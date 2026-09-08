// Supabase Edge Function: notify-admin
//
// Called by the frontend right after a manager successfully creates an
// event, submits their monthly report, or sends an event request. It:
//   1) looks up the CALLER's own profile server-side (never trusts a
//      manager/club name sent from the browser),
//   2) records a row in admin_notifications,
//   3) emails the coordinator via Gmail SMTP.
//
// If the caller is the admin, this is a no-op (we don't notify the admin
// about their own actions).
//
// Secrets required (set with `supabase secrets set ...`):
//   GMAIL_USER          — the sending Gmail address, e.g. you@gmail.com
//   GMAIL_APP_PASSWORD  — a 16-char Google App Password (NOT your normal
//                          Gmail password — requires 2FA enabled on the
//                          account, generate at myaccount.google.com/apppasswords)
//   ADMIN_EMAIL         — the coordinator's real inbox, e.g. you@example.com
//   GMAIL_FROM_NAME      — optional display name, defaults to "EventHub"

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import nodemailer from 'npm:nodemailer@6.9.10'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

const ACTION_LABELS: Record<string, string> = {
  event: 'a créé un événement',
  report: 'a soumis son rapport mensuel',
  event_request: "a envoyé une demande d'événement",
}

// Reused across invocations on a warm isolate — building a fresh SMTP
// connection per request would be wasteful and slower.
let cachedTransport: ReturnType<typeof nodemailer.createTransport> | null = null

function getTransport(gmailUser: string, gmailAppPassword: string) {
  if (!cachedTransport) {
    cachedTransport = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true, // true = TLS on connect (required for port 465)
      auth: { user: gmailUser, pass: gmailAppPassword },
    })
  }
  return cachedTransport
}

async function sendEmail(
  gmailUser: string,
  gmailAppPassword: string,
  from: string,
  to: string,
  subject: string,
  html: string,
) {
  const transport = getTransport(gmailUser, gmailAppPassword)
  await new Promise<void>((resolve, reject) => {
    transport.sendMail({ from, to, subject, html }, (error) => {
      if (error) return reject(error instanceof Error ? error : new Error(String(error)))
      resolve()
    })
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
    const GMAIL_USER = Deno.env.get('GMAIL_USER')
    const GMAIL_APP_PASSWORD = Deno.env.get('GMAIL_APP_PASSWORD')
    const ADMIN_EMAIL = Deno.env.get('ADMIN_EMAIL')
    if (!GMAIL_USER) {
      console.error('❌ GMAIL_USER NOT FOUND')
    } else {
      console.log('✅ GMAIL_USER FOUND')
    }
    if (!GMAIL_APP_PASSWORD) {
      console.error('❌ GMAIL_APP_PASSWORD NOT FOUND')
    } else {
      console.log('✅ GMAIL_APP_PASSWORD FOUND')
    }
    if (!ADMIN_EMAIL) {
      console.error('❌ ADMIN_EMAIL NOT FOUND')
    } else {
      console.log('✅ ADMIN_EMAIL FOUND')
    }

    const FROM_NAME = Deno.env.get('GMAIL_FROM_NAME') ?? 'EventHub'
    // Gmail requires the From header to be the authenticated account (or a
    // verified "Send As" alias) — so we build it from GMAIL_USER, never from
    // a client-supplied value.
    const FROM_EMAIL = GMAIL_USER ? `${FROM_NAME} <${GMAIL_USER}>` : undefined

    const authHeader = req.headers.get('Authorization') ?? ''
    if (!authHeader) return json({ error: 'Missing Authorization header' }, 401)

    const caller = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })
    const {
      data: { user },
    } = await caller.auth.getUser()
    if (!user) return json({ error: 'Not authenticated' }, 401)

    const { data: profile, error: profileError } = await caller
      .from('profiles')
      .select('id, manager_name, email, role, club_id, club:clubs(name)')
      .eq('auth_user_id', user.id)
      .single()
    if (profileError || !profile) return json({ error: 'Profile not found.' }, 404)

    // Admins don't need to be notified about their own actions.
    if (profile.role === 'admin') return json({ skipped: true })
    if (!profile.club_id) return json({ error: 'No club associated with this account.' }, 400)

    const body = await req.json()
    const { action_type, summary, related_id } = body as {
      action_type: string
      summary: string
      related_id?: string
    }
    if (!action_type || !ACTION_LABELS[action_type] || !summary) {
      return json({ error: 'Valid action_type and summary are required.' }, 400)
    }

    const clubName = (profile.club as { name: string } | null)?.name ?? 'Club inconnu'

    const { data: notification, error: insertError } = await caller
      .from('admin_notifications')
      .insert({
        action_type,
        club_id: profile.club_id,
        club_name: clubName,
        manager_profile_id: profile.id,
        manager_name: profile.manager_name,
        manager_email: profile.email ?? null,
        summary,
        related_id: related_id ?? null,
      })
      .select()
      .single()
    if (insertError) return json({ error: insertError.message }, 400)

    // Email is best-effort: the notification row is already saved, so a
    // failure here never blocks or loses the manager's underlying action.
    if (GMAIL_USER && GMAIL_APP_PASSWORD && ADMIN_EMAIL && FROM_EMAIL) {
      try {
        await sendEmail(
          GMAIL_USER,
          GMAIL_APP_PASSWORD,
          FROM_EMAIL,
          ADMIN_EMAIL,
          `EventHub — ${profile.manager_name} ${ACTION_LABELS[action_type]}`,
          `
            <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
              <h2 style="color:#3a56e8;">Nouvelle activité — EventHub</h2>
              <table style="width:100%; border-collapse: collapse; margin: 16px 0;">
                <tr><td style="padding:6px 0; color:#64748b;">Manager</td><td style="padding:6px 0; font-weight:600;">${profile.manager_name}</td></tr>
                <tr><td style="padding:6px 0; color:#64748b;">Club</td><td style="padding:6px 0; font-weight:600;">${clubName}</td></tr>
                <tr><td style="padding:6px 0; color:#64748b;">Action</td><td style="padding:6px 0; font-weight:600;">${ACTION_LABELS[action_type]}</td></tr>
                <tr><td style="padding:6px 0; color:#64748b;">Détails</td><td style="padding:6px 0;">${summary}</td></tr>
              </table>
              <p style="color:#64748b; font-size:13px;">Connectez-vous à EventHub → Notifications pour confirmer réception.</p>
            </div>
          `,
        )
      } catch (emailErr) {
        console.error('notify-admin: email send failed', emailErr)
      }
    }

    return json({ notification })
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Unexpected error' }, 500)
  }
})