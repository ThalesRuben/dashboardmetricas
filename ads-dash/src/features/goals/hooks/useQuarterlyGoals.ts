import { useState, useEffect, useCallback } from 'react'
import { goalsRepo } from '../api/goalsRepo'
import { MOCK_GOALS } from '../api/goalsRepo.mock'
import { getDataSource } from '@/shared/lib/api/createRepo'
import type { Quarter, QuarterKey, MetaPatch } from '../api/types'

export interface UseQuarterlyGoalsReturn {
  quarters: Quarter[]
  loading: boolean
  usingLocal: boolean
  updateMeta: (q: QuarterKey, key: string, patch: MetaPatch) => void
  refresh: () => Promise<void>
}

export function useQuarterlyGoals(): UseQuarterlyGoalsReturn {
  const [quarters, setQuarters] = useState<Quarter[]>([])
  const [loading, setLoading] = useState(true)
  const usingLocal = getDataSource() === 'mock'

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const list = await goalsRepo.list()
      setQuarters(list.length ? list : MOCK_GOALS)
    } catch {
      setQuarters(MOCK_GOALS)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  function updateMeta(q: QuarterKey, key: string, patch: MetaPatch) {
    const next = quarters.map(quarter =>
      quarter.q !== q ? quarter : {
        ...quarter,
        metas: quarter.metas.map(m => m.key === key ? { ...m, ...patch } : m),
      }
    )
    setQuarters(next)
    goalsRepo.saveLocal(next)
  }

  return { quarters, loading, usingLocal, updateMeta, refresh: fetchAll }
}
