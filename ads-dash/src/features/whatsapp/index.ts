// API pública da feature `whatsapp`.
export { useWhatsAppMetrics } from './hooks/useWhatsAppMetrics';
export { useWhatsAppDisparos } from './hooks/useWhatsAppDisparos';
export { useWhatsAppInboxes } from './hooks/useWhatsAppInboxes';
export { useWhatsAppNumbers } from './hooks/useWhatsAppNumbers';
export { useWhatsAppTemplates } from './hooks/useWhatsAppTemplates';
export { useInbox } from './hooks/useInbox';
export { default as Inbox } from './components/Inbox';
export { default as DisparoMassa } from './components/DisparoMassa';
export { default as InboxReportCard } from './components/InboxReportCard';
export { default as CrmKanban } from './components/CrmKanban';
export { default as CrmThreadDrawer } from './components/CrmThreadDrawer';
export { default as FollowupsFila } from './components/FollowupsFila';
export { default as NumerosPanel } from './components/NumerosPanel';
export { default as TemplatesPanel } from './components/TemplatesPanel';
export {
  useCrmNotas,
  useCrmTags,
  useCrmFollowups,
  useCrmVendas,
  useCrmSummary,
  useFollowupsPendentes,
  useSetThreadStatus,
} from './hooks/useCrm';
export type {
  CrmNota,
  CrmTag,
  CrmFollowup,
  CrmFollowupComContato,
  CrmVenda,
  CrmSummary,
} from './api/crmTypes';
export type { CrmCardExtras } from './components/CrmKanban';
export { whatsappRepo } from './api/whatsappRepo';
export { crmRepo } from './api/crmRepo';
export type {
  WhatsAppResumo,
  WhatsAppFunilEtapa,
  WhatsAppSeriePoint,
  WhatsAppMotivo,
  WhatsAppMotivoTag,
  WhatsAppOrigem,
  WhatsAppConversa,
  WhatsAppConversaStatus,
  WhatsAppMensagem,
  WhatsAppMensagemAutor,
  WhatsAppSummary,
  WhatsAppDisparoInput,
  WhatsAppDisparoResultado,
  WhatsAppDisparoResultadoItem,
  WhatsAppDisparoHistorico,
  WhatsAppDisparoRecipient,
  WhatsAppThreadReal,
  WhatsAppThreadStatusReal,
  WhatsAppMsgReal,
  WhatsAppMsgStatus,
  WhatsAppInbox,
  WhatsAppNumber,
  WhatsAppNumberInput,
  WhatsAppProvider,
  WhatsAppTemplate,
  WhatsAppTemplateInput,
  WhatsAppTemplateStatus,
  WhatsAppTemplateCategory,
  WhatsAppTemplateComponent,
  WhatsAppTemplateCreateResult,
  WhatsAppTemplateSyncResult,
  ReplyResultado,
} from './api/types';
export { formatarPhoneBR, normalizarPhoneBR } from './lib/phone';
export { prettyPreview, displayName, isValidBrPhone } from './lib/preview';
