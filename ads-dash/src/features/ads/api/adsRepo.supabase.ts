// Implementação Supabase do AdsRepo. Multi-tenant: queries usam RLS automaticamente
// (auth.uid() → tenant_id via memberships).

import { supabase } from '@/shared/lib/supabase';
import type { AdsRepo } from './adsRepo';
import type {
  Campaign,
  DailyMetricRow,
  Goal,
  MetricsSummary,
  PeriodKey,
} from './types';

export const supabaseAdsRepo: AdsRepo = {
  async listCampaigns({ from, to } = {}): Promise<Campaign[]> {
    const q = supabase.from('ads_campaigns').select('*');
    const { data, error } = await q;
    if (error) {
      console.error('[adsRepo.listCampaigns]', error);
      return [];
    }
    return (data ?? []) as Campaign[];
  },

  async getDailyMetrics(from, to): Promise<DailyMetricRow[]> {
    const { data, error } = await supabase
      .from('ads_daily_metrics')
      .select('*')
      .gte('date', from)
      .lte('date', to)
      .order('date', { ascending: true });
    if (error) {
      console.error('[adsRepo.getDailyMetrics]', error);
      return [];
    }
    return (data ?? []) as DailyMetricRow[];
  },

  async getSummary(period: PeriodKey): Promise<MetricsSummary | null> {
    // TODO: usar RPC ou view materializada `ads_period_summary`.
    return null;
  },

  async saveDailyMetrics(period, payload, source = 'manual') {
    const { error } = await supabase
      .from('ads_daily_metrics_raw')
      .insert({ period, payload, source });
    return { ok: !error, error: error?.message };
  },

  async listGoals(): Promise<Goal[]> {
    const { data, error } = await supabase.from('ads_goals').select('*');
    if (error) {
      console.error('[adsRepo.listGoals]', error);
      return [];
    }
    return (data ?? []) as Goal[];
  },

  async updateGoal(key, patch) {
    const { error } = await supabase
      .from('ads_goals')
      .upsert({ key, ...patch }, { onConflict: 'tenant_id,key' });
    return { ok: !error, error: error?.message };
  },
};
