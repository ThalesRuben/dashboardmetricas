// Interface pública do repositório `whatsapp`.

import { createRepo } from '@/shared/lib/api/createRepo';
import { mockWhatsAppRepo } from './whatsappRepo.mock';
import { supabaseWhatsAppRepo } from './whatsappRepo.supabase';
import type {
  WhatsAppSummary,
  WhatsAppDisparoInput,
  WhatsAppDisparoResultado,
  WhatsAppDisparoHistorico,
} from './types';

export interface WhatsAppRepo {
  getSummary(): Promise<WhatsAppSummary | null>;
  enviarDisparo(input: WhatsAppDisparoInput): Promise<WhatsAppDisparoResultado>;
  listarDisparos(limit?: number): Promise<WhatsAppDisparoHistorico[]>;
}

export const whatsappRepo: WhatsAppRepo = createRepo<WhatsAppRepo>({
  mock: mockWhatsAppRepo,
  supabase: supabaseWhatsAppRepo,
});
