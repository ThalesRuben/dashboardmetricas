// Interface pública do repositório `ambassadors`.

import { createRepo } from '@/shared/lib/api/createRepo';
import { mockAmbassadorsRepo } from './ambassadorsRepo.mock';
import { supabaseAmbassadorsRepo } from './ambassadorsRepo.supabase';
import type { Ambassador, AmbassadorPayload } from './types';

export interface AmbassadorsRepo {
  list(): Promise<Ambassador[]>;
  add(payload: AmbassadorPayload): Promise<{ data: Ambassador | null; error: Error | null }>;
  remove(id: string): Promise<{ error: Error | null }>;
}

export const ambassadorsRepo: AmbassadorsRepo = createRepo<AmbassadorsRepo>({
  mock: mockAmbassadorsRepo,
  supabase: supabaseAmbassadorsRepo,
});
