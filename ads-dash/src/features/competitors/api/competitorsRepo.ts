import { createRepo } from '@/shared/lib/api/createRepo';
import { mockCompetitorsRepo } from './competitorsRepo.mock';
import { supabaseCompetitorsRepo } from './competitorsRepo.supabase';
import type { CompetitorBrand, CompetitorContent, CompetitorSnapshot } from './types';

export interface CompetitorsRepo {
  listBrands(): Promise<CompetitorBrand[]>;
  getSnapshots(brandId: string): Promise<CompetitorSnapshot[]>;
  listContent(brandId: string): Promise<CompetitorContent[]>;
  upsertBrand(brand: Omit<CompetitorBrand, 'id' | 'tenantId' | 'createdAt'>): Promise<{ ok: boolean; id?: string; error?: string }>;
}

export const competitorsRepo: CompetitorsRepo = createRepo<CompetitorsRepo>({
  mock: mockCompetitorsRepo,
  supabase: supabaseCompetitorsRepo,
});
