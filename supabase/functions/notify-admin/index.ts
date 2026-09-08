// Supabase Edge Function: notify-admin
//
// Called by the frontend after a manager successfully:
//   - creates an event
//   - submits a monthly report
//   - sends an event request
//
// Responsibilities:
//   1. Authenticate the caller.
//   2. Look up the caller's profile server-side.
//   3. Create an admin_notifications row.
//   4. Send a professional email notification to the admin via Resend.
//
// IMPORTANT:
// - RESEND_API_KEY is SERVER-SIDE ONLY.
// - ADMIN_EMAIL is the coordinator/admin recipient.
// - FROM_EMAIL defaults to onboarding@resend.dev for testing.
// - With onboarding@resend.dev, Resend's testing restrictions apply.
//   For production delivery to arbitrary recipients, verify a domain.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
}

const ACTION_LABELS: Record<string, string> = {
  event: 'a créé un événement',
  report: 'a soumis son rapport mensuel',
  event_request: "a envoyé une demande d'événement",
}

/**
 * Basic HTML escaping.
 *
 * This prevents user-controlled values such as event names,
 * manager names or summaries from becoming executable HTML
 * inside the email.
 */
function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

/**
 * Send an email through Resend.
 */
async function sendEmail(
  resendApiKey: string,
  from: string,
  to: string,
  subject: string,
  html: string,
) {
  console.log('notify-admin: sending email through Resend...')
  console.log('notify-admin: recipient:', to)
  console.log('notify-admin: sender:', from)

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      html,
    }),
  })

  const responseText = await res.text()

  let responseData: unknown

  try {
    responseData = JSON.parse(responseText)
  } catch {
    responseData = responseText
  }

  console.log('notify-admin: Resend status:', res.status)
  console.log('notify-admin: Resend response:', responseData)

  if (!res.ok) {
    throw new Error(
      `Resend error (${res.status}): ${responseText}`,
    )
  }

  return responseData
}

