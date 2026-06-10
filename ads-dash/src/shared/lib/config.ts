// Configuração centralizada — thresholds, cores e tempos.
// Mude aqui pra ajustar comportamento sem caçar magic numbers no código.

export const PLATFORM_COLORS = {
  meta: '#378ADD',
  google: '#639922',
  ctwa: '#EF9F27',
  api: '#7F77DD',
  instagram: '#E1306C',
  reels: '#8134AF',
  facebook: '#1877F2',
  whatsapp: '#25D366',
} as const;

export const HYPE_THRESHOLDS = {
  windowDays: 14,
  engagementMultiplier: 1.8,
  reachMultiplier: 1.5,
  reachOfFollowers: 0.5,
  playsMultiplier: 3,
  savesMultiplier: 2,
  sharesMultiplier: 2,
} as const;

export const AI_THRESHOLDS = {
  roasGood: 4.0,
  roasMin: 3.0,
  ctrGood: 4.0,
  ctrMin: 2.5,
  budgetWarn: 0.85,
  conversionMin: 0.10,
  msgRateMin: 0.20,
  agendRateMin: 0.40,
  closeRateMin: 0.50,
  clickRateMin: 0.02,
  metaConcentration: 0.80,
  scaleRoas: 4.5,
  pauseRoas: 3.0,
  pauseInvest: 50,
} as const;

export const IG_BENCHMARKS = {
  engagementGood: 5,
  engagementBad: 2,
  growth30dGood: 200,
  ctaRateMin: 5,
  reelsVsPostsRatio: 1.5,
  topPostShare: 7,
} as const;

export const TIMEOUTS = {
  edgeFunctionMs: 30000,
  feedbackMs: 4000,
  feedbackErrorMs: 6000,
  hypeRefreshMs: 60000,
  thinkingMinMs: 350,
  thinkingMaxMs: 750,
} as const;

export interface DatePreset {
  key: string;
  label: string;
  days: number | null;
  offset?: number;
}

export const DATE_PRESETS: readonly DatePreset[] = [
  { key: 'hoje',   label: 'Hoje',          days: 1 },
  { key: 'ontem',  label: 'Ontem',         days: 1, offset: 1 },
  { key: '7',      label: 'Últimos 7d',    days: 7 },
  { key: '14',     label: 'Últimos 14d',   days: 14 },
  { key: '30',     label: 'Últimos 30d',   days: 30 },
  { key: '90',     label: 'Últimos 90d',   days: 90 },
  { key: 'custom', label: 'Personalizado', days: null },
];

export const TIMEZONE = 'America/Sao_Paulo';
