import { useState, useEffect, useCallback } from 'react'
import { whatsappRepo } from '../api/whatsappRepo'
import { MOCK_WHATSAPP } from '../api/whatsappRepo.mock'
import type { WhatsAppSummary } from '../api/types'

export interface DateRange {
  from: Date
  to: Date
}

export interface UseWhatsAppMetricsReturn {
  data: WhatsAppSummary | null
  loading: boolean
  usingMock: boolean
  refresh: () => Promise<void>
}

export function useWhatsAppMetrics(
  inboxPhone?: string | null,
  range?: DateRange | null,
): UseWhatsAppMetricsReturn {
  const [data, setData] = useState<WhatsAppSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [usingMock, setUsingMock] = useState(false)

  // Chaves primitivas pro deps do useCallback — instância nova do objeto
  // Date em cada render dispararia refetch em loop.
  const fromKey = range?.from?.toISOString() ?? null
  const toKey   = range?.to?.toISOString()   ?? null

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const summary = await whatsappRepo.getSummary(
        inboxPhone ?? null,
        fromKey && toKey ? { from: new Date(fromKey), to: new Date(toKey) } : null,
      )
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
  }, [inboxPhone, fromKey, toKey])

  useEffect(() => { fetchAll() }, [fetchAll])

  return { data, loading, usingMock, refresh: fetchAll }
}
