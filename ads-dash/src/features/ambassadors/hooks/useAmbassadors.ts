import { useState, useEffect, useCallback } from 'react'
import { ambassadorsRepo } from '../api/ambassadorsRepo'
import { getDataSource } from '@/shared/lib/api/createRepo'
import type { Ambassador, AmbassadorPayload } from '../api/types'

export interface UseAmbassadorsReturn {
  ambassadors: Ambassador[]
  loading: boolean
  usingLocal: boolean
  addAmbassador: (payload: AmbassadorPayload) => Promise<{ error: Error | null }>
  removeAmbassador: (id: string) => Promise<{ error: Error | null }>
  refresh: () => Promise<void>
}

export function useAmbassadors(): UseAmbassadorsReturn {
  const [ambassadors, setAmbassadors] = useState<Ambassador[]>([])
  const [loading, setLoading] = useState(true)
  const usingLocal = getDataSource() === 'mock'

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      setAmbassadors(await ambassadorsRepo.list())
    } catch {
      setAmbassadors([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  async function addAmbassador(payload: AmbassadorPayload) {
    const { data, error } = await ambassadorsRepo.add(payload)
    if (!error && data) setAmbassadors(a => [...a, data])
    return { error }
  }

  async function removeAmbassador(id: string) {
    const { error } = await ambassadorsRepo.remove(id)
    if (!error) setAmbassadors(a => a.filter(x => x.id !== id))
    return { error }
  }

  return { ambassadors, loading, usingLocal, addAmbassador, removeAmbassador, refresh: fetchAll }
}
