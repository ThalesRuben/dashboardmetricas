// Tipos públicos da feature `whatsapp`.

export interface WhatsAppResumo {
  conversas: number;
  conversas_delta: number;
  leads: number;
  leads_delta: number;
  agendamentos: number;
  agendamentos_delta: number;
  taxa_resposta: number;
  // Tempo até PRIMEIRA resposta do atendente em threads criadas no período (mediana).
  tempo_resposta_min: number;
  pct_sla_resposta: number;
  // Tempo médio POR TURNO — mediana entre cada msg do cliente e a próxima
  // resposta do atendente na mesma thread. Detecta "some no meio da conversa".
  tempo_resposta_turno_min: number;
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
  rotulo: string;       // identificador interno do disparo (aparece no histórico)
  mensagem: string;     // texto livre; aceita {{1}}, {{2}}, ... como placeholders
  variables?: string[]; // valores default usados quando recipient não tem params
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

// ============================================================
// Inbox em tempo real (tabelas whatsapp_contatos/threads/msgs)
// ============================================================

export type WhatsAppThreadStatusReal =
  | 'lead'
  | 'aberta'
  | 'agendado'
  | 'venda'
  | 'arquivada';

export type WhatsAppMsgStatus = 'enviada' | 'entregue' | 'lida' | 'erro';

export interface WhatsAppMsgReal {
  id: string;
  thread_id: string;
  autor: WhatsAppMensagemAutor;
  texto: string;
  status: WhatsAppMsgStatus;
  hora: string; // ISO
  msg_id_externo: string | null;
}

export interface WhatsAppThreadReal {
  id: string;
  contato_id: string;
  contato_nome: string | null;
  contato_phone: string;
  contato_lid: string | null;          // LID do contato (null = nunca viu LID). Permite distinguir real de provisional.
  status: WhatsAppThreadStatusReal;
  origem: string;
  nao_lidas: number;
  ultima_atividade: string;            // ISO
  ultima_msg_cliente_em: string | null; // ISO
  ultima_msg_preview: string | null;
  inbox_phone: string | null;          // canônico 55DDXXXXXXXXX. NULL = thread legada.
}

export interface WhatsAppInbox {
  inbox_phone: string;
  threads: number;
  ultima_atividade: string;
}

export interface ReplyResultado {
  ok: boolean;
  msg_id?: string;
  external_id?: string | null;
  sem_config?: boolean;
  fora_da_janela?: boolean;
  erro?: string;
}

// ============================================================
// Cadastro de números WhatsApp (tabela whatsapp_numbers)
// ============================================================

export type WhatsAppProvider = 'zapi' | 'meta_official';

export interface WhatsAppNumber {
  id: string;
  rotulo: string;
  display_number: string;   // E.164 sem "+", ex: 5531990842381
  provider: WhatsAppProvider;
  phone_number_id: string | null;
  waba_id: string | null;
  zapi_instance_id: string | null;
  ativo: boolean;
  criado_em: string;        // ISO
  atualizado_em: string;    // ISO
}

// Payload de criação/edição. Só os campos do provider selecionado precisam vir.
export interface WhatsAppNumberInput {
  rotulo: string;
  display_number: string;
  provider: WhatsAppProvider;
  phone_number_id?: string | null;
  waba_id?: string | null;
  zapi_instance_id?: string | null;
  ativo?: boolean;
}

// ============================================================
// Templates HSM (Meta Cloud API) — tabela whatsapp_templates
// ============================================================

export type WhatsAppTemplateCategory = 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';

export type WhatsAppTemplateStatus =
  | 'draft' | 'pending' | 'approved' | 'rejected' | 'paused' | 'disabled';

// Componente no formato aceito pela Graph API.
// (Simplificado — expande conforme suportar mais tipos na UI.)
export type WhatsAppTemplateComponent =
  | { type: 'BODY'; text: string; example?: { body_text: string[][] } }
  | { type: 'HEADER'; format: 'TEXT'; text: string; example?: { header_text: string[] } }
  | { type: 'HEADER'; format: 'IMAGE' | 'VIDEO' | 'DOCUMENT'; example?: { header_handle: string[] } }
  | { type: 'FOOTER'; text: string }
  | {
      type: 'BUTTONS';
      buttons: Array<
        | { type: 'QUICK_REPLY'; text: string }
        | { type: 'URL'; text: string; url: string }
        | { type: 'PHONE_NUMBER'; text: string; phone_number: string }
      >;
    };

export interface WhatsAppTemplate {
  id: string;
  name: string;                                  // slug [a-z0-9_]
  language: string;                              // ex: pt_BR
  category: WhatsAppTemplateCategory;
  components: WhatsAppTemplateComponent[];
  meta_template_id: string | null;
  status: WhatsAppTemplateStatus;
  motivo_rejeicao: string | null;
  criado_em: string;
  atualizado_em: string;
  sincronizado_em: string | null;
}

export interface WhatsAppTemplateInput {
  name: string;
  language: string;
  category: WhatsAppTemplateCategory;
  components: WhatsAppTemplateComponent[];
}

export interface WhatsAppTemplateCreateResult {
  id: string;
  status: WhatsAppTemplateStatus;
  meta_template_id?: string;
  message: string;
  sem_config?: boolean;
}

export interface WhatsAppTemplateSyncResult {
  templates_remotos: number;
  atualizados_localmente: number;
}
