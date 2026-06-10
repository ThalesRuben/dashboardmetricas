// Interface pública do repositório `reports`.

import { createRepo } from '@/shared/lib/api/createRepo';
import { mockReportsRepo } from './reportsRepo.mock';
import { supabaseReportsRepo } from './reportsRepo.supabase';
import type {
  ReportSchedule,
  ReportSchedulePayload,
  SendNowResult,
} from './types';

export interface ReportsRepo {
  list(): Promise<ReportSchedule[]>;
  add(payload: ReportSchedulePayload): Promise<{ data: ReportSchedule | null; error: Error | null }>;
  remove(id: number | string): Promise<{ error: Error | null }>;
  toggleActive(id: number | string, current: boolean): Promise<{ ativo: boolean; error: Error | null }>;
  sendNow(id: number | string): Promise<SendNowResult>;
}

export const reportsRepo: ReportsRepo = createRepo<ReportsRepo>({
  mock: mockReportsRepo,
  supabase: supabaseReportsRepo,
});
