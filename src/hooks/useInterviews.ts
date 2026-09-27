import { useCallback, useEffect, useState } from 'react'
import { listInterviews } from '@/services/interviews'
import type { InterviewWithClub } from '@/types/database'

export function useInterviews() {
  const [interviews, setInterviews] = useState<InterviewWithClub[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setInterviews(await listInterviews())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load interviews')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  return { interviews, loading, error, reload }
}
