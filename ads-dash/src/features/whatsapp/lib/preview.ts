// Helpers de apresentação de mensagem/contato — centralizam regras que
// aparecem em Inbox, CRM, Follow-ups e cabeçalhos de thread.
//
// Resolvem três coisas:
//   1. Placeholders crus de mídia ([midia], [audio], [sticker]…) viram
//      rótulos legíveis com ícone.
//   2. Dados pessoais aparecem mascarados nos previews — CPF, CNPJ,
//      e-mail e CEP não devem vazar em listagens (LGPD).
//   3. Nome do contato tem fallback: nome real → telefone formatado →
//      "Contato", nunca string vazia nem o ID cru.

import { formatarPhoneBR } from './phone';

const MIDIA_LABEL: Record<string, string> = {
  midia:   '📷 Mídia',
  imagem:  '📷 Foto',
  foto:    '📷 Foto',
  video:   '🎥 Vídeo',
  audio:   '🎤 Áudio',
  voice:   '🎤 Áudio',
  sticker: '✨ Sticker',
  gif:     '🎞️ GIF',
  arquivo: '📎 Arquivo',
  document: '📎 Documento',
};

const MIDIA_RE = /^\s*\[\s*(midia|imagem|foto|video|audio|voice|sticker|gif|arquivo|document)\s*\]\s*$/i;

const CPF_RE   = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g;
const CNPJ_RE  = /\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g;
const EMAIL_RE = /\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b/g;
const CEP_RE   = /\b\d{5}-?\d{3}\b/g;

/**
 * Converte placeholders de mídia em rótulos amigáveis e aplica máscara
 * em dados pessoais. Use pra qualquer preview em listagem.
 *
 * @param isMe quando `true`, prefixa "Você:" (indicando mensagem enviada
 * pela equipe). Vale pra Inbox e CRM — não aplicar em bubbles do chat.
 */
export function prettyPreview(texto: string | null | undefined, isMe = false): string {
  const base = (texto || '').trim();
  if (!base) return isMe ? 'Você: —' : '—';

  const m = base.match(MIDIA_RE);
  if (m) {
    const label = MIDIA_LABEL[m[1].toLowerCase()] || '📎 Anexo';
    return isMe ? `Você: ${label}` : label;
  }

  const masked = base
    .replace(CPF_RE,   '***.***.***-**')
    .replace(CNPJ_RE,  '**.***.***/****-**')
    .replace(EMAIL_RE, '[e-mail]')
    .replace(CEP_RE,   '[CEP]');

  return isMe ? `Você: ${masked}` : masked;
}

/**
 * Nome visível de um contato. Fallback explícito:
 *   nome → telefone formatado → "Contato".
 * Nunca retorna string vazia nem telefone cru.
 */
export function displayName(
  nome: string | null | undefined,
  phone: string | null | undefined,
): string {
  if (nome && nome.trim()) return nome.trim();
  if (phone) {
    const f = formatarPhoneBR(phone);
    if (f && f !== phone) return f;
    // Phone no formato BR válido: devolve mesmo não normalizado.
    if (/^\d{10,13}$/.test(phone)) return formatarPhoneBR(phone) || phone;
  }
  return 'Contato';
}

/**
 * Checa se um phone está no formato BR válido (12 ou 13 dígitos canônicos).
 * Usado pra excluir LIDs residuais e IDs de automação das listagens.
 */
export function isValidBrPhone(phone: string | null | undefined): boolean {
  const n = (phone || '').replace(/\D/g, '');
  return n.length === 12 || n.length === 13;
}
