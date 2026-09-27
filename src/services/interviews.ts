import { supabase } from '@/lib/supabase'
import type {
  Interview,
  InterviewDepartment,
  InterviewPoste,
  InterviewWithClub,
} from '@/types/database'

export interface InterviewInput {
  dean_id: string
  club_id: string
  interview_date: string
  interview_time: string
  place: string
  poste: InterviewPoste
  department: InterviewDepartment
  coordinator_emails: string[]
}

export async function listInterviews(): Promise<InterviewWithClub[]> {
  const { data, error } = await supabase
    .from('interviews')
    .select('*, club:clubs(*)')
    .order('interview_date', { ascending: true })
    .order('interview_time', { ascending: true })

  if (error) throw error
  return data as InterviewWithClub[]
}

export async function createInterview(input: {
  dean_id: string
  club_id: string
  interview_date: string
  interview_time: string
  place: string
  poste: string
  department: string
  coordinator_emails: string[]
}) {
  const { data, error } = await supabase
    .from('interviews')
    .insert({
      dean_id: input.dean_id,
      club_id: input.club_id,
      interview_date: input.interview_date,
      interview_time: input.interview_time,
      place: input.place,
      poste: input.poste,
      department: input.department,
      coordinator_emails: [input.coordinator_emails],
      status: 'pending',
    })
    .select('*, club:clubs(*)')
    .single()

  if (error) {
    console.error('Interview INSERT error:', error)
    throw error
  }

  // Notify coordinator AFTER successful insert
  const { error: notificationError } =
    await supabase.functions.invoke('notify-interviewer', {
      body: {
        interview_id: data.id,
      },
    })

  if (notificationError) {
    console.error(
      'Coordinator notification failed:',
      notificationError
    )
  }

  return data
}

export async function updateInterview(
  id: string,
  input: Partial<InterviewInput> & { status?: 'pending' | 'done' },
): Promise<InterviewWithClub> {
  const { data, error } = await supabase
    .from('interviews')
    .update(input)
    .eq('id', id)
    .select('*, club:clubs(*)')
    .single()

  if (error) throw error
  return data as InterviewWithClub
}

export async function markInterviewDone(id: string): Promise<InterviewWithClub> {
  return updateInterview(id, { status: 'done' })
}
