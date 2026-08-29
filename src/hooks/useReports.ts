import { useCallback, useEffect, useState } from 'react'
import { getReportForClubMonth } from '@/services/reports'
import type { Report } from '@/types/database'
import { getCurrentMonthYear } from '@/utils/reportStatus'

/** The current month's report for a single club (used on manager dashboards). */
export function useCurrentReport(clubId: string | null | undefined) {
  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { month, year } = getCurrentMonthYear()

  const reload = useCallback(async () => {
    if (!clubId) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      setReport(await getReportForClubMonth(clubId, month, year))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load report')
    } finally {
      setLoading(false)
    }
  }, [clubId, month, year])

  useEffect(() => {
    reload()
  }, [reload])

  return { report, loading, error, reload, month, year }
}
