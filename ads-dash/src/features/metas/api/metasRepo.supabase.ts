import { supabase } from '@/shared/lib/supabase';
import type { MetasRepo } from './metasRepo';
import type { MetaKpi } from './types';

export const supabaseMetasRepo: MetasRepo = {
  async listarPorPeriodo(periodo, periodoRef) {
    const { data, error } = await supabase.rpc('get_metas_periodo', {
      p_periodo: periodo,
      p_periodo_ref: periodoRef,
    });
    if (error || !data) return [];
    return (data as any[]).map((r): MetaKpi => ({
      id: r.id,
      kpi: r.kpi,
      label: r.label ?? null,
      unidade: r.unidade,
      ordem: r.ordem ?? 0,
      valor_meta: Number(r.valor_meta) || 0,
      valor_meta_min: r.valor_meta_min == null ? null : Number(r.valor_meta_min),
      valor_meta_max: r.valor_meta_max == null ? null : Number(r.valor_meta_max),
      valor_realizado: Number(r.valor_realizado) || 0,
    }));
  },

  async upsert(input) {
    const { data, error } = await supabase.rpc('upsert_meta_kpi', {
      p_kpi: input.kpi,
      p_periodo: input.periodo,
      p_periodo_ref: input.periodo_ref,
      p_valor_meta: input.valor_meta,
      p_valor_realizado: input.valor_realizado ?? null,
      p_unidade: input.unidade,
      p_label: input.label,
      p_ordem: input.ordem,
      p_valor_meta_min: input.valor_meta_min ?? null,
      p_valor_meta_max: input.valor_meta_max ?? null,
    });
    if (error) throw new Error(error.message);
    return (data as string) || '';
  },
};
