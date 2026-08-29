import { supabase } from '@/lib/supabase'
import type { DocumentResource } from '@/types/database'

const BUCKET = 'documents'

function sanitizeFileName(name: string): string {
  const lastDot = name.lastIndexOf('.')
  const base = lastDot > 0 ? name.slice(0, lastDot) : name
  const ext = lastDot > 0 ? name.slice(lastDot) : ''
  const cleanBase = base
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
  const cleanExt = ext.replace(/[^a-zA-Z0-9.]/g, '')
  return `${cleanBase || 'file'}${cleanExt}`
}

export async function listDocuments(): Promise<DocumentResource[]> {
  const { data, error } = await supabase.from('documents').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return data as DocumentResource[]
}

export async function uploadDocument(
  file: File,
  title: string,
  description: string,
  uploadedByProfileId: string | null,
): Promise<DocumentResource> {
  const path = `${crypto.randomUUID()}-${sanitizeFileName(file.name)}`
  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file)
  if (uploadError) throw uploadError

  const { data, error } = await supabase
    .from('documents')
    .insert({ title, description, file_path: path, uploaded_by: uploadedByProfileId })
    .select()
    .single()
  if (error) throw error
  return data as DocumentResource
}

export async function getDocumentUrl(filePath: string): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(filePath, 60 * 10)
  if (error) throw error
  return data.signedUrl
}

export async function deleteDocument(doc: DocumentResource): Promise<void> {
  await supabase.storage.from(BUCKET).remove([doc.file_path])
  const { error } = await supabase.from('documents').delete().eq('id', doc.id)
  if (error) throw error
}