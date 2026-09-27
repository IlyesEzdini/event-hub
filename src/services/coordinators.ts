import { supabase } from '@/lib/supabase'
import type { Coordinator, CoordinatorField } from '@/types/database'

/** Coordinators are created manually in the separate coordinators table. */
export async function listCoordinators(): Promise<Coordinator[]> {
  const { data, error } = await supabase
    .from('coordinators')
    .select('email, username, field')
    .order('username', { ascending: true })
  if (error) throw error
  return data as Coordinator[]
}

export async function getCoordinatorByEmail(email: string): Promise<Coordinator | null> {
  const { data, error } = await supabase
    .from('coordinators')
    .select('email, username, field')
    .ilike('email', email)
    .maybeSingle()
  if (error) throw error
  return data as Coordinator | null
}

export async function listCoordinatorsByField(field: CoordinatorField): Promise<Coordinator[]> {
  const { data, error } = await supabase
    .from('coordinators')
    .select('email, username, field')
    .eq('field', field)
    .order('username', { ascending: true })
  if (error) throw error
  return data as Coordinator[]
}

export function filterCoordinatorsByField(
  coordinators: Coordinator[],
  field: CoordinatorField,
): Coordinator[] {
  return coordinators.filter((c) => c.field === field)
}
