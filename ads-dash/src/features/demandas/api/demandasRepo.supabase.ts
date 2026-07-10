import { supabase } from '@/shared/lib/supabase';
import type { DemandasRepo } from './demandasRepo';
import type { Demanda } from './types';

// tenant_id é preenchido server-side pelo default `paciente_1_tenant_id()`
// (ver migration 0023). Sob login estático o front não tem auth.uid(), então
// não dá pra resolver o tenant do lado do cliente.

export const supabaseDemandasRepo: DemandasRepo = {
  async listar() {
    const { data, error } = await supabase
      .from('demandas')
      .select('id, titulo, descricao, status, prioridade, ordem, criado_em, atualizado_em')
      .order('status', { ascending: true })
      .order('ordem', { ascending: true });
    if (error || !data) return [];
    return data as Demanda[];
  },

  async criar(input) {
    const { data, error } = await supabase
      .from('demandas')
      .insert({
        titulo: input.titulo,
        descricao: input.descricao ?? null,
        status: input.status ?? 'backlog',
        prioridade: input.prioridade ?? 'media',
        ordem: Date.now(),
      })
      .select('id, titulo, descricao, status, prioridade, ordem, criado_em, atualizado_em')
      .single();
    if (error || !data) throw new Error(error?.message || 'Falha ao criar demanda.');
    return data as Demanda;
  },

  async atualizar(input) {
    const patch: Record<string, unknown> = {};
    if (input.titulo !== undefined)     patch.titulo = input.titulo;
    if (input.descricao !== undefined)  patch.descricao = input.descricao;
    if (input.status !== undefined)     patch.status = input.status;
    if (input.prioridade !== undefined) patch.prioridade = input.prioridade;
    if (input.ordem !== undefined)      patch.ordem = input.ordem;
    const { error } = await supabase.from('demandas').update(patch).eq('id', input.id);
    if (error) throw new Error(error.message);
  },

  async remover(id) {
    const { error } = await supabase.from('demandas').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },
};
