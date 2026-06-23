// Interface pública do repositório `metas`.

import { createRepo } from '@/shared/lib/api/createRepo';
import { mockMetasRepo } from './metasRepo.mock';
import { supabaseMetasRepo } from './metasRepo.supabase';
import type { MetaKpi, MetaPeriodo, MetaUpsertInput } from './types';

export interface MetasRepo {
  listarPorPeriodo(periodo: MetaPeriodo, periodoRef: string): Promise<MetaKpi[]>;
  upsert(input: MetaUpsertInput): Promise<string>;
}

export const metasRepo: MetasRepo = createRepo<MetasRepo>({
  mock: mockMetasRepo,
  supabase: supabaseMetasRepo,
});
