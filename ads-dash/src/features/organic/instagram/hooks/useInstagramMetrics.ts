import { useMetricsContext, type IgData, type IgSyncResult, type IgAccountEntry } from '@/app/providers/MetricsContext'

export type { IgData, IgSyncResult, IgAccountEntry }

export interface UseInstagramMetricsReturn {
  data: IgData | null
  loading: boolean
  error: null
  usingMock: boolean
  accounts: IgAccountEntry[]
  selectedAccountId: string | null
  selectAccount: (id: string) => void
  refresh: () => Promise<void>
  triggerSync: () => Promise<IgSyncResult>
}

export function useInstagramMetrics(): UseInstagramMetricsReturn {
  const {
    ig, igLoading, igUsingMock,
    igAccounts, selectedIgUserId, selectIgAccount,
    refreshIg, triggerIgSync,
  } = useMetricsContext()
  return {
    data: ig,
    loading: igLoading,
    error: null,
    usingMock: igUsingMock,
    accounts: igAccounts,
    selectedAccountId: selectedIgUserId,
    selectAccount: selectIgAccount,
    refresh: refreshIg,
    triggerSync: triggerIgSync,
  }
}
