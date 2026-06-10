// Interface pública do repositório `organic/instagram`.

import { createRepo } from '@/shared/lib/api/createRepo';
import { mockInstagramRepo } from './instagramRepo.mock';
import { supabaseInstagramRepo } from './instagramRepo.supabase';
import type {
  InstagramAccount,
  InstagramPost,
  InstagramPostMetrics,
  InstagramSummary,
} from './types';

export interface InstagramRepo {
  getAccount(): Promise<InstagramAccount | null>;
  listPosts(opts?: { from?: string; to?: string; limit?: number }): Promise<InstagramPost[]>;
  getPostMetrics(postId: string): Promise<InstagramPostMetrics[]>;
  getSummary(periodDays: number): Promise<InstagramSummary | null>;
}

export const instagramRepo: InstagramRepo = createRepo<InstagramRepo>({
  mock: mockInstagramRepo,
  supabase: supabaseInstagramRepo,
});
