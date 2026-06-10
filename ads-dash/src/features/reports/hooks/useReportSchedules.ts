import { useState, useEffect, useCallback } from 'react'
import { reportsRepo } from '../api/reportsRepo'
import { getDataSource } from '@/shared/lib/api/createRepo'
import type { ReportSchedule, ReportSchedulePayload, SendNowResult } from '../api/types'

export interface UseReportSchedulesReturn {
  schedules: ReportSchedule[]
  loading: boolean
  usingLocal: boolean
  add: (payload: ReportSchedulePayload) => Promise<{ data: ReportSchedule | null; error: Error | null }>
  remove: (id: number | string) => Promise<{ error: Error | null }>
  toggleActive: (id: number | string) => Promise<void>
  sendNow: (id: number | string) => Promise<SendNowResult>
  refresh: () => Promise<void>
}

export function useReportSchedules(): UseReportSchedulesReturn {
  const [schedules, setSchedules] = useState<ReportSchedule[]>([])
  const [loading, setLoading] = useState(true)
  const usingLocal = getDataSource() === 'mock'

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      setSchedules(await reportsRepo.list())
    } catch {
      setSchedules([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  async function add(payload: ReportSchedulePayload) {
    const { data, error } = await reportsRepo.add(payload)
    if (!error && data) setSchedules(s => [data, ...s])
    return { data, error }
  }

  async function remove(id: number | string) {
    const { error } = await reportsRepo.remove(id)
    if (!error) setSchedules(s => s.filter(x => x.id !== id))
    return { error }
  }

  async function toggleActive(id: number | string) {
    const found = schedules.find(s => s.id === id)
    if (!found) return
    const { ativo, error } = await reportsRepo.toggleActive(id, found.ativo)
    if (!error) setSchedules(s => s.map(x => x.id === id ? { ...x, ativo } : x))
  }

  async function sendNow(id: number | string) {
    return reportsRepo.sendNow(id)
  }

  return { schedules, loading, usingLocal, add, remove, toggleActive, sendNow, refresh: fetchAll }
}
