// Supabase Edge Function — inbox-reply
//
// Envia uma resposta de atendente em uma thread existente, via Z-API.
// Z-API roda via WhatsApp Web, então NÃO existe janela de 24h nem
// restrição de free-form (mensagem é sempre texto livre).
//
// Variáveis de ambiente:
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//   ZAPI_INSTANCE_ID
//   ZAPI_TOKEN
//   ZAPI_CLIENT_TOKEN        (Account Security Token — header Client-Token)
//   ZAPI_INSTANCE_TOKENS     JSON { "instance_id": "token" } para outras linhas
//   INTERNAL_API_KEY          opcional
//
// Deploy:
//   supabase functions deploy inbox-reply --no-verify-jwt
//
// Body:
//   { "thread_id": "uuid", "texto": "Oi!" }
//   { "thread_id": "uuid", "validate_only": true } — confere a linha sem enviar

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { resolveZapiSender, sendZapiText, SenderError, type ZapiSender } from '../_shared/zapi-sender.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const INTERNAL_KEY      = Deno.env.get('INTERNAL_API_KEY')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-internal-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface ReplyBody { thread_id: string; texto?: string; validate_only?: boolean }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  if (INTERNAL_KEY && req.headers.get('x-internal-key') !== INTERNAL_KEY) {
    return json({ error: 'unauthorized' }, 401)
  }

  let body: ReplyBody
  try {
    body = await req.json()
  } catch {
    return json({ error: 'JSON inválido' }, 400)
  }
  const validateOnly = body?.validate_only === true
  if (!body || typeof body.thread_id !== 'string' || !body.thread_id ||
      (!validateOnly && (typeof body.texto !== 'string' || !body.texto.trim()))) {
    return json({ error: 'thread_id e texto obrigatórios' }, 400)
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

  // Buscar thread + telefone do contato
  const { data: thread, error: thErr } = await supabase
    .from('whatsapp_threads')
    .select('id, tenant_id, contato_id, inbox_phone')
    .eq('id', body.thread_id)
    .single()
  if (thErr || !thread) return json({ error: 'thread não encontrada' }, 404)

  const { data: contato, error: coErr } = await supabase
    .from('whatsapp_contatos')
    .select('phone')
    .eq('id', thread.contato_id)
    .single()
  if (coErr || !contato) return json({ error: 'contato não encontrado' }, 404)

  let sender: ZapiSender
  try {
    sender = await resolveZapiSender(supabase, thread.tenant_id, thread.inbox_phone)
  } catch (e) {
    return json({ error: 'remetente_indisponivel', detalhe: e instanceof Error ? e.message : 'Falha ao verificar remetente.' },
      e instanceof SenderError ? e.status : 503)
  }

  if (validateOnly) return json({ ok: true, validation_only: true, inbox_phone: sender.inboxPhone })

  let externalId: string | null = null
  let erro: string | null = null

  try {
    externalId = await sendZapiText(sender, contato.phone, body.texto)
  } catch (e) {
    erro = e instanceof Error ? e.message : String(e)
  }

  // Grava a tentativa real; configuração inválida nunca simula sucesso.
  const { data: msg, error: msgErr } = await supabase
    .from('whatsapp_msgs')
    .insert({
      tenant_id: thread.tenant_id,
      thread_id: thread.id,
      autor: 'atendente',
      texto: body.texto,
      msg_id_externo: externalId,
      status: erro ? 'erro' : 'enviada',
      metadata: { inbox_phone: sender.inboxPhone, zapi_instance_id: sender.instanceId, ...(erro ? { erro } : {}) },
      hora: new Date().toISOString(),
    })
    .select('id')
    .single()
  if (msgErr || !msg) {
    return json({ error: 'falha ao gravar msg: ' + (msgErr?.message || '') }, 500)
  }

  if (erro) return json({ error: 'envio_falhou', detalhe: erro, msg_id: msg.id }, 502)

  await supabase
    .from('whatsapp_threads')
    .update({ ultima_atividade: new Date().toISOString(), nao_lidas: 0 })
    .eq('id', thread.id)

  return json({
    ok: true,
    msg_id: msg.id,
    external_id: externalId,
    sem_config: false,
    inbox_phone: sender.inboxPhone,
  })
})

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
