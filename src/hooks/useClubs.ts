import { useCallback, useEffect, useState } from 'react'
import { listClubs } from '@/services/clubs'
import type { Club } from '@/types/database'

export function useClubs() {
  const [clubs, setClubs] = useState<Club[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setClubs(await listClubs())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load clubs')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  return { clubs, loading, error, reload }
}
