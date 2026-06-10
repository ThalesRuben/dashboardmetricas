import { useState, useEffect, useCallback } from 'react'
import { whatsappRepo } from '../api/whatsappRepo'
import { MOCK_WHATSAPP } from '../api/whatsappRepo.mock'
import type { WhatsAppSummary } from '../api/types'

export interface UseWhatsAppMetricsReturn {
  data: WhatsAppSummary | null
  loading: boolean
  usingMock: boolean
  refresh: () => Promise<void>
}

export function useWhatsAppMetrics(): UseWhatsAppMetricsReturn {
  const [data, setData] = useState<WhatsAppSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [usingMock, setUsingMock] = useState(false)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const summary = await whatsappRepo.getSummary()
      if (summary) {
        setData(summary); setUsingMock(false)
      } else {
        setData(MOCK_WHATSAPP); setUsingMock(true)
      }
    } catch {
      setData(MOCK_WHATSAPP); setUsingMock(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  return { data, loading, usingMock, refresh: fetchAll }
}
