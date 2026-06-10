// API pública da feature `goals` — metas trimestrais.
export { useQuarterlyGoals } from './hooks/useQuarterlyGoals';
export { goalsRepo } from './api/goalsRepo';
export type {
  Quarter,
  QuarterKey,
  QuarterStatus,
  QuarterMeta,
  MetaUnidade,
  MetaPatch,
} from './api/types';
