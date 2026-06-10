// API pública da feature `ads`.
// Outras features e o app shell DEVEM importar daqui — nunca de subpastas internas.

// Hooks
export { useMetrics, saveDailyMetrics } from './hooks/useMetrics';
export {
  useDailyMetrics,
  generateDailyRange,
  aggregate,
  deltaPct,
  previousRange,
} from './hooks/useDailyMetrics';
export { useGoals } from './hooks/useGoals';

// Components
export { default as BudgetChart } from './components/BudgetChart';
export { default as ConvChart } from './components/ConvChart';
export { default as CtrChart } from './components/CtrChart';
export { default as RoasChart } from './components/RoasChart';
export { default as CampaignTable } from './components/CampaignTable';

// API
export { adsRepo } from './api/adsRepo';
export type {
  AdSource,
  Campaign,
  DailyMetricRow,
  MetricsSummary,
  Goal,
  PeriodKey,
} from './api/types';
