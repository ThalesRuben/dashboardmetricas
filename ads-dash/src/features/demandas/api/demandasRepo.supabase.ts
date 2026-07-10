import { supabase } from '@/shared/lib/supabase';
import type { DemandasRepo } from './demandasRepo';
import type { Demanda, TeamMember } from './types';

// `tenant_id` e `criado_por` vêm dos defaults do banco (0025):
// `current_user_first_tenant()` e `auth.uid()`. Front nunca envia esses campos.

const COLS = 'id, titulo, descricao, status, prioridade, ordem, criado_por, responsavel_id, criado_em, atualizado_em';

export const supabaseDemandasRepo: DemandasRepo = {
  async listar() {
    const { data, error } = await supabase
      .from('demandas')
      .select(COLS)
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
        responsavel_id: input.responsavel_id ?? null,
        ordem: Date.now(),
      })
      .select(COLS)
      .single();
    if (error || !data) throw new Error(error?.message || 'Falha ao criar demanda.');
    return data as Demanda;
  },

  async atualizar(input) {
    const patch: Record<string, unknown> = {};
    if (input.titulo !== undefined)         patch.titulo = input.titulo;
    if (input.descricao !== undefined)      patch.descricao = input.descricao;
    if (input.status !== undefined)         patch.status = input.status;
    if (input.prioridade !== undefined)     patch.prioridade = input.prioridade;
    if (input.ordem !== undefined)          patch.ordem = input.ordem;
    if (input.responsavel_id !== undefined) patch.responsavel_id = input.responsavel_id;
    const { error } = await supabase.from('demandas').update(patch).eq('id', input.id);
    if (error) throw new Error(error.message);
  },

  async remover(id) {
    const { error } = await supabase.from('demandas').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },

  async listarEquipe() {
    const { data, error } = await supabase.rpc('demandas_team_members');
    if (error || !data) return [];
    return (data as TeamMember[]).filter(m => m.full_name);
  },
};
