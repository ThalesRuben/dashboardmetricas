// API pública da feature `ai` — cérebro/diretriz da IA.
export { useAiBrain } from './hooks/useAiBrain';
export { BRAIN_FIELDS, DEFAULT_BRAIN } from './lib/constants';
export { aiBrainRepo } from './api/aiBrainRepo';
export type { AiBrain } from './api/types';
