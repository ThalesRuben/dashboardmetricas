import { supabase } from '@/shared/lib/supabase';
import type { DemandasRepo } from './demandasRepo';
import type { Demanda } from './types';

async function currentTenantId(): Promise<string | null> {
  const { data, error } = await supabase.rpc('current_user_tenants');
  if (error || !data) return null;
  const first = Array.isArray(data) ? data[0] : data;
  return typeof first === 'string' ? first : first?.id ?? null;
}

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
    const tenantId = await currentTenantId();
    if (!tenantId) throw new Error('Tenant não encontrado.');
    const { data, error } = await supabase
      .from('demandas')
      .insert({
        tenant_id: tenantId,
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
