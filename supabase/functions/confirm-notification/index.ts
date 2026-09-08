// Supabase Edge Function: confirm-notification
//
// Called by the admin from the in-app Notifications page. Verifies the
// caller is the admin, marks the notification confirmed, and emails the
// manager a message tailored to what they did.
//
// Secrets required (same as notify-admin):
//   GMAIL_USER, GMAIL_APP_PASSWORD, GMAIL_FROM_NAME (optional)

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

const MANAGER_MESSAGES: Record<string, { subject: string; body: string }> = {
  event: {
    subject: 'Votre événement a bien été pris en compte',
    body: "Bonjour,<br/><br/>Le coordinateur a bien reçu et pris en compte l'événement que vous avez créé. Merci pour votre travail !",
  },
  report: {
    subject: 'Votre rapport mensuel a bien été reçu',
    body: 'Bonjour,<br/><br/>Le coordinateur a bien reçu et examiné votre rapport mensuel. Merci pour votre suivi régulier !',
  },
  event_request: {
    subject: "Votre demande d'événement a bien été reçue",
    body: "Bonjour,<br/><br/>Le coordinateur a bien reçu et examiné votre demande d'événement. Vous serez informé(e) de la suite.",
  },
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

    const { data: callerProfile, error: callerProfileError } = await caller
      .from('profiles')
      .select('role')
      .eq('auth_user_id', user.id)
      .single()
    if (callerProfileError || callerProfile?.role !== 'admin') {
      return json({ error: 'Only the admin can confirm notifications.' }, 403)
    }

    const { notification_id } = await req.json()
    if (!notification_id) return json({ error: 'notification_id is required.' }, 400)

    const { data: existing, error: findError } = await caller
      .from('admin_notifications')
      .select('*')
      .eq('id', notification_id)
      .single()
    if (findError || !existing) return json({ error: 'Notification not found.' }, 404)

    const { data: notification, error: updateError } = await caller
      .from('admin_notifications')
      .update({ status: 'confirmed', confirmed_at: new Date().toISOString() })
      .eq('id', notification_id)
      .select()
      .single()
    if (updateError) return json({ error: updateError.message }, 400)

    if (GMAIL_USER && GMAIL_APP_PASSWORD && FROM_EMAIL && existing.manager_email) {
      const template = MANAGER_MESSAGES[existing.action_type]
      if (template) {
        try {
          await sendEmail(
            GMAIL_USER,
            GMAIL_APP_PASSWORD,
            FROM_EMAIL,
            existing.manager_email,
            template.subject,
            `
              <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
                <h2 style="color:#3a56e8;">EventHub</h2>
                <p style="color:#334155; line-height:1.6;">${template.body}</p>
                <p style="color:#94a3b8; font-size:12px; margin-top:24px;">${existing.club_name}</p>
              </div>
            `,
          )
        } catch (emailErr) {
          console.error('confirm-notification: email send failed', emailErr)
        }
      }
    }

    return json({ notification })
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Unexpected error' }, 500)
  }
})