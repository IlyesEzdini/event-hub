import { supabase } from '@/lib/supabase'

export type NotificationActionType =
  | 'event'
  | 'report'
  | 'event_request'

export interface AdminNotification {
  id: string
  action_type: NotificationActionType
  club_id: string | null
  club_name: string
  manager_profile_id: string | null
  manager_name: string
  manager_email: string | null
  summary: string
  related_id: string | null
  status: 'pending' | 'confirmed'
  created_at: string
  confirmed_at: string | null
}

/**
 * Notify the coordinator after a manager action succeeds.
 *
 * This is intentionally non-blocking.
 *
 * If the notification function or Resend fails, the original
 * manager action remains successful.
 */
export async function notifyAdmin(
  actionType: NotificationActionType,
  summary: string,
  relatedId?: string,
): Promise<void> {
  try {
    console.log('📨 Calling notify-admin Edge Function...', {
      actionType,
      relatedId,
    })

    const { data, error } = await supabase.functions.invoke(
      'notify-admin',
      {
        body: {
          action_type: actionType,
          summary,
          related_id: relatedId ?? null,
        },
      },
    )

    if (error) {
      console.error(
        '❌ notify-admin Edge Function failed:',
        error,
      )
      return
    }

    if (data?.error) {
      console.error(
        '❌ notify-admin returned an error:',
        data.error,
      )
      return
    }

    console.log(
      '✅ notify-admin Edge Function completed successfully:',
      {
        actionType,
        notificationId: data?.notification?.id,
        emailSent: data?.email?.sent,
        emailId: data?.email?.id,
      },
    )
  } catch (err) {
    console.error(
      '❌ notify-admin invocation failed:',
      err,
    )
  }
}

export async function listNotifications(): Promise<
  AdminNotification[]
> {
  const { data, error } = await supabase
    .from('admin_notifications')
    .select('*')
    .order('created_at', {
      ascending: false,
    })

  if (error) {
    throw error
  }

  return data as AdminNotification[]
}

export async function countPendingNotifications(): Promise<number> {
  const { count, error } = await supabase
    .from('admin_notifications')
    .select('*', {
      count: 'exact',
      head: true,
    })
    .eq('status', 'pending')

  if (error) {
    throw error
  }

  return count ?? 0
}

export async function confirmNotification(
  id: string,
): Promise<AdminNotification> {
  const { data, error } =
    await supabase.functions.invoke(
      'confirm-notification',
      {
        body: {
          notification_id: id,
        },
      },
    )

  if (error) {
    throw new Error(error.message)
  }

  if (data?.error) {
    throw new Error(data.error)
  }

  return data.notification as AdminNotification
}