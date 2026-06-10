import { useEffect } from 'react'
import { useMetricsContext } from '@/app/providers/MetricsContext'
import { supabase } from '@/shared/lib/supabase'
import type { AdsPayload, AdsPeriod } from '../api/types'

export interface UseMetricsReturn {
  data: AdsPayload | null
  loading: boolean
  error: null
  refresh: () => Promise<AdsPayload>
}

// Hook fino — delega ao MetricsContext (uma única fonte de verdade).
// Cada chamada com period diferente carrega sob demanda e cacheia.
export function useMetrics(period: AdsPeriod = 'hoje'): UseMetricsReturn {
  const { adsByPeriod, adsLoading, loadAds } = useMetricsContext()

  useEffect(() => { loadAds(period) }, [period, loadAds])

  return {
    data: adsByPeriod[period] ?? null,
    loading: !adsByPeriod[period] || !!adsLoading[period],
    error: null,
    refresh: () => loadAds(period),
  }
}

export interface SaveDailyMetricsRow {
  id: string | number
  period: AdsPeriod
  payload: AdsPayload
  source: string
  created_at?: string
}

// Helper para gravar entrada manual no Supabase (continua igual).
export async function saveDailyMetrics(
  period: AdsPeriod,
  payload: AdsPayload,
  source = 'manual',
): Promise<{ data: SaveDailyMetricsRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from('daily_metrics')
    .insert({ period, payload, source })
    .select()
    .single()
  return { data: (data as unknown as SaveDailyMetricsRow) ?? null, error }
}
