// API pública da feature `whatsapp`.
export { useWhatsAppMetrics } from './hooks/useWhatsAppMetrics';
export { default as Inbox } from './components/Inbox';
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
} from './api/types';
