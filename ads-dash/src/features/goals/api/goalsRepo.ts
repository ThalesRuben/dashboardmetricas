// Interface pública do repositório `goals`.

import { createRepo } from '@/shared/lib/api/createRepo';
import { mockGoalsRepo } from './goalsRepo.mock';
import { supabaseGoalsRepo } from './goalsRepo.supabase';
import type { Quarter } from './types';

export interface GoalsRepo {
  list(): Promise<Quarter[]>;
  saveLocal(list: Quarter[]): void;
}

export const goalsRepo: GoalsRepo = createRepo<GoalsRepo>({
  mock: mockGoalsRepo,
  supabase: supabaseGoalsRepo,
});
