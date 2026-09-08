import { useCallback, useEffect, useState } from 'react'
import { countPendingNotifications } from '@/services/notifications'

/** Polls the count of unconfirmed notifications — used for the sidebar badge. */
export function usePendingNotificationsCount(enabled: boolean, pollMs = 30000) {
  const [count, setCount] = useState(0)

  const reload = useCallback(() => {
    if (!enabled) return
    countPendingNotifications()
      .then(setCount)
      .catch(() => {})
  }, [enabled])

  useEffect(() => {
    if (!enabled) return
    reload()
    const interval = setInterval(reload, pollMs)
    return () => clearInterval(interval)
  }, [enabled, pollMs, reload])

  return { count, reload }
}