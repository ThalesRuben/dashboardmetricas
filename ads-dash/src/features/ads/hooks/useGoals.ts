import { useMetricsContext } from '@/app/providers/MetricsContext'
import type { Goal } from '../api/types'

export interface UseGoalsReturn {
  goals: Goal[]
  loading: boolean
  updateGoal: (key: string, patch: Partial<Goal>) => Promise<void>
  refresh: () => Promise<void>
}

export function useGoals(): UseGoalsReturn {
  const { goals, goalsLoading, updateGoal, refreshGoals } = useMetricsContext()
  return { goals, loading: goalsLoading, updateGoal, refresh: refreshGoals }
}
