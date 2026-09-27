import { supabase } from '@/lib/supabase'
import type {
  Interview,
  InterviewDepartment,
  InterviewPoste,
  InterviewWithClub,
} from '@/types/database'

export interface InterviewInput {
  dean_profile_id: string
  club_id: string
  interview_date: string
  interview_time: string
  place: string
  poste: InterviewPoste
  department: InterviewDepartment
  coordinator_email: string
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

export async function createInterview(input: InterviewInput): Promise<InterviewWithClub> {
  const { data, error } = await supabase
    .from('interviews')
    .insert(input)
    .select('*, club:clubs(*)')
    .single()

  if (error) throw error

  const interview = data as InterviewWithClub

  // The interview is already persisted. Email delivery is intentionally
  // non-blocking so SMTP failure cannot roll back the interview.
  void supabase.functions
    .invoke('notify-interviewer', {
      body: { interview_id: interview.id },
    })
    .then(({ error: notifyError }) => {
      if (notifyError) console.error('notify-interviewer failed:', notifyError)
    })

  return interview
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
