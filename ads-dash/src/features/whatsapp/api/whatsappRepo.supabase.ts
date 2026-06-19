// Implementação Supabase — payload mais recente da tabela whatsapp_metrics
// é mesclado sobre o mock para preencher lacunas.

import { supabase, invokeFunction } from '@/shared/lib/supabase';
import type { WhatsAppRepo } from './whatsappRepo';
import type { WhatsAppDisparoResultado, WhatsAppDisparoHistorico } from './types';
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
};
