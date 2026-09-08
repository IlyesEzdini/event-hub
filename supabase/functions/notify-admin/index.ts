// Supabase Edge Function: notify-admin
//
// Called by the frontend after a manager successfully:
//   - creates an event
//   - submits a monthly report
//   - submits an event request
//
// The function:
//   1. Authenticates the caller
//   2. Retrieves the caller's profile
//   3. Creates an admin_notifications row
//   4. Sends an email to the coordinator using Resend
//
// Required Edge Function secrets:
//
//   RESEND_API_KEY
//   ADMIN_EMAIL
//
// Optional:
//
//   FROM_EMAIL
//
// Default:
//
//   EventHub <onboarding@resend.dev>

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods':
    'POST, OPTIONS',
}

const ACTION_LABELS: Record<string, string> = {
  event: 'a créé un événement',
  report: 'a soumis son rapport mensuel',
  event_request: "a envoyé une demande d'événement",
}

function json(
  body: unknown,
  status = 200,
) {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    },
  )
}

function escapeHtml(
  value: string,
): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll(
      "'",
      '&#039;',
    )
}

async function sendEmail(
  apiKey: string,
  from: string,
  to: string,
  subject: string,
  html: string,
): Promise<string> {
  const response = await fetch(
    'https://api.resend.com/emails',
    {
      method: 'POST',

      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type':
          'application/json',
      },

      body: JSON.stringify({
        from,
        to: [to],
        subject,
        html,
      }),
    },
  )

  const payload =
    await response
      .json()
      .catch(() => ({}))

  if (!response.ok) {
    throw new Error(
      `Resend error (${response.status}): ${
        payload?.message ??
        'Unknown error'
      }`,
    )
  }

  return payload?.id ?? ''
}

