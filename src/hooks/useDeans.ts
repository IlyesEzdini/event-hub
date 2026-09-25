import { useCallback, useEffect, useState } from 'react'
import { listDeans } from '@/services/deans'
import type { Dean } from '@/types/database'

export function useDeans() {
  const [deans, setDeans] = useState<Dean[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setDeans(await listDeans())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load deans')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  return { deans, loading, error, reload }
}