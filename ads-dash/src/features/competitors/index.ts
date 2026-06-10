// API pública da feature `competitors`.

// Hook + utilitários
export {
  useCompetitors,
  latestSnapshot,
  dimensionLabel,
  CONTENT_TAGS,
  CONTENT_DIMENSIONS,
} from './hooks/useCompetitors';

// Components
export { default as BenchmarkPanel } from './components/BenchmarkPanel';
export { default as CompetitorCard } from './components/CompetitorCard';
export { default as CompetitorComparisonChart } from './components/CompetitorComparisonChart';
export { default as MarketRadar } from './components/MarketRadar';
export { default as ScriptGenerator } from './components/ScriptGenerator';
export { default as ValidatedContent } from './components/ValidatedContent';

// API
export { competitorsRepo } from './api/competitorsRepo';
export type {
  CompetitorBrand,
  CompetitorSnapshot,
  CompetitorContent,
} from './api/types';
