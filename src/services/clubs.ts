import { supabase } from '@/lib/supabase'
import type { Club } from '@/types/database'

export async function listClubs(): Promise<Club[]> {
  const { data, error } = await supabase.from('clubs').select('*').order('name', { ascending: true })
  if (error) throw error
  return data as Club[]
}

export async function createClub(name: string): Promise<Club> {
  const { data, error } = await supabase.from('clubs').insert({ name }).select().single()
  if (error) throw error
  return data as Club
}

export async function findOrCreateClub(name: string): Promise<Club> {
  const trimmed = name.trim()
  const { data: existing } = await supabase.from('clubs').select('*').eq('name', trimmed).maybeSingle()
  if (existing) return existing as Club
  return createClub(trimmed)
}
