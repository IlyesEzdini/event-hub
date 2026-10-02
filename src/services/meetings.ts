import { supabase } from '@/lib/supabase'
import type { Meeting, MeetingInput } from '@/types/database'

export async function listMeetings(): Promise<Meeting[]> {
  const { data, error } = await supabase
    .from('meetings')
    .select('*')
    .order('meeting_date', { ascending: true })
    .order('start_time', { ascending: true })

  if (error) throw error
  return data as Meeting[]
}

export async function createMeeting(input: MeetingInput): Promise<Meeting> {
  const { data, error } = await supabase
    .from('meetings')
    .insert(input)
    .select('*')
    .single()

  if (error) throw error
  return data as Meeting
}

export async function updateMeeting(id: string, input: Partial<MeetingInput> & { status?: 'pending' | 'done' }): Promise<Meeting> {
  const { data, error } = await supabase
    .from('meetings')
    .update(input)
    .eq('id', id)
    .select('*')
    .single()

  if (error) throw error
  return data as Meeting
}

export async function markMeetingDone(id: string): Promise<Meeting> {
  return updateMeeting(id, { status: 'done' })
}

export async function deleteMeeting(id: string): Promise<void> {
  const { error } = await supabase
    .from('meetings')
    .delete()
    .eq('id', id)

  if (error) throw error
}