Deno.serve(async (req) => {
  // ------------------------------------------------------------
  // CORS
  // ------------------------------------------------------------

  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders,
    })
  }

  // Only POST is allowed.
  if (req.method !== 'POST') {
    return json(
      {
        error: 'Method not allowed.',
      },
      405,
    )
  }

  try {
    console.log('========================================')
    console.log('notify-admin: function started')
    console.log('========================================')

    // ----------------------------------------------------------
    // ENVIRONMENT VARIABLES
    // ----------------------------------------------------------

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
    const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
    const ADMIN_EMAIL = Deno.env.get('ADMIN_EMAIL')

    const FROM_EMAIL =
      Deno.env.get('FROM_EMAIL') ??
      'EventHub <onboarding@resend.dev>'

    console.log('notify-admin: configuration check:')
    console.log(
      '  SUPABASE_URL:',
      SUPABASE_URL ? 'OK' : 'MISSING',
    )
    console.log(
      '  SUPABASE_ANON_KEY:',
      ANON_KEY ? 'OK' : 'MISSING',
    )
    console.log(
      '  RESEND_API_KEY:',
      RESEND_API_KEY ? 'OK' : 'MISSING',
    )
    console.log(
      '  ADMIN_EMAIL:',
      ADMIN_EMAIL ? ADMIN_EMAIL : 'MISSING',
    )
    console.log('  FROM_EMAIL:', FROM_EMAIL)

    // These are required for the function itself.
    if (!SUPABASE_URL) {
      return json(
        {
          error: 'SUPABASE_URL is not configured.',
        },
        500,
      )
    }

    if (!ANON_KEY) {
      return json(
        {
          error: 'SUPABASE_ANON_KEY is not configured.',
        },
        500,
      )
    }

    // ----------------------------------------------------------
    // AUTHENTICATION
    // ----------------------------------------------------------

    const authHeader =
      req.headers.get('Authorization') ?? ''

    if (!authHeader) {
      return json(
        {
          error: 'Missing Authorization header.',
        },
        401,
      )
    }

    const caller = createClient(
      SUPABASE_URL,
      ANON_KEY,
      {
        global: {
          headers: {
            Authorization: authHeader,
          },
        },
      },
    )

    const {
      data: { user },
      error: authError,
    } = await caller.auth.getUser()

    if (authError) {
      console.error(
        'notify-admin: authentication error:',
        authError,
      )

      return json(
        {
          error: 'Authentication failed.',
        },
        401,
      )
    }

    if (!user) {
      return json(
        {
          error: 'Not authenticated.',
        },
        401,
      )
    }

    console.log(
      'notify-admin: authenticated user:',
      user.id,
    )

    // ----------------------------------------------------------
    // GET CALLER PROFILE
    // ----------------------------------------------------------

    const {
      data: profile,
      error: profileError,
    } = await caller
      .from('profiles')
      .select(
        `
        id,
        manager_name,
        email,
        role,
        club_id,
        club:clubs(name)
        `,
      )
      .eq('auth_user_id', user.id)
      .single()

    if (profileError) {
      console.error(
        'notify-admin: profile lookup failed:',
        profileError,
      )

      return json(
        {
          error: 'Unable to load user profile.',
          details: profileError.message,
        },
        500,
      )
    }

    if (!profile) {
      return json(
        {
          error: 'Profile not found.',
        },
        404,
      )
    }

    console.log(
      'notify-admin: profile:',
      {
        id: profile.id,
        role: profile.role,
        manager_name: profile.manager_name,
        club_id: profile.club_id,
      },
    )

    // ----------------------------------------------------------
    // ADMIN USERS DON'T NEED SELF-NOTIFICATIONS
    // ----------------------------------------------------------

    if (profile.role === 'admin') {
      console.log(
        'notify-admin: caller is admin, skipping notification.',
      )

      return json({
        skipped: true,
        reason: 'Admin actions do not generate admin notifications.',
      })
    }

    if (!profile.club_id) {
      return json(
        {
          error: 'No club associated with this account.',
        },
        400,
      )
    }

    // ----------------------------------------------------------
    // READ REQUEST BODY
    // ----------------------------------------------------------

    let body: {
      action_type?: string
      summary?: string
      related_id?: string
    }

    try {
      body = await req.json()
    } catch {
      return json(
        {
          error: 'Invalid JSON request body.',
        },
        400,
      )
    }

    const {
      action_type,
      summary,
      related_id,
    } = body

    if (
      !action_type ||
      !ACTION_LABELS[action_type] ||
      !summary
    ) {
      return json(
        {
          error:
            'Valid action_type and summary are required.',
        },
        400,
      )
    }

    // ----------------------------------------------------------
    // CLUB NAME
    // ----------------------------------------------------------

    const clubName =
      (
        profile.club as {
          name: string
        } | null
      )?.name ?? 'Club inconnu'

    // ----------------------------------------------------------
    // CREATE IN-APP ADMIN NOTIFICATION
    // ----------------------------------------------------------

    const {
      data: notification,
      error: insertError,
    } = await caller
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

    if (insertError) {
      console.error(
        'notify-admin: notification insert failed:',
        insertError,
      )

      return json(
        {
          error: insertError.message,
        },
        400,
      )
    }

    console.log(
      'notify-admin: notification row created:',
      notification.id,
    )

    // ----------------------------------------------------------
    // SEND EMAIL
    // ----------------------------------------------------------

    let emailStatus:
      | {
          sent: boolean
          id?: string
          error?: string
        }
      = {
        sent: false,
      }

    // Instead of silently skipping email when configuration is
    // missing, explicitly log the problem.
    if (!RESEND_API_KEY) {
      console.error(
        'notify-admin: RESEND_API_KEY is NOT configured.',
      )

      emailStatus = {
        sent: false,
        error:
          'RESEND_API_KEY is not configured in Supabase Edge Function secrets.',
      }
    } else if (!ADMIN_EMAIL) {
      console.error(
        'notify-admin: ADMIN_EMAIL is NOT configured.',
      )

      emailStatus = {
        sent: false,
        error:
          'ADMIN_EMAIL is not configured in Supabase Edge Function secrets.',
      }
    } else {
      try {
        const managerName = escapeHtml(
          profile.manager_name,
        )

        const safeClubName = escapeHtml(clubName)
        const safeSummary = escapeHtml(summary)

        const actionLabel = escapeHtml(
          ACTION_LABELS[action_type],
        )

        const subject =
          `EventHub — ${profile.manager_name} ${ACTION_LABELS[action_type]}`

        const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>EventHub Notification</title>
</head>

<body style="
  margin:0;
  padding:0;
  background:#f1f5f9;
  font-family:Arial,Helvetica,sans-serif;
  color:#0f172a;
">

  <div style="
    max-width:600px;
    margin:0 auto;
    padding:32px 16px;
  ">

    <!-- Card -->
    <div style="
      background:#ffffff;
      border-radius:16px;
      overflow:hidden;
      border:1px solid #e2e8f0;
      box-shadow:0 4px 16px rgba(15,23,42,0.08);
    ">

      <!-- Header -->
      <div style="
        background:#3a56e8;
        padding:28px 32px;
        color:#ffffff;
      ">

        <div style="
          font-size:13px;
          font-weight:600;
          letter-spacing:1px;
          text-transform:uppercase;
          opacity:0.85;
          margin-bottom:8px;
        ">
          EventHub
        </div>

        <div style="
          font-size:24px;
          font-weight:700;
          line-height:1.3;
        ">
          Nouvelle activité
        </div>

      </div>

      <!-- Content -->
      <div style="
        padding:32px;
      ">

        <p style="
          margin:0 0 24px;
          font-size:16px;
          line-height:1.6;
          color:#334155;
        ">
          Une nouvelle activité nécessite votre attention.
        </p>

        <!-- Details -->
        <div style="
          border:1px solid #e2e8f0;
          border-radius:12px;
          overflow:hidden;
          margin-bottom:24px;
        ">

          <div style="
            padding:16px 18px;
            border-bottom:1px solid #e2e8f0;
          ">
            <div style="
              font-size:12px;
              color:#64748b;
              margin-bottom:5px;
            ">
              Manager
            </div>

            <div style="
              font-size:15px;
              font-weight:600;
              color:#0f172a;
            ">
              ${managerName}
            </div>
          </div>

          <div style="
            padding:16px 18px;
            border-bottom:1px solid #e2e8f0;
          ">
            <div style="
              font-size:12px;
              color:#64748b;
              margin-bottom:5px;
            ">
              Club
            </div>

            <div style="
              font-size:15px;
              font-weight:600;
              color:#0f172a;
            ">
              ${safeClubName}
            </div>
          </div>

          <div style="
            padding:16px 18px;
            border-bottom:1px solid #e2e8f0;
          ">
            <div style="
              font-size:12px;
              color:#64748b;
              margin-bottom:5px;
            ">
              Action
            </div>

            <div style="
              font-size:15px;
              font-weight:600;
              color:#0f172a;
            ">
              ${actionLabel}
            </div>
          </div>

          <div style="
            padding:16px 18px;
          ">
            <div style="
              font-size:12px;
              color:#64748b;
              margin-bottom:5px;
            ">
              Détails
            </div>

            <div style="
              font-size:15px;
              line-height:1.6;
              color:#334155;
            ">
              ${safeSummary}
            </div>
          </div>

        </div>

        <!-- CTA -->
        <div style="
          text-align:center;
          margin:28px 0 8px;
        ">

          <div style="
            display:inline-block;
            background:#3a56e8;
            color:#ffffff;
            padding:12px 22px;
            border-radius:8px;
            font-size:14px;
            font-weight:600;
          ">
            Consultez EventHub
          </div>

        </div>

      </div>

      <!-- Footer -->
      <div style="
        padding:20px 32px;
        background:#f8fafc;
        border-top:1px solid #e2e8f0;
        text-align:center;
      ">

        <p style="
          margin:0;
          color:#64748b;
          font-size:12px;
          line-height:1.5;
        ">
          Notification automatique envoyée par EventHub.
        </p>

      </div>

    </div>

  </div>

</body>
</html>
        `

        const resendResult = await sendEmail(
          RESEND_API_KEY,
          FROM_EMAIL,
          ADMIN_EMAIL,
          subject,
          html,
        )

        const resendId =
          typeof resendResult === 'object' &&
          resendResult !== null &&
          'id' in resendResult
            ? String(
                (resendResult as { id?: unknown }).id ??
                  '',
              )
            : undefined

        emailStatus = {
          sent: true,
          id: resendId,
        }

        console.log(
          'notify-admin: EMAIL SENT SUCCESSFULLY',
          resendId ?? '',
        )
      } catch (emailErr) {
        const message =
          emailErr instanceof Error
            ? emailErr.message
            : String(emailErr)

        console.error(
          'notify-admin: EMAIL SEND FAILED:',
          message,
        )

        emailStatus = {
          sent: false,
          error: message,
        }

        // IMPORTANT:
        // The database notification has already been created.
        // We intentionally do NOT fail the manager's original action
        // because an email provider failure should not delete the
        // in-app notification.
      }
    }

    // ----------------------------------------------------------
    // FINAL RESPONSE
    // ----------------------------------------------------------

    return json({
      success: true,
      notification,
      email: emailStatus,
    })
  } catch (err) {
    console.error(
      'notify-admin: unexpected error:',
      err,
    )

    return json(
      {
        error:
          err instanceof Error
            ? err.message
            : 'Unexpected error',
      },
      500,
    )
  }
})