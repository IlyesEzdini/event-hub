import { supabase } from '@/lib/supabase'
import type { Profile } from '@/types/database'

/**
 * Deans are authenticated users stored in public.profiles
 * with role = 'dean'.
 *
 * IMPORTANT:
 * interviews.dean_id references profiles.id,
 * so this function must return Profile records,
 * not records from the legacy public.deans table.
 */
export async function listDeans(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('role', 'dean')
    .order('manager_name', {
      ascending: true,
    })

  if (error) {
    throw error
  }

  return (data ?? []) as Profile[]
}