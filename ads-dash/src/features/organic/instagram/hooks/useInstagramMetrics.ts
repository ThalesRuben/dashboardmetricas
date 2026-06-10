import { useMetricsContext, type IgData, type IgSyncResult } from '@/app/providers/MetricsContext'

export type { IgData, IgSyncResult }

export interface UseInstagramMetricsReturn {
  data: IgData | null
  loading: boolean
  error: null
  usingMock: boolean
  refresh: () => Promise<void>
  triggerSync: () => Promise<IgSyncResult>
}

export function useInstagramMetrics(): UseInstagramMetricsReturn {
  const { ig, igLoading, igUsingMock, refreshIg, triggerIgSync } = useMetricsContext()
  return {
    data: ig,
    loading: igLoading,
    error: null,
    usingMock: igUsingMock,
    refresh: refreshIg,
    triggerSync: triggerIgSync,
  }
}
