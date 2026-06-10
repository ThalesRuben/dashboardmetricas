import { useState, useEffect, useCallback } from 'react'
import { tiktokRepo } from '../api/tiktokRepo'
import { MOCK_TIKTOK } from '../api/tiktokRepo.mock'

export function useTikTokMetrics() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [usingMock, setUsingMock] = useState(false)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const summary = await tiktokRepo.getSummary()
      if (summary) {
        setData(summary); setUsingMock(false)
      } else {
        setData(MOCK_TIKTOK); setUsingMock(true)
      }
    } catch {
      setData(MOCK_TIKTOK); setUsingMock(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  return { data, loading, usingMock, refresh: fetchAll }
}
