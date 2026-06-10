// Implementação Supabase — payload mais recente de seo_snapshots, mesclado sobre mock.

import { supabase } from '@/shared/lib/supabase';
import type { SeoRepo } from './seoRepo';
import { MOCK_SEO } from './seoRepo.mock';

export const supabaseSeoRepo: SeoRepo = {
  async getSnapshot() {
    const { data, error } = await supabase
      .from('seo_snapshots')
      .select('*')
      .order('date', { ascending: false })
      .limit(1);
    if (error || !data?.length) return null;
    return { ...MOCK_SEO, ...data[0].payload };
  },
};
