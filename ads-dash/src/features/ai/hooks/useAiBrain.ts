import { useState, useEffect, useCallback } from 'react'
import { aiBrainRepo } from '../api/aiBrainRepo'
import { DEFAULT_BRAIN } from '../lib/constants'
import { getDataSource } from '@/shared/lib/api/createRepo'
import type { AiBrain } from '../api/types'

export interface UseAiBrainReturn {
  brain: AiBrain
  loading: boolean
  usingLocal: boolean
  save: (next: AiBrain) => Promise<{ error: Error | null }>
  refresh: () => Promise<void>
}

export function useAiBrain(): UseAiBrainReturn {
  const [brain, setBrain] = useState<AiBrain>(DEFAULT_BRAIN)
  const [loading, setLoading] = useState(true)
  const usingLocal = getDataSource() === 'mock'

  const fetchBrain = useCallback(async () => {
    setLoading(true)
    try {
      const loaded = await aiBrainRepo.get()
      setBrain(loaded ?? DEFAULT_BRAIN)
    } catch {
      setBrain(DEFAULT_BRAIN)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchBrain() }, [fetchBrain])

  async function save(next: AiBrain) {
    setBrain(next)
    return aiBrainRepo.save(next)
  }

  return { brain, loading, usingLocal, save, refresh: fetchBrain }
}
