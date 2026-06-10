// Interface pública do repositório `ai` — cérebro/diretriz da marca.

import { createRepo } from '@/shared/lib/api/createRepo';
import { mockAiBrainRepo } from './aiBrainRepo.mock';
import { supabaseAiBrainRepo } from './aiBrainRepo.supabase';
import type { AiBrain } from './types';

export interface AiBrainRepo {
  get(): Promise<AiBrain | null>;
  save(brain: AiBrain): Promise<{ error: Error | null }>;
}

export const aiBrainRepo: AiBrainRepo = createRepo<AiBrainRepo>({
  mock: mockAiBrainRepo,
  supabase: supabaseAiBrainRepo,
});
