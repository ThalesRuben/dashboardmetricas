// API pública da feature `seo`.
export { useSeoAgent } from './hooks/useSeoAgent';
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
} from './api/types';
