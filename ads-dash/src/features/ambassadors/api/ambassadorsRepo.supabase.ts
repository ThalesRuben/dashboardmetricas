// Implementação Supabase — usa a tabela `ambassadors`.

import { supabase } from '@/shared/lib/supabase';
import type { AmbassadorsRepo } from './ambassadorsRepo';
import type { Ambassador, AmbassadorPayload } from './types';

function toRow(payload: AmbassadorPayload) {
  return {
    nome: payload.nome,
    handle: payload.handle,
    plataforma: payload.plataforma || 'Instagram',
    tipo: payload.tipo || 'micro',
    seguidores: Number(payload.seguidores) || 0,
    engajamento: Number(payload.engajamento) || 0,
    status: payload.status || 'negociando',
    cupom: payload.cupom || '',
    cliques: 0,
    vendas_atribuidas: 0,
    receita_atribuida: 0,
    comissao_pct: Number(payload.comissao_pct) || 0,
    ultimo_post: null,
  };
}

export const supabaseAmbassadorsRepo: AmbassadorsRepo = {
  async list() {
    const { data, error } = await supabase
      .from('ambassadors')
      .select('*')
      .order('created_at', { ascending: true });
    if (error || !data?.length) return [];
    return data as unknown as Ambassador[];
  },

  async add(payload) {
    const { data, error } = await supabase
      .from('ambassadors')
      .insert(toRow(payload))
      .select()
      .single();
    return { data: (data as unknown as Ambassador) ?? null, error };
  },

  async remove(id) {
    const { error } = await supabase.from('ambassadors').delete().eq('id', id);
    return { error };
  },
};
