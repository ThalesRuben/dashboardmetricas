import { supabase } from '@/shared/lib/supabase';
import type { CrmRepo } from './crmRepo';
import type {
  CrmNota,
  CrmTag,
  CrmFollowup,
  CrmFollowupComContato,
  CrmVenda,
  CrmSummary,
} from './crmTypes';
import type { WhatsAppThreadStatusReal } from './types';

const NOTA_COLS = 'id, thread_id, autor_id, texto, criado_em';
const TAG_COLS = 'id, nome, cor';
const FOLLOWUP_COLS = 'id, thread_id, responsavel_id, data, motivo, feito, feito_em, criado_em';
const VENDA_COLS = 'id, thread_id, registrado_por, servico, valor_cents, data, observacao, criado_em';

const SUMMARY_EMPTY: CrmSummary = {
  leads: 0, em_atendimento: 0, agendados: 0,
  vendas_qtd: 0, vendas_valor_cents: 0, ticket_medio_cents: 0,
  followups_pendentes: 0, followups_atrasados: 0,
};

export const supabaseCrmRepo: CrmRepo = {
  async listarNotas(threadId) {
    const { data, error } = await supabase
      .from('crm_notas')
      .select(NOTA_COLS)
      .eq('thread_id', threadId)
      .order('criado_em', { ascending: false });
    if (error || !data) return [];
    return data as CrmNota[];
  },

  async criarNota(threadId, texto) {
    const { data, error } = await supabase
      .from('crm_notas')
      .insert({ thread_id: threadId, texto })
      .select(NOTA_COLS)
      .single();
    if (error || !data) throw new Error(error?.message || 'Falha ao criar nota.');
    return data as CrmNota;
  },

  async removerNota(id) {
    const { error } = await supabase.from('crm_notas').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },

  async listarTags() {
    const { data, error } = await supabase
      .from('crm_tags')
      .select(TAG_COLS)
      .order('nome', { ascending: true });
    if (error || !data) return [];
    return data as CrmTag[];
  },

  async criarTag(nome, cor = '#5dcaa5') {
    const { data, error } = await supabase
      .from('crm_tags')
      .insert({ nome, cor })
      .select(TAG_COLS)
      .single();
    if (error || !data) throw new Error(error?.message || 'Falha ao criar tag.');
    return data as CrmTag;
  },

  async removerTag(id) {
    const { error } = await supabase.from('crm_tags').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },

  async tagsDaThread(threadId) {
    const { data, error } = await supabase
      .from('crm_thread_tags')
      .select('crm_tags!inner(id, nome, cor)')
      .eq('thread_id', threadId);
    if (error || !data) return [];
    // Postgrest tipa embedded como array; na prática é 1 (FK-to-one). Normaliza.
    return (data as unknown as Array<{ crm_tags: CrmTag | CrmTag[] }>).flatMap(r => {
      const t = r.crm_tags;
      return Array.isArray(t) ? t : [t];
    });
  },

  async aplicarTag(threadId, tagId) {
    const { error } = await supabase
      .from('crm_thread_tags')
      .upsert({ thread_id: threadId, tag_id: tagId }, { onConflict: 'thread_id,tag_id' });
    if (error) throw new Error(error.message);
  },

  async removerTagDaThread(threadId, tagId) {
    const { error } = await supabase
      .from('crm_thread_tags')
      .delete()
      .eq('thread_id', threadId)
      .eq('tag_id', tagId);
    if (error) throw new Error(error.message);
  },

  async listarFollowupsPendentes() {
    const { data, error } = await supabase
      .from('crm_followups')
      .select(`
        ${FOLLOWUP_COLS},
        whatsapp_threads!inner (
          status,
          whatsapp_contatos!inner ( nome, phone )
        )
      `)
      .eq('feito', false)
      .order('data', { ascending: true });
    if (error || !data) return [];
    return (data as Array<any>).map((r): CrmFollowupComContato => ({
      id: r.id,
      thread_id: r.thread_id,
      responsavel_id: r.responsavel_id,
      data: r.data,
      motivo: r.motivo,
      feito: r.feito,
      feito_em: r.feito_em,
      criado_em: r.criado_em,
      contato_nome: r.whatsapp_threads?.whatsapp_contatos?.nome ?? null,
      contato_phone: r.whatsapp_threads?.whatsapp_contatos?.phone ?? '',
      thread_status: r.whatsapp_threads?.status ?? 'aberta',
    }));
  },

  async followupsDaThread(threadId) {
    const { data, error } = await supabase
      .from('crm_followups')
      .select(FOLLOWUP_COLS)
      .eq('thread_id', threadId)
      .order('data', { ascending: true });
    if (error || !data) return [];
    return data as CrmFollowup[];
  },

  async criarFollowup(input) {
    const { data, error } = await supabase
      .from('crm_followups')
      .insert({
        thread_id: input.thread_id,
        data: input.data,
        motivo: input.motivo ?? null,
      })
      .select(FOLLOWUP_COLS)
      .single();
    if (error || !data) throw new Error(error?.message || 'Falha ao criar follow-up.');
    return data as CrmFollowup;
  },

  async marcarFollowupFeito(id) {
    const { error } = await supabase
      .from('crm_followups')
      .update({ feito: true, feito_em: new Date().toISOString() })
      .eq('id', id);
    if (error) throw new Error(error.message);
  },

  async removerFollowup(id) {
    const { error } = await supabase.from('crm_followups').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },

  async listarVendas(threadId) {
    const { data, error } = await supabase
      .from('crm_vendas')
      .select(VENDA_COLS)
      .eq('thread_id', threadId)
      .order('data', { ascending: false });
    if (error || !data) return [];
    return data as CrmVenda[];
  },

  async registrarVenda(input) {
    const patch: Record<string, unknown> = {
      thread_id: input.thread_id,
      servico: input.servico,
      valor_cents: input.valor_cents,
      observacao: input.observacao ?? null,
    };
    if (input.data) patch.data = input.data;
    const { data, error } = await supabase
      .from('crm_vendas')
      .insert(patch)
      .select(VENDA_COLS)
      .single();
    if (error || !data) throw new Error(error?.message || 'Falha ao registrar venda.');
    // Ao registrar venda, promove a thread pra status 'venda' automaticamente.
    await supabase.rpc('crm_set_thread_status', {
      p_thread_id: input.thread_id,
      p_status: 'venda',
    });
    return data as CrmVenda;
  },

  async removerVenda(id) {
    const { error } = await supabase.from('crm_vendas').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },

  async setStatus(threadId, status: WhatsAppThreadStatusReal) {
    const { error } = await supabase.rpc('crm_set_thread_status', {
      p_thread_id: threadId,
      p_status: status,
    });
    if (error) throw new Error(error.message);
  },

  async getSummary(range) {
    const { data, error } = await supabase.rpc('crm_summary', {
      p_from: range?.from ? range.from.toISOString() : null,
      p_to:   range?.to   ? range.to.toISOString()   : null,
    });
    if (error || !data) return SUMMARY_EMPTY;
    // RPC retorna array de 1 linha
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return SUMMARY_EMPTY;
    return {
      leads: Number(row.leads) || 0,
      em_atendimento: Number(row.em_atendimento) || 0,
      agendados: Number(row.agendados) || 0,
      vendas_qtd: Number(row.vendas_qtd) || 0,
      vendas_valor_cents: Number(row.vendas_valor_cents) || 0,
      ticket_medio_cents: Number(row.ticket_medio_cents) || 0,
      followups_pendentes: Number(row.followups_pendentes) || 0,
      followups_atrasados: Number(row.followups_atrasados) || 0,
    };
  },
};
