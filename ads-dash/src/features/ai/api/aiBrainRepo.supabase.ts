// Implementação Supabase — tabela `ai_brain` com payload jsonb e updated_at.

import { supabase } from '@/shared/lib/supabase';
import type { AiBrainRepo } from './aiBrainRepo';
import type { AiBrain } from './types';
import { DEFAULT_BRAIN } from '../lib/constants';

const STORAGE_KEY = 'ads-dash:ai-brain';

export const supabaseAiBrainRepo: AiBrainRepo = {
  async get() {
    const { data, error } = await supabase
      .from('ai_brain')
      .select('payload')
      .order('updated_at', { ascending: false })
      .limit(1);
    if (error || !data?.length) return null;
    return { ...DEFAULT_BRAIN, ...(data[0].payload as Partial<AiBrain>) };
  },

  async save(brain) {
    // Persistência redundante em localStorage como cache local pra preview offline.
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(brain)); } catch { /* ignore */ }
    const { error } = await supabase.from('ai_brain').insert({ payload: brain });
    return { error };
  },
};
