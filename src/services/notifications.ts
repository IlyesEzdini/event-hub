
import { supabase } from '@/lib/supabase'

export type NotificationActionType = 'event' | 'report' | 'event_request'

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

function unwrapFunctionError(error: unknown, fallback: string): never {
  const context = (error as { context?: { json?: () => Promise<{ error?: string }> } })?.context
  throw new Error(fallback)
  void context // handled synchronously below in callers where needed
}

/**
 * Tells the coordinator a manager just did something. Deliberately never
 * throws — a failed/slow notification must never block or roll back the
 * manager's underlying action (event created, report submitted, etc.).
 */
export async function notifyAdmin(
  actionType: NotificationActionType,
  summary: string,
  relatedId?: string,
): Promise<void> {
  try {
    await supabase.functions.invoke('notify-admin', {
      body: { action_type: actionType, summary, related_id: relatedId },
    })
  } catch (err) {
    console.error('notifyAdmin failed (non-blocking):', err)
  }
}

export async function listNotifications(): Promise<AdminNotification[]> {
  const { data, error } = await supabase
    .from('admin_notifications')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data as AdminNotification[]
}

export async function countPendingNotifications(): Promise<number> {
  const { count, error } = await supabase
    .from('admin_notifications')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending')
  if (error) throw error
  return count ?? 0
}

export async function confirmNotification(id: string): Promise<AdminNotification> {
  const { data, error } = await supabase.functions.invoke('confirm-notification', {
    body: { notification_id: id },
  })
  if (error) {
    const context = (error as { context?: { json?: () => Promise<{ error?: string }> } }).context
    if (context?.json) {
      try {
        const payload = await context.json()
        throw new Error(payload.error ?? error.message)
      } catch {
        throw new Error(error.message)
      }
    }
    throw new Error(error.message)
  }
  if (data?.error) throw new Error(data.error)
  return data.notification as AdminNotification
}