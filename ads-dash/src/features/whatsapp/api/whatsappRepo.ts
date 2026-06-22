// Interface pública do repositório `whatsapp`.

import { createRepo } from '@/shared/lib/api/createRepo';
import { mockWhatsAppRepo } from './whatsappRepo.mock';
import { supabaseWhatsAppRepo } from './whatsappRepo.supabase';
import type {
  WhatsAppSummary,
  WhatsAppDisparoInput,
  WhatsAppDisparoResultado,
  WhatsAppDisparoHistorico,
  WhatsAppThreadReal,
  WhatsAppMsgReal,
  ReplyResultado,
} from './types';

export interface WhatsAppRepo {
  getSummary(): Promise<WhatsAppSummary | null>;
  enviarDisparo(input: WhatsAppDisparoInput): Promise<WhatsAppDisparoResultado>;
  listarDisparos(limit?: number): Promise<WhatsAppDisparoHistorico[]>;

  // Inbox em tempo real
  listarThreads(limit?: number): Promise<WhatsAppThreadReal[]>;
  listarMsgs(threadId: string, limit?: number): Promise<WhatsAppMsgReal[]>;
  // Junta msgs de todas as threads de um mesmo contato — usado pra contornar
  // casos em que cada mensagem nova cai numa thread separada.
  listarMsgsPorContato(contatoId: string, limit?: number): Promise<WhatsAppMsgReal[]>;
  enviarResposta(threadId: string, texto: string): Promise<ReplyResultado>;
  marcarLido(threadId: string): Promise<void>;
  marcarLidoContato(contatoId: string): Promise<void>;
}

export const whatsappRepo: WhatsAppRepo = createRepo<WhatsAppRepo>({
  mock: mockWhatsAppRepo,
  supabase: supabaseWhatsAppRepo,
});
