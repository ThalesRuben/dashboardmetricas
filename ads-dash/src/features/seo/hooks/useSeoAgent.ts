import { useState, useEffect, useCallback } from 'react'
import { seoRepo } from '../api/seoRepo'
import { MOCK_SEO } from '../api/seoRepo.mock'
import type { SeoSnapshot } from '../api/types'

export interface UseSeoAgentReturn {
  data: SeoSnapshot | null
  loading: boolean
  usingMock: boolean
  refresh: () => Promise<void>
}

export function useSeoAgent(): UseSeoAgentReturn {
  const [data, setData] = useState<SeoSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [usingMock, setUsingMock] = useState(false)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const snap = await seoRepo.getSnapshot()
      if (snap) {
        setData(snap); setUsingMock(false)
      } else {
        setData(MOCK_SEO); setUsingMock(true)
      }
    } catch {
      setData(MOCK_SEO); setUsingMock(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  return { data, loading, usingMock, refresh: fetchAll }
}
