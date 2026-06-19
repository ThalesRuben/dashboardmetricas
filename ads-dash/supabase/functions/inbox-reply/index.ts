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
//   INTERNAL_API_KEY          opcional
//
// Deploy:
//   supabase functions deploy inbox-reply --no-verify-jwt
//
// Body:
//   { "thread_id": "uuid", "texto": "Oi!" }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ZAPI_INSTANCE     = Deno.env.get('ZAPI_INSTANCE_ID')
const ZAPI_TOKEN        = Deno.env.get('ZAPI_TOKEN')
const ZAPI_CLIENT_TOKEN = Deno.env.get('ZAPI_CLIENT_TOKEN')
const INTERNAL_KEY      = Deno.env.get('INTERNAL_API_KEY')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-internal-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface ReplyBody { thread_id: string; texto: string }

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
  if (!body.thread_id || !body.texto) {
    return json({ error: 'thread_id e texto obrigatórios' }, 400)
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

  // Buscar thread + telefone do contato
  const { data: thread, error: thErr } = await supabase
    .from('whatsapp_threads')
    .select('id, tenant_id, contato_id')
    .eq('id', body.thread_id)
    .single()
  if (thErr || !thread) return json({ error: 'thread não encontrada' }, 404)

  const { data: contato, error: coErr } = await supabase
    .from('whatsapp_contatos')
    .select('phone')
    .eq('id', thread.contato_id)
    .single()
  if (coErr || !contato) return json({ error: 'contato não encontrado' }, 404)

  const semConfig = !ZAPI_INSTANCE || !ZAPI_TOKEN || !ZAPI_CLIENT_TOKEN

  let externalId: string | null = null
  let erro: string | null = null

  if (!semConfig) {
    try {
      externalId = await zapiSendText(contato.phone, body.texto)
    } catch (e) {
      erro = e instanceof Error ? e.message : String(e)
    }
  }

  // Grava msg sempre (mesmo em simulação ou erro).
  const { data: msg, error: msgErr } = await supabase
    .from('whatsapp_msgs')
    .insert({
      tenant_id: thread.tenant_id,
      thread_id: thread.id,
      autor: 'atendente',
      texto: body.texto,
      msg_id_externo: externalId,
      status: erro ? 'erro' : 'enviada',
      metadata: erro ? { erro } : (semConfig ? { simulacao: true } : {}),
      hora: new Date().toISOString(),
    })
    .select('id')
    .single()
  if (msgErr || !msg) {
    return json({ error: 'falha ao gravar msg: ' + (msgErr?.message || '') }, 500)
  }

  await supabase
    .from('whatsapp_threads')
    .update({ ultima_atividade: new Date().toISOString(), nao_lidas: 0 })
    .eq('id', thread.id)

  if (erro) return json({ error: 'envio_falhou', detalhe: erro, msg_id: msg.id }, 502)

  return json({
    ok: true,
    msg_id: msg.id,
    external_id: externalId,
    sem_config: semConfig,
  })
})

async function zapiSendText(phone: string, message: string): Promise<string> {
  const url = `https://api.z-api.io/instances/${ZAPI_INSTANCE}/token/${ZAPI_TOKEN}/send-text`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Client-Token': ZAPI_CLIENT_TOKEN!,
    },
    body: JSON.stringify({
      phone: phone.replace(/\D/g, ''),
      message,
    }),
  })
  const out = await res.json().catch(() => ({}))
  if (!res.ok || out.error) {
    throw new Error(`Z-API ${res.status}: ${out.error || out.message || JSON.stringify(out)}`)
  }
  return out.messageId || out.zaapId || out.id || 'sent'
}

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
