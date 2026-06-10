// Interface pública do repositório `organic/youtube`.

import { createRepo } from '@/shared/lib/api/createRepo';
import { mockYouTubeRepo } from './youtubeRepo.mock';
import { supabaseYouTubeRepo } from './youtubeRepo.supabase';
import type { YouTubeSummary } from './types';

export interface YouTubeRepo {
  getSummary(): Promise<YouTubeSummary | null>;
}

export const youtubeRepo: YouTubeRepo = createRepo<YouTubeRepo>({
  mock: mockYouTubeRepo,
  supabase: supabaseYouTubeRepo,
});
