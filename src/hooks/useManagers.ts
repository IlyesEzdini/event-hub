import { useCallback, useEffect, useState } from 'react'
import { listManagers } from '@/services/managers'
import type { ProfileWithClub } from '@/types/database'

export function useManagers() {
  const [managers, setManagers] = useState<ProfileWithClub[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setManagers(await listManagers())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load managers')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  return { managers, loading, error, reload }
}
