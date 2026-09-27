// Supabase Edge Function: notify-interviewer
//
// Called after an interview is successfully inserted. It verifies that the
// authenticated caller is either the dean who created the interview or the
// coordinator assigned to it, then emails the selected coordinator.
//
// Secrets required:
//   GMAIL_USER
//   GMAIL_APP_PASSWORD
//   GMAIL_FROM_NAME (optional)

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

let cachedTransport: ReturnType<typeof nodemailer.createTransport> | null = null

function getTransport(gmailUser: string, gmailAppPassword: string) {
  if (!cachedTransport) {
    cachedTransport = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
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

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
    const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const GMAIL_USER = Deno.env.get('GMAIL_USER')
    const GMAIL_APP_PASSWORD = Deno.env.get('GMAIL_APP_PASSWORD')
    const FROM_NAME = Deno.env.get('GMAIL_FROM_NAME') ?? 'EventHub'
    const FROM_EMAIL = GMAIL_USER ? `${FROM_NAME} <${GMAIL_USER}>` : undefined

    if (!GMAIL_USER || !GMAIL_APP_PASSWORD || !FROM_EMAIL) {
      return json({ error: 'Email service is not configured.' }, 500)
    }

    const authHeader = req.headers.get('Authorization') ?? ''
    if (!authHeader) return json({ error: 'Missing Authorization header' }, 401)

    const caller = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })

    const {
      data: { user },
      error: authError,
    } = await caller.auth.getUser()

    if (authError || !user) return json({ error: 'Not authenticated' }, 401)

    const body = await req.json()
    const { interview_id } = body as { interview_id?: string }
    if (!interview_id) return json({ error: 'interview_id is required.' }, 400)

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

    const { data: callerProfile } = await admin
      .from('profiles')
      .select('id, manager_name, role')
      .eq('auth_user_id', user.id)
      .maybeSingle()

    const { data: coordinator } = await admin
      .from('coordinators')
      .select('email, username, field')
      .ilike('email', user.email ?? '')
      .maybeSingle()

    const { data: interview, error: interviewError } = await admin
      .from('interviews')
      .select(`
        id,
        dean_id,
        club_id,
        interview_date,
        interview_time,
        place,
        poste,
        department,
        coordinator_emails,
        status,
        club:clubs(name),
        dean:profiles!interviews_dean_profile_id_fkey(manager_name, email)
      `)
      .eq('id', interview_id)
      .single()

    if (interviewError || !interview) {
      return json({ error: interviewError?.message ?? 'Interview not found.' }, 404)
    }

    const isDeanCaller = callerProfile?.role === 'dean' && callerProfile.id === interview.dean_profile_id
    const isCoordinatorCaller = Boolean(
      coordinator && coordinator.email.toLowerCase() === interview.coordinator_email.toLowerCase(),
    )

    if (!isDeanCaller && !isCoordinatorCaller) {
      return json({ error: 'You are not a participant in this interview.' }, 403)
    }

    const club = interview.club as { name?: string } | null
    const dean = interview.dean as { manager_name?: string; email?: string | null } | null
    const coordinatorEmail = interview.coordinator_email
    const date = new Date(`${interview.interview_date}T00:00:00`).toLocaleDateString('fr-FR')
    const time = String(interview.interview_time).slice(0, 5)

    await sendEmail(
      GMAIL_USER,
      GMAIL_APP_PASSWORD,
      FROM_EMAIL,
      coordinatorEmail,
      `EventHub — Nouvel entretien · ${club?.name ?? 'Club'}`,
      `
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#334155;">
          <h2 style="color:#3a56e8;">Nouvel entretien EventHub</h2>
          <p>Un entretien vous a été attribué dans EventHub.</p>
          <table style="width:100%;border-collapse:collapse;margin:18px 0;">
            <tr><td style="padding:7px 0;color:#64748b;">Dean</td><td style="padding:7px 0;font-weight:600;">${escapeHtml(dean?.manager_name ?? '—')}</td></tr>
            <tr><td style="padding:7px 0;color:#64748b;">Club</td><td style="padding:7px 0;font-weight:600;">${escapeHtml(club?.name ?? '—')}</td></tr>
            <tr><td style="padding:7px 0;color:#64748b;">Date</td><td style="padding:7px 0;font-weight:600;">${escapeHtml(date)}</td></tr>
            <tr><td style="padding:7px 0;color:#64748b;">Heure</td><td style="padding:7px 0;font-weight:600;">${escapeHtml(time)}</td></tr>
            <tr><td style="padding:7px 0;color:#64748b;">Lieu</td><td style="padding:7px 0;font-weight:600;">${escapeHtml(interview.place)}</td></tr>
            <tr><td style="padding:7px 0;color:#64748b;">Poste</td><td style="padding:7px 0;font-weight:600;">${escapeHtml(interview.poste)}</td></tr>
            <tr><td style="padding:7px 0;color:#64748b;">Département</td><td style="padding:7px 0;font-weight:600;">${escapeHtml(interview.department)}</td></tr>
          </table>
          <p style="color:#64748b;font-size:13px;">Connectez-vous à EventHub pour consulter ou modifier cet entretien.</p>
        </div>
      `,
    )

    return json({ sent: true, interview_id })
  } catch (err) {
    console.error('notify-interviewer failed:', err)
    return json({ error: err instanceof Error ? err.message : 'Unexpected error' }, 500)
  }
})
