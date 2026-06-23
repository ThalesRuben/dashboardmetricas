// API pública da feature `metas`.
export { useMetas } from './hooks/useMetas';
export { metasRepo } from './api/metasRepo';
export { default as MetasBanner } from './components/MetasBanner';
export { default as MetasSettings } from './components/MetasSettings';
export {
  semanaRef,
  trimestreRef,
  anoRef,
  refAtual,
  progressoTempo,
  diasRestantes,
  rotuloPeriodo,
  veredito,
} from './lib/periodo';
export type { Veredito } from './lib/periodo';
export type {
  MetaKpi,
  MetaPeriodo,
  MetaUnidade,
  MetaUpsertInput,
  KpiDef,
} from './api/types';
export { KPIS_PADRAO } from './api/types';
