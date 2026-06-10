// Interface pública do repositório `ads` + seleção mock|supabase.
// Hooks e componentes da feature SÓ devem falar com adsRepo (nunca com supabase direto).

import { createRepo } from '@/shared/lib/api/createRepo';
import { mockAdsRepo } from './adsRepo.mock';
import { supabaseAdsRepo } from './adsRepo.supabase';
import type {
  Campaign,
  DailyMetricRow,
  Goal,
  MetricsSummary,
  PeriodKey,
  SaveDailyMetricsResult,
} from './types';

export interface AdsRepo {
  listCampaigns(opts?: { from?: string; to?: string }): Promise<Campaign[]>;
  getDailyMetrics(from: string, to: string): Promise<DailyMetricRow[]>;
  getSummary(period: PeriodKey): Promise<MetricsSummary | null>;
  saveDailyMetrics(
    period: PeriodKey,
    payload: Record<string, unknown>,
    source?: string,
  ): Promise<SaveDailyMetricsResult>;
  listGoals(): Promise<Goal[]>;
  updateGoal(key: string, patch: Partial<Goal>): Promise<{ ok: boolean; error?: string }>;
}

export const adsRepo: AdsRepo = createRepo<AdsRepo>({
  mock: mockAdsRepo,
  supabase: supabaseAdsRepo,
});
