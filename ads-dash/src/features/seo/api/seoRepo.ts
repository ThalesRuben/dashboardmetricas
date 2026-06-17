// Interface pública do repositório `seo`.

import { createRepo } from '@/shared/lib/api/createRepo';
import { mockSeoRepo } from './seoRepo.mock';
import { supabaseSeoRepo } from './seoRepo.supabase';
import type { SeoSnapshot, SeoKeywordResearch, SeoKeyword } from './types';

export interface AddMonitoredInput {
  termo: string;
  volume?: number;
  dificuldade?: SeoKeyword['dificuldade'];
  oportunidade?: SeoKeyword['oportunidade'];
}

export interface SeoRepo {
  getSnapshot(): Promise<SeoSnapshot | null>;
  researchKeyword(termo: string): Promise<SeoKeywordResearch | null>;
  addMonitoredKeyword(input: AddMonitoredInput): Promise<{ ok: boolean; error?: string }>;
}

export const seoRepo: SeoRepo = createRepo<SeoRepo>({
  mock: mockSeoRepo,
  supabase: supabaseSeoRepo,
});
