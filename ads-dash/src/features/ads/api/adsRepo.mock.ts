// Implementação mock do AdsRepo usando localStorage + gerador determinístico.
// Suficiente pra dev/demo sem Supabase configurado.

import type { AdsRepo } from './adsRepo';
import type {
  Campaign,
  DailyMetricRow,
  Goal,
  MetricsSummary,
  PeriodKey,
} from './types';

// TODO(fase 3): mover gerador determinístico pra `lib/mockGenerator.ts`
// e fazer useDailyMetrics consumir daqui em vez de gerar inline.

const LS_GOALS = 'ads:goals';

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* localStorage cheio ou indisponível */
  }
}

const DEFAULT_GOALS: Goal[] = [
  { key: 'roas',         label: 'ROAS mínimo',         unit: 'x',     value: 4.0, enabled: true },
  { key: 'ctrMeta',      label: 'CTR Meta',            unit: '%',     value: 2.5, enabled: true },
  { key: 'agendamentos', label: 'Agendamentos/semana', unit: 'agend', value: 50,  enabled: false },
];

export const mockAdsRepo: AdsRepo = {
  async listCampaigns(): Promise<Campaign[]> {
    // TODO: gerar mocks de campaigns
    return [];
  },

  async getDailyMetrics(): Promise<DailyMetricRow[]> {
    // O gerador determinístico vive no hook useDailyMetrics por enquanto.
    // Quando movermos, esta função vai chamá-lo.
    return [];
  },

  async getSummary(): Promise<MetricsSummary | null> {
    // MetricsContext ainda popula esse estado direto. Stub vazio até refatorarmos.
    return null;
  },

  async saveDailyMetrics(period, payload, source = 'manual') {
    const key = `ads:daily:${period}:${Date.now()}`;
    writeJson(key, { period, payload, source, savedAt: new Date().toISOString() });
    return { ok: true };
  },

  async listGoals(): Promise<Goal[]> {
    return readJson<Goal[]>(LS_GOALS, DEFAULT_GOALS);
  },

  async updateGoal(key, patch) {
    const goals = readJson<Goal[]>(LS_GOALS, DEFAULT_GOALS);
    const i = goals.findIndex((g) => g.key === key);
    if (i >= 0) goals[i] = { ...goals[i], ...patch };
    else goals.push({ key, label: key, unit: '', value: 0, enabled: true, ...patch });
    writeJson(LS_GOALS, goals);
    return { ok: true };
  },
};
