// Implementação Supabase — payload mais recente da tabela whatsapp_metrics
// é mesclado sobre o mock para preencher lacunas.

import { supabase } from '@/shared/lib/supabase';
import type { WhatsAppRepo } from './whatsappRepo';
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
};
