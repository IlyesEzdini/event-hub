import { supabase } from '@/lib/supabase'
import type { Dean } from '@/types/database'

/** Deans are created manually in SQL — the app only ever reads this list. */
export async function listDeans(): Promise<Dean[]> {
  const { data, error } = await supabase.from('deans').select('*').order('name', { ascending: true })
  if (error) throw error
  return data as Dean[]
}