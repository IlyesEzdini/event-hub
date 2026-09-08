// Supabase Edge Function: confirm-notification
//
// Called by the admin from the in-app Notifications page. Verifies the
// caller is the admin, marks the notification confirmed, and emails the
// manager a message tailored to what they did.
//
// Secrets required (same as notify-admin):
//   RESEND_API_KEY, FROM_EMAIL (optional)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

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

async function sendEmail(apiKey: string, from: string, to: string, subject: string, html: string) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to: [to], subject, html }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Resend error (${res.status}): ${text}`)
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
    const FROM_EMAIL = Deno.env.get('FROM_EMAIL') ?? 'EventHub <onboarding@resend.dev>'

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

    if (RESEND_API_KEY && existing.manager_email) {
      const template = MANAGER_MESSAGES[existing.action_type]
      if (template) {
        try {
          await sendEmail(
            RESEND_API_KEY,
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