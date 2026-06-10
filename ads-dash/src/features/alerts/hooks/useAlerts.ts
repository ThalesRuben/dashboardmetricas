import { useState, useEffect, useCallback } from 'react'
import { alertsRepo } from '../api/alertsRepo'
import { MOCK_ALERTS } from '../api/alertsRepo.mock'
import type { Alert } from '../api/types'

export interface UseAlertsReturn {
  alerts: Alert[]
  loading: boolean
  refresh: () => Promise<void>
}

export function useAlerts(): UseAlertsReturn {
  const [alerts, setAlerts] = useState<Alert[]>(MOCK_ALERTS)
  const [loading, setLoading] = useState(true)

  const fetchAlerts = useCallback(async () => {
    setLoading(true)
    try {
      const list = await alertsRepo.list(20)
      setAlerts(list.length ? list : MOCK_ALERTS)
    } catch {
      setAlerts(MOCK_ALERTS)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAlerts() }, [fetchAlerts])

  return { alerts, loading, refresh: fetchAlerts }
}
