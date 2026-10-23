// Implementação Supabase — payload mais recente da tabela whatsapp_metrics
// é mesclado sobre o mock para preencher lacunas.

import { supabase, invokeFunction } from '@/shared/lib/supabase';
import type { WhatsAppRepo } from './whatsappRepo';
import type {
  WhatsAppDisparoResultado,
  WhatsAppDisparoHistorico,
  WhatsAppThreadReal,
  WhatsAppMsgReal,
  WhatsAppInbox,
  WhatsAppNumber,
  WhatsAppNumberInput,
  WhatsAppTemplate,
  WhatsAppTemplateInput,
  WhatsAppTemplateCreateResult,
  WhatsAppTemplateSyncResult,
  ReplyResultado,
} from './types';
import { MOCK_WHATSAPP } from './whatsappRepo.mock';

export const supabaseWhatsAppRepo: WhatsAppRepo = {
  async getSummary(inboxPhone?: string | null, range?: { from: Date; to: Date } | null) {
    const { data, error } = await supabase.rpc('get_whatsapp_summary', {
      p_inbox_phone: inboxPhone ?? null,
      p_from: range?.from ? range.from.toISOString() : null,
      p_to:   range?.to   ? range.to.toISOString()   : null,
    });
    if (error || !data) return null;
    return { ...MOCK_WHATSAPP, ...(data as any) };
  },

  async listarInboxes(): Promise<WhatsAppInbox[]> {
    const { data, error } = await supabase.rpc('list_whatsapp_inboxes');
    if (error || !data) return [];
    return data as WhatsAppInbox[];
  },

  async enviarDisparo(input) {
    const { data, error } = await invokeFunction<WhatsAppDisparoResultado>(
      'whatsapp-send',
      input as unknown as Record<string, unknown>,
    );
    if (error) throw new Error(error.message);
    if (!data) throw new Error('Resposta vazia da function whatsapp-send');
    return data;
  },

  async listarDisparos(limit = 20) {
    const { data, error } = await supabase
      .from('whatsapp_disparos')
      .select('id, template_name, template_lang, variables, total, enviados, falhas, status, criado_em')
      .order('criado_em', { ascending: false })
      .limit(limit);
    if (error || !data) return [];
    return data as WhatsAppDisparoHistorico[];
  },

  async listarThreads(limit = 50) {
    // Junção embarcada do Postgrest: contato (com lid) + última mensagem.
    const { data, error } = await supabase
      .from('whatsapp_threads')
      .select(`
        id, contato_id, status, origem, nao_lidas, inbox_phone,
        ultima_atividade, ultima_msg_cliente_em,
        whatsapp_contatos!inner ( nome, phone, lid ),
        whatsapp_msgs ( texto, hora )
      `)
      .order('ultima_atividade', { ascending: false })
      .limit(limit);
    if (error || !data) return [];

    return data.map((row: any): WhatsAppThreadReal => {
      const msgs = (row.whatsapp_msgs || []) as Array<{ texto: string; hora: string }>;
      const ultima = msgs.length
        ? msgs.reduce((a, b) => (a.hora > b.hora ? a : b))
        : null;
      return {
        id: row.id,
        contato_id: row.contato_id,
        contato_nome: row.whatsapp_contatos?.nome ?? null,
        contato_phone: row.whatsapp_contatos?.phone ?? '',
        contato_lid: row.whatsapp_contatos?.lid ?? null,
        status: row.status,
        origem: row.origem,
        nao_lidas: row.nao_lidas ?? 0,
        ultima_atividade: row.ultima_atividade,
        ultima_msg_cliente_em: row.ultima_msg_cliente_em,
        ultima_msg_preview: ultima?.texto ?? null,
        inbox_phone: row.inbox_phone ?? null,
      };
    });
  },

  async listarMsgs(threadId: string, limit = 200) {
    const { data, error } = await supabase
      .from('whatsapp_msgs')
      .select('id, thread_id, autor, texto, status, hora, msg_id_externo')
      .eq('thread_id', threadId)
      .order('hora', { ascending: true })
      .limit(limit);
    if (error || !data) return [];
    return data as WhatsAppMsgReal[];
  },

  async listarMsgsPorContato(contatoId: string, limit = 400) {
    return listarMsgsPorContatosImpl([contatoId], limit);
  },

  async listarMsgsPorContatos(contatoIds: string[], limit = 400, inboxPhone?: string | null) {
    return listarMsgsPorContatosImpl(contatoIds, limit, inboxPhone);
  },

  async enviarResposta(threadId: string, texto: string): Promise<ReplyResultado> {
    const { data, error } = await invokeFunction<any>('inbox-reply', {
      thread_id: threadId,
      texto,
    });
    if (error) {
      // Tenta extrair payload de erro retornado pela function
      const ctx = (error as any).context;
      const corpo = ctx?.response ? await (async () => {
        try { return await ctx.response.json(); } catch { return null; }
      })() : null;
      if (corpo?.error === 'fora_da_janela_24h') {
        return { ok: false, fora_da_janela: true, erro: corpo.message };
      }
      return { ok: false, erro: corpo?.detalhe || corpo?.error || error.message };
    }
    if (!data || !data.ok) return { ok: false, erro: 'resposta vazia' };
    return {
      ok: true,
      msg_id: data.msg_id,
      external_id: data.external_id ?? null,
      sem_config: !!data.sem_config,
    };
  },

  async marcarLido(threadId: string) {
    await supabase
      .from('whatsapp_threads')
      .update({ nao_lidas: 0 })
      .eq('id', threadId);
  },

  async marcarLidoContato(contatoId: string) {
    await supabase
      .from('whatsapp_threads')
      .update({ nao_lidas: 0 })
      .eq('contato_id', contatoId);
  },

  async marcarLidoContatos(contatoIds: string[]) {
    if (!contatoIds.length) return;
    await supabase
      .from('whatsapp_threads')
      .update({ nao_lidas: 0 })
      .in('contato_id', contatoIds);
  },

  async listarNumeros(): Promise<WhatsAppNumber[]> {
    const { data, error } = await supabase
      .from('whatsapp_numbers')
      .select('id, rotulo, display_number, provider, phone_number_id, waba_id, zapi_instance_id, ativo, criado_em, atualizado_em')
      .order('criado_em', { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as WhatsAppNumber[];
  },

  async salvarNumero(id: string | null, input: WhatsAppNumberInput): Promise<WhatsAppNumber> {
    const displayNumber = input.display_number.replace(/\D/g, '');
    const payload = {
      rotulo: input.rotulo.trim(),
      display_number: displayNumber,
      provider: input.provider,
      phone_number_id: input.provider === 'meta_official' ? (input.phone_number_id?.trim() || null) : null,
      waba_id: input.provider === 'meta_official' ? (input.waba_id?.trim() || null) : null,
      zapi_instance_id: input.provider === 'zapi' ? (input.zapi_instance_id?.trim() || null) : null,
      ativo: input.ativo ?? true,
    };
    if (id) {
      const { data, error } = await supabase
        .from('whatsapp_numbers')
        .update(payload)
        .eq('id', id)
        .select('id, rotulo, display_number, provider, phone_number_id, waba_id, zapi_instance_id, ativo, criado_em, atualizado_em')
        .single();
      if (error) throw new Error(error.message);
      return data as WhatsAppNumber;
    }
    const { data, error } = await supabase
      .from('whatsapp_numbers')
      .insert(payload)
      .select('id, rotulo, display_number, provider, phone_number_id, waba_id, zapi_instance_id, ativo, criado_em, atualizado_em')
      .single();
    if (error) throw new Error(error.message);
    return data as WhatsAppNumber;
  },

  async removerNumero(id: string) {
    const { error } = await supabase
      .from('whatsapp_numbers')
      .delete()
      .eq('id', id);
    if (error) throw new Error(error.message);
  },

  async listarTemplates(): Promise<WhatsAppTemplate[]> {
    const { data, error } = await supabase
      .from('whatsapp_templates')
      .select('id, name, language, category, components, meta_template_id, status, motivo_rejeicao, criado_em, atualizado_em, sincronizado_em')
      .order('criado_em', { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as WhatsAppTemplate[];
  },

  async criarTemplate(input: WhatsAppTemplateInput): Promise<WhatsAppTemplateCreateResult> {
    const { data, error } = await invokeFunction<WhatsAppTemplateCreateResult & { error?: string; detalhe?: unknown }>(
      'whatsapp-templates',
      { action: 'create', template: input },
    );
    if (error) throw new Error(error.message);
    if (!data) throw new Error('Resposta vazia da function whatsapp-templates');
    if ((data as { error?: string }).error) {
      const det = (data as { detalhe?: { message?: string } }).detalhe;
      throw new Error(det?.message || (data as { error: string }).error);
    }
    return data;
  },

  async removerTemplate(id: string, hard = false): Promise<void> {
    const { error } = await invokeFunction('whatsapp-templates', { action: 'delete', id, hard });
    if (error) throw new Error(error.message);
  },

  async sincronizarTemplates(): Promise<WhatsAppTemplateSyncResult> {
    const { data, error } = await invokeFunction<WhatsAppTemplateSyncResult & { error?: string }>(
      'whatsapp-templates',
      { action: 'sync' },
    );
    if (error) throw new Error(error.message);
    if (!data) throw new Error('Resposta vazia da function whatsapp-templates');
    if ((data as { error?: string }).error) throw new Error((data as { error: string }).error);
    return data;
  },
};

async function listarMsgsPorContatosImpl(
  contatoIds: string[],
  limit: number,
  inboxPhone?: string | null,
): Promise<WhatsAppMsgReal[]> {
  if (!contatoIds.length) return [];
  let q = supabase.from('whatsapp_threads').select('id').in('contato_id', contatoIds);
  if (inboxPhone) q = q.eq('inbox_phone', inboxPhone);
  const { data: threads, error: tErr } = await q;
  if (tErr || !threads || threads.length === 0) return [];
  const threadIds = threads.map((t: { id: string }) => t.id);

  const { data, error } = await supabase
    .from('whatsapp_msgs')
    .select('id, thread_id, autor, texto, status, hora, msg_id_externo')
    .in('thread_id', threadIds)
    .order('hora', { ascending: true })
    .limit(limit);
  if (error || !data) return [];
  return data as WhatsAppMsgReal[];
}
