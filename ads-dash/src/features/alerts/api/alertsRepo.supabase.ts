// Implementação Supabase — usa a tabela `alerts`.

import { supabase } from '@/shared/lib/supabase';
import type { AlertsRepo } from './alertsRepo';
import type { Alert } from './types';

export const supabaseAlertsRepo: AlertsRepo = {
  async list(limit = 20) {
    const { data, error } = await supabase
      .from('alerts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error || !data?.length) return [];
    return data as unknown as Alert[];
  },
};
