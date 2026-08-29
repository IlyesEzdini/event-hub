import { supabase } from '@/lib/supabase'
import type { Report, ReportWithClub } from '@/types/database'

export interface ReportInput {
  club_id: string
  month: number
  year: number
  members: number
  active_members: number
  events: number
  meetings: number
  evaluation?: string | null
  remarks?: string | null
  status: 'draft' | 'submitted'
}

export async function getReportForClubMonth(clubId: string, month: number, year: number): Promise<Report | null> {
  const { data, error } = await supabase
    .from('reports')
    .select('*')
    .eq('club_id', clubId)
    .eq('month', month)
    .eq('year', year)
    .maybeSingle()
  if (error) throw error
  return data as Report | null
}

export async function upsertReport(input: ReportInput, createdByProfileId: string | null) {
  const existing = await getReportForClubMonth(input.club_id, input.month, input.year)
  const payload = {
    ...input,
    submitted_at: input.status === 'submitted' ? new Date().toISOString() : null,
    created_by: createdByProfileId,
  }
  if (existing) {
    const { data, error } = await supabase.from('reports').update(payload).eq('id', existing.id).select().single()
    if (error) throw error
    return data as Report
  }
  const { data, error } = await supabase.from('reports').insert(payload).select().single()
  if (error) throw error
  return data as Report
}

export async function listAllReports(): Promise<ReportWithClub[]> {
  const { data, error } = await supabase
    .from('reports')
    .select('*, club:clubs(*)')
    .order('year', { ascending: false })
    .order('month', { ascending: false })
  if (error) throw error
  return data as ReportWithClub[]
}
