import { useCallback, useEffect, useState } from 'react'
import { listMeetings } from '@/services/meetings'
import type { Meeting } from '@/types/database'

export function useMeetings() {
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setMeetings(await listMeetings())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load meetings')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  return { meetings, loading, error, reload }
}
