// API pública da feature `metas`.
export { useMetas } from './hooks/useMetas';
export { metasRepo } from './api/metasRepo';
export { default as MetasBanner } from './components/MetasBanner';
export { default as MetasSettings } from './components/MetasSettings';
export {
  semanaRef,
  mesRef,
  trimestreRef,
  anoRef,
  refAtual,
  mesesDoTrimestre,
  trimestresDoAno,
  rotuloMes,
  progressoTempo,
  progressoTempoRef,
  janelaDoRef,
  diasRestantes,
  rotuloPeriodo,
  veredito,
  vereditoCenario,
  quantoFalta,
} from './lib/periodo';
export type { Veredito, VereditoCenario, MetaCenarios, FaltaCenarios } from './lib/periodo';
export type {
  MetaKpi,
  MetaPeriodo,
  MetaUnidade,
  MetaUpsertInput,
  KpiDef,
} from './api/types';
export { KPIS_PADRAO } from './api/types';
export { seedMetas2026 } from './lib/seed2026';
