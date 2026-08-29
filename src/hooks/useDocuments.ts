import { useCallback, useEffect, useState } from 'react'
import { listDocuments } from '@/services/documents'
import type { DocumentResource } from '@/types/database'

export function useDocuments() {
  const [documents, setDocuments] = useState<DocumentResource[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setDocuments(await listDocuments())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load documents')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  return { documents, loading, error, reload }
}
