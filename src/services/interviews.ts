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

export async function createInterview(input: any) {
  console.log('========== createInterview() ==========')
  console.log('Input received:', input)

  const payload = {
    dean_profile_id: input.dean_profile_id,
    club_id: input.club_id,
    interview_date: input.interview_date,
    interview_time: input.interview_time,
    place: input.place,
    poste: input.poste,
    department: input.department,
    coordinator_email: input.coordinator_email,
  }

  console.log('Supabase INSERT payload:', payload)

  const { data, error } = await supabase
    .from('interviews')
    .insert(payload)
    .select()
    .single()

  if (error) {
    console.error('❌ SUPABASE INSERT FAILED')
    console.error('Code:', error.code)
    console.error('Message:', error.message)
    console.error('Details:', error.details)
    console.error('Hint:', error.hint)
    console.error('Full error:', error)

    throw error
  }

  console.log('✅ SUPABASE INSERT SUCCESS')
  console.log('Inserted interview:', data)

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
