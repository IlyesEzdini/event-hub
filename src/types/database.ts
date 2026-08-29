// Domain types mirroring the Supabase schema (see supabase/schema.sql)

export type Role = 'admin' | 'manager'

export interface Club {
  id: string
  name: string
  created_at: string
}

export interface Profile {
  id: string
  auth_user_id: string
  manager_name: string
  username: string
  club_id: string | null
  role: Role
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface ProfileWithClub extends Profile {
  club: Club | null
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
