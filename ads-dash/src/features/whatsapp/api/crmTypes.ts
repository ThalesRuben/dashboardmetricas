// Tipos do mini-CRM sobre whatsapp_threads.

export interface CrmNota {
  id: string;
  thread_id: string;
  autor_id: string | null;
  texto: string;
  criado_em: string;
}

export interface CrmTag {
  id: string;
  nome: string;
  cor: string;
}

export interface CrmFollowup {
  id: string;
  thread_id: string;
  responsavel_id: string | null;
  data: string;            // ISO
  motivo: string | null;
  feito: boolean;
  feito_em: string | null;
  criado_em: string;
}

export interface CrmVenda {
  id: string;
  thread_id: string;
  registrado_por: string | null;
  servico: string;
  valor_cents: number;
  data: string;            // YYYY-MM-DD
  observacao: string | null;
  criado_em: string;
}

export interface CrmSummary {
  leads: number;
  em_atendimento: number;
  agendados: number;
  vendas_qtd: number;
  vendas_valor_cents: number;
  ticket_medio_cents: number;
  followups_pendentes: number;
  followups_atrasados: number;
}

// Follow-up + dados do contato/thread pra fila unificada.
export interface CrmFollowupComContato extends CrmFollowup {
  contato_nome: string | null;
  contato_phone: string;
  thread_status: string;
}
