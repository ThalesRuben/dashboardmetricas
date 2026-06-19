// Tipos públicos da feature `whatsapp`.

export interface WhatsAppResumo {
  conversas: number;
  conversas_delta: number;
  leads: number;
  leads_delta: number;
  agendamentos: number;
  agendamentos_delta: number;
  taxa_resposta: number;
  tempo_resposta_min: number;
  taxa_conversao: number;
  ticket_medio: number;
}

export interface WhatsAppFunilEtapa {
  etapa: string;
  valor: number;
}

export interface WhatsAppSeriePoint {
  date: string;
  value: number;
}

export type WhatsAppMotivoTag = 'quente' | 'morno' | 'frio';

export interface WhatsAppMotivo {
  motivo: string;
  total: number;
  pct: number;
  tag: WhatsAppMotivoTag;
}

export interface WhatsAppOrigem {
  origem: string;
  conversas: number;
  pct: number;
}

export type WhatsAppConversaStatus = 'lead' | 'aberta' | 'agendado' | 'venda';

export type WhatsAppMensagemAutor = 'cliente' | 'atendente';

export interface WhatsAppMensagem {
  autor: WhatsAppMensagemAutor;
  texto: string;
  hora: string;
}

export interface WhatsAppConversa {
  id?: string;
  nome: string;
  resumo: string;
  status: WhatsAppConversaStatus;
  hora: string;
  origem: string;
  telefone?: string;
  nao_lidas?: number;
  mensagens?: WhatsAppMensagem[];
}

export interface WhatsAppSummary {
  resumo: WhatsAppResumo;
  funil: WhatsAppFunilEtapa[];
  serie_conversas: WhatsAppSeriePoint[];
  serie_conversao: WhatsAppSeriePoint[];
  motivos: WhatsAppMotivo[];
  origens: WhatsAppOrigem[];
  conversas_recentes: WhatsAppConversa[];
}

export interface WhatsAppDisparoRecipient {
  phone: string;
  params?: string[];
}

export interface WhatsAppDisparoInput {
  template_name: string;
  language?: string;
  variables?: string[];
  recipients: WhatsAppDisparoRecipient[];
  dry_run?: boolean;
}

export interface WhatsAppDisparoResultadoItem {
  phone: string;
  ok: boolean;
  id?: string;
  error?: string;
}

export interface WhatsAppDisparoResultado {
  message: string;
  dry_run: boolean;
  sem_config: boolean;
  total: number;
  enviados: number;
  falhas: number;
  resultados: WhatsAppDisparoResultadoItem[];
}

export interface WhatsAppDisparoHistorico {
  id: string;
  template_name: string;
  template_lang: string;
  variables: string[];
  total: number;
  enviados: number;
  falhas: number;
  status: 'em_andamento' | 'concluido' | 'erro';
  criado_em: string;
}
