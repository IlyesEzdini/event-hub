import { useCallback, useEffect, useState } from 'react'
import { listEvents } from '@/services/events'
import type { EventWithClub } from '@/types/database'

export function useEvents() {
  const [events, setEvents] = useState<EventWithClub[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setEvents(await listEvents())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load events')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  return { events, loading, error, reload }
}
