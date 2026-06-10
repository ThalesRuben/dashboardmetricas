import { useState, useEffect, useCallback } from 'react'
import { youtubeRepo } from '../api/youtubeRepo'
import { MOCK_YOUTUBE } from '../api/youtubeRepo.mock'
import type { YouTubeSummary } from '../api/types'

export interface UseYouTubeMetricsReturn {
  data: YouTubeSummary | null
  loading: boolean
  usingMock: boolean
  refresh: () => Promise<void>
}

export function useYouTubeMetrics(): UseYouTubeMetricsReturn {
  const [data, setData] = useState<YouTubeSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [usingMock, setUsingMock] = useState(false)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const summary = await youtubeRepo.getSummary()
      if (summary) {
        setData(summary); setUsingMock(false)
      } else {
        setData(MOCK_YOUTUBE); setUsingMock(true)
      }
    } catch {
      setData(MOCK_YOUTUBE); setUsingMock(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  return { data, loading, usingMock, refresh: fetchAll }
}
