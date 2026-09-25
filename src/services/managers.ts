import { supabase } from '@/lib/supabase'
import type { ProfileWithRelations } from '@/types/database'

/** Only real managers — excludes the admin and assistant directory rows. */
export async function listManagers(): Promise<ProfileWithRelations[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*, club:clubs(*), dean:deans(*)')
    .eq('role', 'manager')
    .order('created_at', { ascending: true })
  if (error) throw error
  return data as ProfileWithRelations[]
}

async function callManageManager(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('manage-manager', { body })
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
  return data
}

export async function createManager(input: {
  manager_name: string
  username: string
  password: string
  club_id: string
  phone_number?: string
  email?: string
  dean_id?: string
}): Promise<ProfileWithRelations> {
  const data = await callManageManager({ action: 'create', ...input })
  return data.profile as ProfileWithRelations
}

export async function replaceOrUpdateManager(input: {
  profile_id: string
  manager_name?: string
  username?: string
  club_id?: string
  phone_number?: string
  email?: string
  dean_id?: string
}): Promise<ProfileWithRelations> {
  const data = await callManageManager({ action: 'replace', ...input })
  return data.profile as ProfileWithRelations
}

export async function updateManagerCredentials(profile_id: string, new_password: string): Promise<void> {
  await callManageManager({ action: 'updateCredentials', profile_id, new_password })
}

export async function setManagerActive(profile_id: string, is_active: boolean): Promise<ProfileWithRelations> {
  const data = await callManageManager({ action: 'setActive', profile_id, is_active })
  return data.profile as ProfileWithRelations
}