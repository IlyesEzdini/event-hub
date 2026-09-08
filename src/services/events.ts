import { supabase } from '@/lib/supabase'
import type { EventWithClub } from '@/types/database'
import { notifyAdmin } from '@/services/notifications'

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
    .order('event_date', {
      ascending: true,
    })

  if (error) {
    throw error
  }

  return data as EventWithClub[]
}

export async function createEvent(
  input: EventInput,
  createdByProfileId: string | null,
) {
  /*
   * 1. Create the event first.
   *
   * We NEVER notify before the database operation succeeds.
   */
  const { data, error } = await supabase
    .from('events')
    .insert({
      ...input,
      created_by: createdByProfileId,
    })
    .select('*, club:clubs(*)')
    .single()

  if (error) {
    throw error
  }

  const created = data as EventWithClub

  /*
   * 2. Event was successfully created.
   *
   * Now call the notification Edge Function.
   *
   * `void` makes this fire-and-forget so a notification failure
   * cannot make an already-successful event creation fail.
   */
  void notifyAdmin(
    'event',
    `Événement « ${created.event_name} » — ${created.event_date} à ${created.event_timing}, ${created.event_location}.`,
    created.id,
  )

  return created
}

export async function updateEvent(
  id: string,
  input: Partial<EventInput>,
) {
  const { data, error } = await supabase
    .from('events')
    .update(input)
    .eq('id', id)
    .select('*, club:clubs(*)')
    .single()

  if (error) {
    throw error
  }

  return data as EventWithClub
}

export async function deleteEvent(
  id: string,
): Promise<void> {
  const { error } = await supabase
    .from('events')
    .delete()
    .eq('id', id)

  if (error) {
    throw error
  }
}