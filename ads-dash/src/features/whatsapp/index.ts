// API pública da feature `whatsapp`.
export { useWhatsAppMetrics } from './hooks/useWhatsAppMetrics';
export { useWhatsAppDisparos } from './hooks/useWhatsAppDisparos';
export { default as Inbox } from './components/Inbox';
export { default as DisparoMassa } from './components/DisparoMassa';
export { whatsappRepo } from './api/whatsappRepo';
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
} from './api/types';
