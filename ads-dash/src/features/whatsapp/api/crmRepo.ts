// Repositório do mini-CRM (notas, tags, follow-ups, vendas).
// Sempre real (Supabase); em modo mock, retorna estruturas vazias — a UI
// segue funcionando sem quebrar, mas o CRM só faz sentido com dados reais.

import { createRepo } from '@/shared/lib/api/createRepo';
import { supabaseCrmRepo } from './crmRepo.supabase';
import { mockCrmRepo } from './crmRepo.mock';
import type {
  CrmNota,
  CrmTag,
  CrmFollowup,
  CrmFollowupComContato,
  CrmVenda,
  CrmSummary,
} from './crmTypes';
import type { WhatsAppThreadStatusReal } from './types';

export interface CrmRepo {
  // Notas
  listarNotas(threadId: string): Promise<CrmNota[]>;
  criarNota(threadId: string, texto: string): Promise<CrmNota>;
  removerNota(id: string): Promise<void>;

  // Tags
  listarTags(): Promise<CrmTag[]>;
  criarTag(nome: string, cor?: string): Promise<CrmTag>;
  removerTag(id: string): Promise<void>;
  tagsDaThread(threadId: string): Promise<CrmTag[]>;
  aplicarTag(threadId: string, tagId: string): Promise<void>;
  removerTagDaThread(threadId: string, tagId: string): Promise<void>;

  // Follow-ups
  listarFollowupsPendentes(): Promise<CrmFollowupComContato[]>;
  followupsDaThread(threadId: string): Promise<CrmFollowup[]>;
  criarFollowup(input: { thread_id: string; data: string; motivo?: string | null }): Promise<CrmFollowup>;
  marcarFollowupFeito(id: string): Promise<void>;
  removerFollowup(id: string): Promise<void>;

  // Vendas
  listarVendas(threadId: string): Promise<CrmVenda[]>;
  registrarVenda(input: { thread_id: string; servico: string; valor_cents: number; data?: string; observacao?: string | null }): Promise<CrmVenda>;
  removerVenda(id: string): Promise<void>;

  // Status kanban
  setStatus(threadId: string, status: WhatsAppThreadStatusReal): Promise<void>;

  // Resumo
  getSummary(range?: { from: Date; to: Date } | null): Promise<CrmSummary>;
}

export const crmRepo: CrmRepo = createRepo<CrmRepo>({
  mock: mockCrmRepo,
  supabase: supabaseCrmRepo,
});
