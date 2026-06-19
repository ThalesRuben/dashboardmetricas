// Implementação Supabase — payload mais recente da tabela whatsapp_metrics
// é mesclado sobre o mock para preencher lacunas.

import { supabase, invokeFunction } from '@/shared/lib/supabase';
import type { WhatsAppRepo } from './whatsappRepo';
import type {
  WhatsAppDisparoResultado,
  WhatsAppDisparoHistorico,
  WhatsAppThreadReal,
  WhatsAppMsgReal,
  ReplyResultado,
} from './types';
import { MOCK_WHATSAPP } from './whatsappRepo.mock';

export const supabaseWhatsAppRepo: WhatsAppRepo = {
  async getSummary() {
    const { data, error } = await supabase
      .from('whatsapp_metrics')
      .select('*')
      .order('date', { ascending: false })
      .limit(1);
    if (error || !data?.length) return null;
    return { ...MOCK_WHATSAPP, ...data[0].payload };
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
    // Junção embarcada do Postgrest: contato + última mensagem.
    const { data, error } = await supabase
      .from('whatsapp_threads')
      .select(`
        id, contato_id, status, origem, nao_lidas,
        ultima_atividade, ultima_msg_cliente_em,
        whatsapp_contatos!inner ( nome, phone ),
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
        status: row.status,
        origem: row.origem,
        nao_lidas: row.nao_lidas ?? 0,
        ultima_atividade: row.ultima_atividade,
        ultima_msg_cliente_em: row.ultima_msg_cliente_em,
        ultima_msg_preview: ultima?.texto ?? null,
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
};
