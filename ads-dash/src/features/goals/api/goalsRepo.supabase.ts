// Implementação Supabase — usa a tabela `quarterly_goals`. Cache local de edição
// fica em localStorage até a próxima feature de persistência server-side de patches.

import { supabase } from '@/shared/lib/supabase';
import type { GoalsRepo } from './goalsRepo';
import type { Quarter } from './types';
import { GOALS_STORAGE_KEY } from './goalsRepo.mock';

export const supabaseGoalsRepo: GoalsRepo = {
  async list() {
    const { data, error } = await supabase
      .from('quarterly_goals')
      .select('*')
      .order('q', { ascending: true });
    if (error || !data?.length) return [];
    return data as unknown as Quarter[];
  },

  saveLocal(list) {
    try { localStorage.setItem(GOALS_STORAGE_KEY, JSON.stringify(list)); } catch { /* ignore */ }
  },
};
