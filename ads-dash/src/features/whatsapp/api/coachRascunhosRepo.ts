// Repo dos rascunhos de reativação sugeridos pela IA.
// Fluxo humano-no-meio: a edge function coach-reactivation-cron enfileira
// sugestões; o atendente aprova (ou edita / descarta) pelo front; o envio
// real passa pela edge inbox-reply já existente.

import { supabase } from '@/shared/lib/supabase';

export interface CoachRascunho {
  id: string;
  thread_id: string;
  score_lead: number;
  tag_sugerida: 'quente' | 'morno' | 'frio';
  primeiro_nome: string | null;
  resumo_ia: string | null;
  mensagem_sugerida: string;
  status: 'pending' | 'approved' | 'sent' | 'discarded' | 'failed';
  gerado_em: string;
  enviado_em: string | null;
  enviado_erro: string | null;
  // joins
  contato_nome: string | null;
  contato_phone: string;
  thread_status: string;
  thread_ultima_atividade: string;
  inbox_phone: string | null;
}

const COLS = 'id, thread_id, score_lead, tag_sugerida, primeiro_nome, resumo_ia, mensagem_sugerida, status, gerado_em, enviado_em, enviado_erro, thread:whatsapp_threads!inner(status, ultima_atividade, inbox_phone, contato:whatsapp_contatos!inner(nome, phone))';

function normalize(row: any): CoachRascunho {
  const t = row.thread;
  return {
    id: row.id,
    thread_id: row.thread_id,
    score_lead: row.score_lead,
    tag_sugerida: row.tag_sugerida,
    primeiro_nome: row.primeiro_nome,
    resumo_ia: row.resumo_ia,
    mensagem_sugerida: row.mensagem_sugerida,
    status: row.status,
    gerado_em: row.gerado_em,
    enviado_em: row.enviado_em,
    enviado_erro: row.enviado_erro,
    contato_nome: t?.contato?.nome ?? null,
    contato_phone: t?.contato?.phone ?? '',
    thread_status: t?.status ?? '',
    thread_ultima_atividade: t?.ultima_atividade ?? '',
    inbox_phone: t?.inbox_phone ?? null,
  };
}

export const coachRascunhosRepo = {
  async listarPendentes(limit = 100): Promise<CoachRascunho[]> {
    const { data, error } = await supabase
      .from('coach_rascunhos')
      .select(COLS)
      .eq('status', 'pending')
      .order('score_lead', { ascending: false })
      .order('gerado_em', { ascending: false })
      .limit(limit);
    if (error || !data) return [];
    return data.map(normalize);
  },

  async contarPendentes(): Promise<number> {
    const { count } = await supabase
      .from('coach_rascunhos')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending');
    return count ?? 0;
  },

  async descartar(id: string): Promise<void> {
    const { error } = await supabase.rpc('coach_rascunho_descartar', { p_id: id });
    if (error) throw new Error(error.message);
  },

  async marcarEnviado(id: string, texto: string, msgId: string | null): Promise<void> {
    const { error } = await supabase.rpc('coach_rascunho_marcar_enviado', {
      p_id: id, p_texto: texto, p_msg_id: msgId,
    });
    if (error) throw new Error(error.message);
  },

  async marcarFalho(id: string, erro: string): Promise<void> {
    const { error } = await supabase.rpc('coach_rascunho_marcar_falho', {
      p_id: id, p_erro: erro,
    });
    if (error) throw new Error(error.message);
  },

  async blacklistTelefone(phone: string, motivo: string | null): Promise<void> {
    const { error } = await supabase
      .from('whatsapp_no_auto')
      .insert({ phone, motivo });
    if (error && !error.message.includes('duplicate')) throw new Error(error.message);
  },
};
