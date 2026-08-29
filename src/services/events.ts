import { supabase } from '@/lib/supabase'
import type { EventWithClub } from '@/types/database'

export interface EventInput {
  event_name: string
  event_date: string
  event_location: string
  event_timing: string
  event_description?: string | null
  club_id: string
}

export async function listEvents(): Promise<EventWithClub[]> {
  const { data, error } = await supabase
    .from('events')
    .select('*, club:clubs(*)')
    .order('event_date', { ascending: true })
  if (error) throw error
  return data as EventWithClub[]
}

export async function createEvent(input: EventInput, createdByProfileId: string | null) {
  const { data, error } = await supabase
    .from('events')
    .insert({ ...input, created_by: createdByProfileId })
    .select('*, club:clubs(*)')
    .single()
  if (error) throw error
  return data as EventWithClub
}

export async function updateEvent(id: string, input: Partial<EventInput>) {
  const { data, error } = await supabase
    .from('events')
    .update(input)
    .eq('id', id)
    .select('*, club:clubs(*)')
    .single()
  if (error) throw error
  return data as EventWithClub
}

export async function deleteEvent(id: string) {
  const { error } = await supabase.from('events').delete().eq('id', id)
  if (error) throw error
}
