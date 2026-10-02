
export type Role = 'admin' | 'manager' | 'assistant' | 'dean' | 'coordinator'

export type CoordinatorField = 'event' | 'COM' | 'RH' | 'partenariat' | 'PAP' | 'treasury' | 'regional'

export interface Club {
  id: string
  name: string
  created_at: string
}
export interface Dean {
  id: string
  name: string
  email: string | null
  created_at: string
}

export interface Profile {
  id: string
  // null for assistants — they have no Supabase Auth account / no login.
  auth_user_id: string | null
  manager_name: string
  // null for assistants.
  username: string | null
  phone_number: string | null
  email: string | null
  club_id: string | null
  // for a manager: the referenced public.deans.id they report to.
  dean_id: string | null
  // set only for assistants: which manager's profile.id they belong to.
  assists_manager_id: string | null
  // for a dean: the club NAMES they oversee (matched against clubs.name).
  responsible_clubs: string[]
  // JSON array stored on dean profiles, e.g. ["FDS", "LETTRE"].
  clubs: string[]
  // for a coordinator profile in legacy data; new coordinators use the separate table.
  field: CoordinatorField | null
  role: Role
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface ProfileWithClub extends Profile {
  club: Club | null
  dean: Dean | null
}
export interface ProfileWithRelations extends Profile {
  club: Club | null
  dean: Dean | null
}

export interface EventItem {
  id: string
  club_id: string
  created_by: string | null
  event_name: string
  event_date: string // ISO date (YYYY-MM-DD)
  event_location: string
  event_timing: string // HH:MM
  event_description: string | null
  created_at: string
  updated_at: string
}

export interface EventWithClub extends EventItem {
  club: Club | null
}

export interface Report {
  id: string
  club_id: string
  month: number // 1-12
  year: number
  members: number
  active_members: number
  events: number
  meetings: number
  evaluation: string | null
  remarks: string | null
  status: 'draft' | 'submitted'
  submitted_at: string | null
  updated_at: string
  created_at: string
}

export interface ReportWithClub extends Report {
  club: Club | null
}

export interface DocumentResource {
  id: string
  title: string
  description: string | null
  file_path: string
  uploaded_by: string | null
  created_at: string
}

export type InterviewPoste = 'manager' | 'assistant' | 'president' | 'vice_president' | 'general_secretary'
export type InterviewDepartment = 'event' | 'COM' | 'RH' | 'partenariat' | 'PAP' | 'treasury' | 'executive_bureau'
export type InterviewStatus = 'pending' | 'done'

export interface Coordinator {
  email: string
  username: string
  field: CoordinatorField
}

export interface Interview {
  id: string
  dean_id: string | null
  dean_name: string | null
  club_id: string | null
  interview_date: string
  interview_time: string
  place: string
  poste: InterviewPoste
  department: InterviewDepartment
  coordinator_ids: string[]
  coordinator_emails: string[]
  coordinator_name: string | null
  status: InterviewStatus
  created_at: string
  updated_at: string
}

export interface InterviewWithClub extends Interview {
  club: Club | null
}

export type MeetingStatus = 'pending' | 'done'

export interface Meeting {
  id: string
  username: string
  created_by_profile_id: string | null
  created_by_coordinator_email: string | null
  club_ids: string[] | null
  meeting_date: string
  start_time: string
  end_time: string
  description: string
  is_online: boolean
  place: string | null
  meeting_link: string | null
  status: MeetingStatus
  created_at: string
  updated_at: string
}

export interface MeetingInput {
  club_ids: string[] | null
  meeting_date: string
  start_time: string
  end_time: string
  description: string
  is_online: boolean
  place: string | null
  meeting_link: string | null
}

export interface CurrentUser extends Omit<ProfileWithClub, 'id' | 'auth_user_id' | 'created_at' | 'updated_at'> {
  id: string | null
  auth_user_id: string
  created_at: string | null
  updated_at: string | null
}
