import { useCallback, useEffect, useState } from 'react'
import { listAssistants } from '@/services/assistants'
import type { ProfileWithClub } from '@/types/database'

export function useAssistants() {
  const [assistants, setAssistants] = useState<ProfileWithClub[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setAssistants(await listAssistants())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load assistants')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  return { assistants, loading, error, reload }
}