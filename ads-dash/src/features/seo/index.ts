// API pública da feature `seo`.
export { useSeoAgent } from './hooks/useSeoAgent';
export { useKeywordResearch } from './hooks/useKeywordResearch';
export { default as KeywordResearch } from './components/KeywordResearch';
export { seoRepo } from './api/seoRepo';
export type {
  SeoSnapshot,
  SeoResumo,
  SeoKeyword,
  SeoSugestao,
  SeoAuditoriaItem,
  SeoDificuldade,
  SeoOportunidade,
  SeoPrioridade,
  SeoStatus,
  SeoIntent,
  SeoKeywordIdea,
  SeoKeywordResearch,
} from './api/types';
