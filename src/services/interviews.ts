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
  coordinator_emails: string
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

export async function createInterview(input:any) {
  // 1. Create the interview
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
      coordinator_emails: input.coordinator_emails,
      status: 'pending',
    })
    .select('*, club:clubs(*)')
    .single()

  if (error) {
    console.error('Interview INSERT failed:', error)
    throw error
  }

  console.log('Interview created:', data)

  // 2. Notify the coordinator
  const { data: notificationData, error: notificationError } =
    await supabase.functions.invoke('notify-interviewer', {
      body: {
        interview_id: data.id,
      },
    })

  if (notificationError) {
    console.error(
      'notify-interviewer failed:',
      notificationError
    )

    // IMPORTANT:
    // The interview was already created successfully.
    // Don't delete it just because email failed.
    console.warn(
      'Interview created, but coordinator notification failed.'
    )
  } else {
    console.log(
      'Coordinator notification sent:',
      notificationData
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
