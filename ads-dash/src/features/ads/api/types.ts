// Tipos públicos da feature `ads`. Compartilhados entre repo + hooks + components.

export type AdSource = 'meta' | 'google';

export interface Campaign {
  id: string;
  tenantId: string;
  source: AdSource;
  externalId: string;
  name: string;
  status: 'active' | 'paused' | 'archived';
  dailyBudgetCents: number;
  createdAt: string;
  updatedAt: string;
}

export interface DailyMetricRow {
  date: string;             // YYYY-MM-DD
  investido: number;
  receita: number;
  impressoes: number;
  cliques: number;
  mensagens: number;
  agendamentos: number;
  vendas: number;
  roas: number;
  roi: number;
  ctr: number;
  ctrMeta: number;
  ctrGoogle: number;
  posts?: number;
}

/**
 * Métrica diária gerada por useDailyMetrics — inclui campos derivados
 * que não vão pro banco (iso, dow, funil).
 */
export interface DailyMetric extends DailyMetricRow {
  iso: string;
  dow: number;
  funil: {
    impressoes: number;
    cliques: number;
    mensagens: number;
    agendamentos: number;
    vendas: number;
  };
}

export interface MetricsSummary {
  days: number;
  investido: number;
  receita: number;
  impressoes: number;
  cliques: number;
  mensagens: number;
  agendamentos: number;
  vendas: number;
  posts: number;
  roas: number;
  roi: number;
  ctr: number;
  ctrMeta: number;
  ctrGoogle: number;
}

export interface DateRange {
  from: Date;
  to: Date;
  presetKey?: string;
}

/**
 * Meta operacional persistida (`goals` table) — threshold/limit que aciona
 * insights e alertas. Não confundir com `quarterly_goals` (feature `goals`).
 */
export interface Goal {
  key: string;
  label: string;
  unit: string;
  value: number;
  enabled: boolean;
}

export type AdsPeriod = 'hoje' | 'semana' | 'mes';

export type PeriodKey = AdsPeriod | string;

/**
 * Payload de métricas de Ads para um período (hoje/semana/mes).
 * Estrutura ampla — inclui resumo, funil, campanhas e dados pré-prontos
 * para gráficos. Veio do mock original; hoje/semana/mes têm o mesmo shape.
 */
export interface AdsPayload {
  roas: number;
  roi: number;
  ctrMeta: number;
  ctrGoogle: number;
  mensagens: number;
  vendas: number;
  agendamentos: number;
  investimento: number;
  receita: number;
  funil: {
    impressoes: number;
    cliques: number;
    mensagens: number;
    agendamentos: number;
    vendas: number;
  };
  campanhas: AdsCampaign[];
  chartRoas: { labels: string[]; hoje: number[]; ontem: number[] };
  chartConv: {
    labels: string[];
    mensagens: number[];
    agendamentos: number[];
    vendas: number[];
  };
  chartCtr: {
    labels: string[];
    meta: number[];
    google: number[];
  };
  budget: { meta: number; google: number };
}

export interface AdsCampaign {
  id: number;
  nome: string;
  plataforma: 'Meta' | 'Google';
  tipo: string;
  investido: number;
  impressoes: number;
  ctr: number;
  mensagens: number;
  agendamentos: number;
  vendas: number;
  roas: number;
  status: 'ativo' | 'revisar' | 'pausado';
}

export interface SaveDailyMetricsResult {
  ok: boolean;
  error?: string;
}
