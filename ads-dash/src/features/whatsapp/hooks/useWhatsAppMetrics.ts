import { useState, useEffect, useCallback, useRef } from 'react'
import { whatsappRepo } from '../api/whatsappRepo'
import { getDataSource } from '@/shared/lib/api/createRepo'
import type { WhatsAppSummary } from '../api/types'

export interface DateRange {
  from: Date
  to: Date
}

export interface UseWhatsAppMetricsReturn {
  data: WhatsAppSummary | null
  loading: boolean
  usingMock: boolean
  erro: string | null
  refresh: () => Promise<void>
}

export function useWhatsAppMetrics(
  inboxPhone?: string | null,
  range?: DateRange | null,
): UseWhatsAppMetricsReturn {
  const [data, setData] = useState<WhatsAppSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const usingMock = getDataSource() === 'mock'
  const requestId = useRef(0)
  const hasSnapshot = useRef(false)

  // Chaves primitivas pro deps do useCallback — instância nova do objeto
  // Date em cada render dispararia refetch em loop.
  const fromKey = range?.from?.toISOString() ?? null
  const toKey   = range?.to?.toISOString()   ?? null

  const fetchAll = useCallback(async (background = false) => {
    const currentRequest = ++requestId.current
    if (!background) hasSnapshot.current = false
    const quiet = background && hasSnapshot.current
    if (!quiet) setLoading(true)
    setErro(null)
    try {
      const summary = await whatsappRepo.getSummary(
        inboxPhone ?? null,
        fromKey && toKey ? { from: new Date(fromKey), to: new Date(toKey) } : null,
      )
      if (currentRequest !== requestId.current) return
      if (!summary) throw new Error('Não foi possível carregar as métricas de mensagens.')
      hasSnapshot.current = true
      setData(summary)
    } catch (error) {
      if (currentRequest !== requestId.current) return
      if (!quiet) {
        hasSnapshot.current = false
        setData(null)
      }
      setErro(error instanceof Error ? error.message : 'Falha ao carregar as métricas.')
    } finally {
      if (currentRequest === requestId.current) setLoading(false)
    }
  }, [inboxPhone, fromKey, toKey])

  useEffect(() => {
    void fetchAll()
    const onVisible = () => { if (document.visibilityState === 'visible') void fetchAll(true) }
    const timer = usingMock ? null : window.setInterval(onVisible, 60_000)
    if (!usingMock) document.addEventListener('visibilitychange', onVisible)
    return () => {
      requestId.current++
      if (timer !== null) window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [fetchAll, usingMock])

  const refresh = useCallback(() => fetchAll(true), [fetchAll])
  return { data, loading, usingMock, erro, refresh }
}
