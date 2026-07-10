import { supabase } from '@/shared/lib/supabase';
import type { DemandasRepo } from './demandasRepo';
import type { Demanda, DemandaComentario, TeamMember } from './types';

const COMENTARIO_COLS = 'id, demanda_id, autor_id, texto, criado_em';

// `tenant_id` e `criado_por` vêm dos defaults do banco (0025):
// `current_user_first_tenant()` e `auth.uid()`. Front nunca envia esses campos.

const COLS = 'id, titulo, descricao, status, prioridade, ordem, criado_por, responsavel_id, criado_em, atualizado_em, concluido_em, prazo';

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
        prazo: input.prazo ?? null,
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
    if (input.prazo !== undefined)          patch.prazo = input.prazo;
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

  async listarComentarios(demandaId) {
    const { data, error } = await supabase
      .from('demanda_comentarios')
      .select(COMENTARIO_COLS)
      .eq('demanda_id', demandaId)
      .order('criado_em', { ascending: true });
    if (error || !data) return [];
    return data as DemandaComentario[];
  },

  async criarComentario(input) {
    // tenant_id e autor_id vêm dos defaults do banco (0028).
    const { data, error } = await supabase
      .from('demanda_comentarios')
      .insert({ demanda_id: input.demanda_id, texto: input.texto })
      .select(COMENTARIO_COLS)
      .single();
    if (error || !data) throw new Error(error?.message || 'Falha ao criar comentário.');
    return data as DemandaComentario;
  },

  async removerComentario(id) {
    const { error } = await supabase.from('demanda_comentarios').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },
};
