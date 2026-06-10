// Interface pública do repositório `alerts`.

import { createRepo } from '@/shared/lib/api/createRepo';
import { mockAlertsRepo } from './alertsRepo.mock';
import { supabaseAlertsRepo } from './alertsRepo.supabase';
import type { Alert } from './types';

export interface AlertsRepo {
  list(limit?: number): Promise<Alert[]>;
}

export const alertsRepo: AlertsRepo = createRepo<AlertsRepo>({
  mock: mockAlertsRepo,
  supabase: supabaseAlertsRepo,
});
