import { useState, useEffect, useCallback } from 'react'
import { seoRepo } from '../api/seoRepo'
import { MOCK_SEO, mockSeoRepo } from '../api/seoRepo.mock'
import type { SeoSnapshot, SeoHistoryPoint } from '../api/types'

export interface UseSeoAgentReturn {
  data: SeoSnapshot | null
  history: SeoHistoryPoint[]
  loading: boolean
  usingMock: boolean
  refresh: () => Promise<void>
}

export function useSeoAgent(): UseSeoAgentReturn {
  const [data, setData] = useState<SeoSnapshot | null>(null)
  const [history, setHistory] = useState<SeoHistoryPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [usingMock, setUsingMock] = useState(false)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [snap, hist] = await Promise.all([
        seoRepo.getSnapshot(),
        seoRepo.getHistory(30).catch(() => []),
      ])
      if (snap) {
        setData(snap)
        setUsingMock(false)
        setHistory(hist.length > 1 ? hist : await mockSeoRepo.getHistory(30))
      } else {
        setData(MOCK_SEO)
        setUsingMock(true)
        setHistory(await mockSeoRepo.getHistory(30))
      }
    } catch {
      setData(MOCK_SEO)
      setUsingMock(true)
      setHistory(await mockSeoRepo.getHistory(30))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  return { data, history, loading, usingMock, refresh: fetchAll }
}
