import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

export class SenderError extends Error {
  constructor(message: string, public status = 409) { super(message) }
}

export interface ZapiSender {
  inboxPhone: string
  instanceId: string
  token: string
  clientToken: string
}

// Mesmas regras BR do inbox: aceita formatação e a variante sem o nono dígito.
function normalizePhone(raw: unknown): string {
  if (typeof raw !== 'string' || !/^[+\d\s().-]+$/.test(raw)) return ''
  let phone = raw.replace(/\D/g, '')
  if (phone.length >= 11 && phone.startsWith('0')) phone = phone.slice(1)
  if (phone.length === 10 || phone.length === 11) phone = '55' + phone
  if (phone.length === 12 && phone.startsWith('55')) phone = phone.slice(0, 4) + '9' + phone.slice(4)
  return /^55\d{11}$/.test(phone) ? phone : ''
}

export async function resolveZapiSender(
  supabase: SupabaseClient, tenantId: string, inboxPhone: string | null,
): Promise<ZapiSender> {
  const phone = normalizePhone(inboxPhone)
  if (!tenantId || !phone) {
    throw new SenderError('Número de atendimento não identificado. Selecione uma linha ou corrija o vínculo da conversa.', 400)
  }

  const { data: numbers, error } = await supabase.from('whatsapp_numbers')
    .select('display_number, provider, zapi_instance_id, ativo')
    .eq('tenant_id', tenantId)
  if (error) throw new SenderError('Não foi possível consultar os números de atendimento. Tente novamente.', 503)

  const matches = (numbers ?? []).filter(n => normalizePhone(n.display_number) === phone)
  if (matches.length > 1) throw new SenderError('Há cadastros duplicados para esta linha. Revise a aba Números.')
  const number = matches[0]
  if (number && !number.ativo) throw new SenderError('O número de atendimento está inativo. Revise a aba Números.')
  if (number && number.provider !== 'zapi') {
    throw new SenderError('Esta linha não está configurada para envio de texto pela Z-API. Revise a aba Números.')
  }

  const globalInstance = Deno.env.get('ZAPI_INSTANCE_ID')?.trim()
  const instanceId = number ? number.zapi_instance_id?.trim() : globalInstance
  if (!instanceId) throw new SenderError('Configure a instância desta linha na aba Números.')

  // O token global só pode ser usado para a própria instância global.
  // Outras instâncias têm seus tokens no secret JSON ZAPI_INSTANCE_TOKENS.
  let tokens: Record<string, unknown> = {}
  const rawTokens = Deno.env.get('ZAPI_INSTANCE_TOKENS')
  if (rawTokens) {
    try {
      const parsed = JSON.parse(rawTokens)
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error()
      tokens = parsed
    } catch {
      throw new SenderError('A configuração dos tokens por linha é inválida. Solicite a revisão da integração.', 503)
    }
  }
  const mappedToken = Object.hasOwn(tokens, instanceId) ? tokens[instanceId] : undefined
  const token = typeof mappedToken === 'string' ? mappedToken.trim()
    : instanceId === globalInstance ? Deno.env.get('ZAPI_TOKEN')?.trim() : undefined
  const clientToken = Deno.env.get('ZAPI_CLIENT_TOKEN')?.trim()
  if (!token || !clientToken) {
    throw new SenderError('Credenciais de envio ausentes para esta linha. Solicite a configuração da integração.', 503)
  }

  const sender = { inboxPhone: phone, instanceId, token, clientToken }
  // Confere o telefone real: cadastro errado ou QR reconectado em outra linha
  // jamais pode enviar pelo número de outra pessoa.
  let device: { phone?: string; error?: unknown }
  try {
    const response = await fetch(zapiUrl(sender, 'device'), {
      headers: { 'Client-Token': clientToken },
      signal: AbortSignal.timeout(10000),
    })
    if (!response.ok) throw new Error()
    device = await response.json()
    if (!device || device.error) throw new Error()
  } catch {
    // Não retorna URLs de fetch, pois contêm o token da instância.
    throw new SenderError('Não foi possível verificar a linha conectada à Z-API. Verifique a conexão e tente novamente.', 503)
  }
  if (normalizePhone(device.phone) !== phone) {
    throw new SenderError('Envio bloqueado: o telefone conectado à Z-API não corresponde ao número de atendimento. Revise a conexão da linha.')
  }
  return sender
}

function zapiUrl(sender: ZapiSender, method: string): string {
  return `https://api.z-api.io/instances/${encodeURIComponent(sender.instanceId)}/token/${encodeURIComponent(sender.token)}/${method}`
}

export async function sendZapiText(sender: ZapiSender, phone: string, message: string): Promise<string> {
  let response: Response
  try {
    response = await fetch(zapiUrl(sender, 'send-text'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Client-Token': sender.clientToken },
      body: JSON.stringify({ phone: phone.replace(/\D/g, ''), message }),
      signal: AbortSignal.timeout(20000),
    })
  } catch {
    throw new Error('Falha de conexão com a Z-API. Verifique o WhatsApp antes de tentar novamente.')
  }
  const out = await response.json().catch(() => null)
  if (!response.ok || !out || out.error) throw new Error(`Z-API ${response.status}: envio não confirmado.`)
  const id = out.messageId || out.zaapId || out.id
  if (typeof id !== 'string' || !id) throw new Error('A Z-API não confirmou o identificador da mensagem.')
  return id
}
