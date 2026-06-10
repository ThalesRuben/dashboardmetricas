// Interface pública do repositório `seo`.

import { createRepo } from '@/shared/lib/api/createRepo';
import { mockSeoRepo } from './seoRepo.mock';
import { supabaseSeoRepo } from './seoRepo.supabase';
import type { SeoSnapshot } from './types';

export interface SeoRepo {
  getSnapshot(): Promise<SeoSnapshot | null>;
}

export const seoRepo: SeoRepo = createRepo<SeoRepo>({
  mock: mockSeoRepo,
  supabase: supabaseSeoRepo,
});