Deno.serve(async (req) => {
  /*
   * VERY FIRST LOG.
   *
   * If you don't see this in Supabase logs after
   * creating an event/report/request, the frontend
   * is not reaching this Edge Function.
   */
  console.log(
    '🔥🔥🔥 notify-admin CALLED 🔥🔥🔥',
    req.method,
  )

  if (req.method === 'OPTIONS') {
    return new Response(
      'ok',
      {
        headers: corsHeaders,
      },
    )
  }

  if (req.method !== 'POST') {
    return json(
      {
        error:
          'Method not allowed.',
      },
      405,
    )
  }

  try {
    /*
     * --------------------------------------------------
     * Environment configuration
     * --------------------------------------------------
     */

    const SUPABASE_URL =
      Deno.env.get(
        'SUPABASE_URL',
      )

    const ANON_KEY =
      Deno.env.get(
        'SUPABASE_ANON_KEY',
      )

    const RESEND_API_KEY =
      Deno.env.get(
        'RESEND_API_KEY',
      )

    const ADMIN_EMAIL =
      Deno.env.get(
        'ADMIN_EMAIL',
      )

    const FROM_EMAIL =
      Deno.env.get(
        'FROM_EMAIL',
      ) ??
      'EventHub <onboarding@resend.dev>'

    console.log(
      '🔐 RESEND_API_KEY:',
      RESEND_API_KEY
        ? 'FOUND'
        : 'NOT FOUND',
    )

    console.log(
      '📧 ADMIN_EMAIL:',
      ADMIN_EMAIL
        ? 'FOUND'
        : 'NOT FOUND',
    )

    /*
     * --------------------------------------------------
     * Supabase runtime configuration
     * --------------------------------------------------
     */

    if (
      !SUPABASE_URL ||
      !ANON_KEY
    ) {
      console.error(
        '❌ Supabase runtime configuration is missing.',
      )

      return json(
        {
          error:
            'Supabase runtime configuration is missing.',
        },
        500,
      )
    }

    /*
     * --------------------------------------------------
     * Authentication
     * --------------------------------------------------
     */

    const authHeader =
      req.headers.get(
        'Authorization',
      ) ?? ''

    if (!authHeader) {
      console.error(
        '❌ Authorization header missing.',
      )

      return json(
        {
          error:
            'Missing Authorization header.',
        },
        401,
      )
    }

    const caller =
      createClient(
        SUPABASE_URL,
        ANON_KEY,
        {
          global: {
            headers: {
              Authorization:
                authHeader,
            },
          },
        },
      )

    const {
      data: {
        user,
      },
      error: userError,
    } =
      await caller.auth.getUser()

    if (
      userError ||
      !user
    ) {
      console.error(
        '❌ Authentication failed:',
        userError?.message ??
          'No user',
      )

      return json(
        {
          error:
            'Not authenticated.',
        },
        401,
      )
    }

    console.log(
      '👤 Authenticated user:',
      user.id,
    )

    /*
     * --------------------------------------------------
     * Get caller profile
     * --------------------------------------------------
     */

    const {
      data: profile,
      error: profileError,
    } = await caller
      .from('profiles')
      .select(
        'id, manager_name, email, role, club_id, club:clubs(name)',
      )
      .eq(
        'auth_user_id',
        user.id,
      )
      .single()

    if (
      profileError ||
      !profile
    ) {
      console.error(
        '❌ Profile lookup failed:',
        profileError?.message ??
          'Profile not found',
      )

      return json(
        {
          error:
            'Profile not found.',
        },
        404,
      )
    }

    console.log(
      '👤 Profile:',
      {
        id: profile.id,
        name: profile.manager_name,
        role: profile.role,
        clubId: profile.club_id,
      },
    )

    /*
     * --------------------------------------------------
     * Don't notify admin about admin actions
     * --------------------------------------------------
     */

    if (
      profile.role === 'admin'
    ) {
      console.log(
        'ℹ️ Admin action — notification skipped.',
      )

      return json({
        success: true,
        skipped: true,
      })
    }

    if (!profile.club_id) {
      return json(
        {
          error:
            'No club associated with this account.',
        },
        400,
      )
    }

    /*
     * --------------------------------------------------
     * Read request body
     * --------------------------------------------------
     */

    let body: {
      action_type?: string
      summary?: string
      related_id?: string | null
    }

    try {
      body =
        await req.json()
    } catch {
      return json(
        {
          error:
            'Invalid JSON body.',
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
      !ACTION_LABELS[
        action_type
      ] ||
      !summary?.trim()
    ) {
      return json(
        {
          error:
            'Valid action_type and summary are required.',
        },
        400,
      )
    }

    /*
     * --------------------------------------------------
     * Determine club
     * --------------------------------------------------
     */

    const clubName =
      (
        profile.club as {
          name: string
        } | null
      )?.name ??
      'Club inconnu'

    /*
     * --------------------------------------------------
     * Create notification
     * --------------------------------------------------
     */

    const {
      data: notification,
      error: insertError,
    } = await caller
      .from(
        'admin_notifications',
      )
      .insert({
        action_type,
        club_id:
          profile.club_id,
        club_name:
          clubName,
        manager_profile_id:
          profile.id,
        manager_name:
          profile.manager_name,
        manager_email:
          profile.email ??
          null,
        summary:
          summary.trim(),
        related_id:
          related_id ??
          null,
      })
      .select()
      .single()

    if (insertError) {
      console.error(
        '❌ admin_notifications insert failed:',
        insertError.message,
      )

      return json(
        {
          error:
            insertError.message,
        },
        400,
      )
    }

    console.log(
      '✅ Admin notification created:',
      notification.id,
    )

    /*
     * --------------------------------------------------
     * Send email
     * --------------------------------------------------
     */

    let emailSent =
      false

    let emailId:
      string | null = null

    let emailError:
      string | null = null

    if (
      !RESEND_API_KEY ||
      !ADMIN_EMAIL
    ) {
      emailError =
        'RESEND_API_KEY or ADMIN_EMAIL is not configured.'

      console.error(
        '❌',
        emailError,
      )
    } else {
      try {
        emailId =
          await sendEmail(
            RESEND_API_KEY,
            FROM_EMAIL,
            ADMIN_EMAIL,

            `EventHub — ${profile.manager_name} ${ACTION_LABELS[action_type]}`,

            `
              <div
                style="
                  margin:0;
                  background:#f1f5f9;
                  padding:32px 16px;
                  font-family:Arial,sans-serif;
                  color:#0f172a;
                "
              >

                <div
                  style="
                    max-width:560px;
                    margin:0 auto;
                    background:#ffffff;
                    border-radius:18px;
                    overflow:hidden;
                    border:1px solid #e2e8f0;
                  "
                >

                  <div
                    style="
                      background:linear-gradient(
                        135deg,
                        #3a56e8,
                        #2942bd
                      );
                      padding:26px 28px;
                      color:#fff;
                    "
                  >

                    <div
                      style="
                        font-size:13px;
                        font-weight:700;
                        letter-spacing:.08em;
                        text-transform:uppercase;
                        opacity:.85;
                      "
                    >
                      EventHub
                    </div>

                    <h1
                      style="
                        margin:8px 0 0;
                        font-size:24px;
                      "
                    >
                      Nouvelle activité
                    </h1>

                  </div>

                  <div
                    style="
                      padding:28px;
                    "
                  >

                    <p
                      style="
                        margin:0 0 20px;
                        font-size:16px;
                        line-height:1.6;
                      "
                    >
                      <strong>
                        ${escapeHtml(
                          profile.manager_name,
                        )}
                      </strong>

                      ${escapeHtml(
                        ACTION_LABELS[
                          action_type
                        ],
                      )}
                      .
                    </p>

                    <div
                      style="
                        border:1px solid #e2e8f0;
                        border-radius:12px;
                        padding:18px;
                        background:#f8fafc;
                      "
                    >

                      <p
                        style="
                          margin:0 0 10px;
                        "
                      >
                        <strong>
                          Club :
                        </strong>

                        ${escapeHtml(
                          clubName,
                        )}
                      </p>

                      <p
                        style="
                          margin:0 0 10px;
                        "
                      >
                        <strong>
                          Action :
                        </strong>

                        ${escapeHtml(
                          ACTION_LABELS[
                            action_type
                          ],
                        )}
                      </p>

                      <p
                        style="
                          margin:0;
                        "
                      >
                        <strong>
                          Détails :
                        </strong>

                        ${escapeHtml(
                          summary.trim(),
                        )}
                      </p>

                    </div>

                    <p
                      style="
                        margin:22px 0 0;
                        color:#64748b;
                        font-size:13px;
                        line-height:1.5;
                      "
                    >
                      Ouvrez EventHub →
                      Notifications pour
                      consulter et confirmer
                      cette notification.
                    </p>

                  </div>

                  <div
                    style="
                      border-top:1px solid #e2e8f0;
                      padding:16px 28px;
                      color:#94a3b8;
                      font-size:12px;
                    "
                  >
                    Notification automatique
                    • EventHub
                  </div>

                </div>

              </div>
            `,
          )

        emailSent =
          true

        console.log(
          '✅ Resend email sent:',
          emailId,
        )
      } catch (
        emailErr
      ) {
        emailError =
          emailErr instanceof Error
            ? emailErr.message
            : 'Unknown email error'

        console.error(
          '❌ Resend email failed:',
          emailError,
        )
      }
    }

    /*
     * --------------------------------------------------
     * Final response
     * --------------------------------------------------
     */

    return json({
      success: true,

      notification,

      email: {
        sent: emailSent,
        id: emailId,
        error: emailError,
      },
    })
  } catch (err) {
    console.error(
      '❌ notify-admin unexpected error:',
      err,
    )

    return json(
      {
        error:
          err instanceof Error
            ? err.message
            : 'Unexpected error.',
      },
      500,
    )
  }
})