
import { supabase } from '@/lib/supabase'
import type { ProfileWithClub } from '@/types/database'

/** Every assistant, across all managers — used to group them under their manager in the UI. */
export async function listAssistants(): Promise<ProfileWithClub[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*, club:clubs(*)')
    .eq('role', 'assistant')
    .order('created_at', { ascending: true })
  if (error) throw error
  return data as ProfileWithClub[]
}

export interface CreateAssistantInput {
  assistant_name: string
  manager_profile_id: string
  phone_number?: string
  email?: string
}

/**
 * Assistants have no Supabase Auth account at all — this is a plain table
 * insert (no Edge Function / service-role key needed, unlike real manager
 * accounts). The club is always inherited from the chosen manager, never
 * entered manually.
 */
export async function createAssistant(input: CreateAssistantInput): Promise<ProfileWithClub> {
  const { data: manager, error: managerError } = await supabase
    .from('profiles')
    .select('club_id')
    .eq('id', input.manager_profile_id)
    .single()
  if (managerError || !manager) throw new Error('Impossible de retrouver ce manager.')

  const { data, error } = await supabase
    .from('profiles')
    .insert({
      manager_name: input.assistant_name,
      phone_number: input.phone_number || null,
      email: input.email || null,
      role: 'assistant',
      club_id: manager.club_id,
      assists_manager_id: input.manager_profile_id,
      is_active: true,
    })
    .select('*, club:clubs(*)')
    .single()
  if (error) throw error
  return data as ProfileWithClub
}

export async function deleteAssistant(id: string): Promise<void> {
  const { error } = await supabase.from('profiles').delete().eq('id', id)
  if (error) throw error
}