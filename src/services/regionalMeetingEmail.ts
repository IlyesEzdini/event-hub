import { supabase } from '@/lib/supabase'
import type { MeetingInput } from '@/types/database'

export interface RegionalMeetingEmailPreview {
  subject: string
  sender_name: string
  sender_role: string
  recipients: Array<{ name: string; email: string; type: 'Dean' | 'Coordinator' }>
  html: string
  text: string
}

export async function previewRegionalMeetingEmail(input: MeetingInput): Promise<RegionalMeetingEmailPreview> {
  const { data, error } = await supabase.functions.invoke('regional-meeting-email', {
    body: { action: 'preview', meeting: input },
  })
  if (error) throw new Error(error.message)
  if (data?.error) throw new Error(data.error)
  return data as RegionalMeetingEmailPreview
}

export async function sendRegionalMeetingEmail(meetingId: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke('regional-meeting-email', {
    body: { action: 'send', meeting_id: meetingId },
  })
  if (error) throw new Error(error.message)
  if (data?.error) throw new Error(data.error)
}
