import { useCallback, useEffect, useState } from 'react'
import { listCoordinators } from '@/services/coordinators'
import type { Coordinator } from '@/types/database'

export function useCoordinators() {
  const [coordinators, setCoordinators] = useState<Coordinator[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setCoordinators(await listCoordinators())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load coordinators')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  return { coordinators, loading, error, reload }
}
