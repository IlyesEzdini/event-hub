import { supabase } from '@/lib/supabase'
import type { Club } from '@/types/database'

export interface EventRequest {
  id: string
  club_id: string
  created_by: string | null
  submitted_by_name: string
  objectifs: string | null
  date_horaire: string | null
  lieu: string | null
  plan_evenement: string | null
  cibles: string | null
  nombre_participants: number | null
  nombre_organisateurs: number | null
  liste_invites: string | null
  interventions: string | null
  besoins_logistiques: string | null
  remarques: string | null
  submitted_at: string
}

export interface EventRequestWithClub extends EventRequest {
  club: Club | null
}

export interface EventRequestInput {
  club_id: string
  objectifs: string
  date_horaire: string
  lieu: string
  plan_evenement: string
  cibles: string
  nombre_participants: number
  nombre_organisateurs: number
  liste_invites: string
  interventions: string
  besoins_logistiques: string
  remarques: string
}

export async function createEventRequest(
  input: EventRequestInput,
  submittedByProfileId: string | null,
  submittedByName: string,
): Promise<EventRequest> {
  const { data, error } = await supabase
    .from('event_requests')
    .insert({ ...input, created_by: submittedByProfileId, submitted_by_name: submittedByName })
    .select()
    .single()
  if (error) throw error
  return data as EventRequest
}

/** All requests ever submitted for one club, most recent first. */
export async function listEventRequestsForClub(clubId: string): Promise<EventRequestWithClub[]> {
  const { data, error } = await supabase
    .from('event_requests')
    .select('*, club:clubs(*)')
    .eq('club_id', clubId)
    .order('submitted_at', { ascending: false })
  if (error) throw error
  return data as EventRequestWithClub[]
}

/** Every request across every club — used by the admin overview. */
export async function listAllEventRequests(): Promise<EventRequestWithClub[]> {
  const { data, error } = await supabase
    .from('event_requests')
    .select('*, club:clubs(*)')
    .order('submitted_at', { ascending: false })
  if (error) throw error
  return data as EventRequestWithClub[]
}

export async function deleteEventRequest(id: string): Promise<void> {
  const { error } = await supabase.from('event_requests').delete().eq('id', id)
  if (error) throw error
}