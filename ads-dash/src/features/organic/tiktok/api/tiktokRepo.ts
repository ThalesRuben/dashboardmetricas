// Interface pública do repositório `organic/tiktok`.

import { createRepo } from '@/shared/lib/api/createRepo';
import { mockTikTokRepo } from './tiktokRepo.mock';
import { supabaseTikTokRepo } from './tiktokRepo.supabase';
import type { TikTokSummary } from './types';

export interface TikTokRepo {
  getSummary(): Promise<TikTokSummary | null>;
}

export const tiktokRepo: TikTokRepo = createRepo<TikTokRepo>({
  mock: mockTikTokRepo,
  supabase: supabaseTikTokRepo,
});
