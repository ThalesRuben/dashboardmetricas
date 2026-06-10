/**
 * Repository pattern base.
 *
 * Cada feature exporta um repositório (interface) e duas implementações:
 *   - mock (localStorage)
 *   - supabase (queries reais com tenant scoping)
 *
 * O switch entre elas é feito por VITE_DATA_SOURCE=mock|supabase em .env.local.
 * Hooks nunca devem importar `supabase/client` direto — sempre via o repo da feature.
 *
 * Uso (exemplo simplificado):
 *
 *   // features/ads/api/adsRepo.ts
 *   import { createRepo } from '@/shared/lib/api/createRepo';
 *   import { mockAdsRepo } from './adsRepo.mock';
 *   import { supabaseAdsRepo } from './adsRepo.supabase';
 *
 *   export const adsRepo = createRepo({
 *     mock: mockAdsRepo,
 *     supabase: supabaseAdsRepo,
 *   });
 */

export type DataSource = 'mock' | 'supabase';

export function getDataSource(): DataSource {
  const raw = import.meta.env.VITE_DATA_SOURCE;
  return raw === 'supabase' ? 'supabase' : 'mock';
}

export interface RepoImpls<T> {
  mock: T;
  supabase: T;
}

/**
 * Retorna a implementação do repositório de acordo com VITE_DATA_SOURCE.
 * Trocar em runtime não é suportado — recarregue a página.
 */
export function createRepo<T>(impls: RepoImpls<T>): T {
  return getDataSource() === 'supabase' ? impls.supabase : impls.mock;
}
