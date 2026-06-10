import { supabase } from '@/shared/lib/supabase';
import type { CompetitorsRepo } from './competitorsRepo';
import type { CompetitorBrand, CompetitorContent, CompetitorSnapshot } from './types';

export const supabaseCompetitorsRepo: CompetitorsRepo = {
  async listBrands() {
    const { data, error } = await supabase
      .from('competitors_brands')
      .select('*')
      .order('nome', { ascending: true });
    if (error) {
      console.error('[competitorsRepo.listBrands]', error);
      return [];
    }
    return (data ?? []) as unknown as CompetitorBrand[];
  },

  async getSnapshots(brandId) {
    const { data, error } = await supabase
      .from('competitors_snapshots')
      .select('*')
      .eq('brand_id', brandId)
      .order('date', { ascending: true });
    if (error) {
      console.error('[competitorsRepo.getSnapshots]', error);
      return [];
    }
    return (data ?? []) as unknown as CompetitorSnapshot[];
  },

  async listContent(brandId) {
    const { data, error } = await supabase
      .from('competitors_content')
      .select('*')
      .eq('brand_id', brandId)
      .order('posted_at', { ascending: false });
    if (error) {
      console.error('[competitorsRepo.listContent]', error);
      return [];
    }
    return (data ?? []) as unknown as CompetitorContent[];
  },

  async upsertBrand(brand) {
    const { data, error } = await supabase
      .from('competitors_brands')
      .insert(brand)
      .select('id')
      .single();
    return { ok: !error, id: (data as { id?: string } | null)?.id, error: error?.message };
  },
};
