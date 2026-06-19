// Supabase Edge Function — inbox-reply
//
// Envia uma resposta de atendente em uma thread existente, via Cloud API.
// - Valida janela de 24h (free-form só permitido nesse intervalo).
// - Grava a mensagem no banco e retorna o id.
//
// Variáveis de ambiente:
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//   WHATSAPP_TOKEN
//   WHATSAPP_PHONE_NUMBER_ID
//   INTERNAL_API_KEY            opcional
//
// Deploy:
//   supabase functions deploy inbox-reply --no-verify-jwt
//
// Body:
//   { "thread_id": "uuid", "texto": "Oi!" }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL  = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const WA_TOKEN      = Deno.env.get('WHATSAPP_TOKEN')
const WA_PHONE_ID   = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID')
const INTERNAL_KEY  = Deno.env.get('INTERNAL_API_KEY')

const GRAPH = 'https://graph.facebook.com/v19.0'
const JANELA_MS = 24 * 60 * 60 * 1000

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
    .select('id, tenant_id, contato_id, ultima_msg_cliente_em')
    .eq('id', body.thread_id)
    .single()
  if (thErr || !thread) return json({ error: 'thread não encontrada' }, 404)

  const { data: contato, error: coErr } = await supabase
    .from('whatsapp_contatos')
    .select('phone')
    .eq('id', thread.contato_id)
    .single()
  if (coErr || !contato) return json({ error: 'contato não encontrado' }, 404)

  // Validar janela 24h
  const janelaAberta = thread.ultima_msg_cliente_em
    && (Date.now() - new Date(thread.ultima_msg_cliente_em).getTime()) < JANELA_MS

  if (!janelaAberta) {
    return json({
      error: 'fora_da_janela_24h',
      message:
        'Janela de 24h fechada — Cloud API só permite texto livre dentro de 24h da última msg do cliente. '
        + 'Use a aba "Disparo em massa" com um template HSM aprovado pra reabrir a conversa.',
    }, 409)
  }

  const semConfig = !WA_TOKEN || !WA_PHONE_ID

  let externalId: string | null = null
  let erro: string | null = null

  if (!semConfig) {
    try {
      externalId = await enviarTexto(contato.phone, body.texto)
    } catch (e) {
      erro = e instanceof Error ? e.message : String(e)
    }
  }

  // Grava msg sempre (em simulação ou real). Se houve erro, marca status=erro.
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

  // Atualizar ultima_atividade e zerar nao_lidas
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

async function enviarTexto(to: string, texto: string): Promise<string> {
  const payload = {
    messaging_product: 'whatsapp',
    to: to.replace(/\D/g, ''),
    type: 'text',
    text: { body: texto, preview_url: false },
  }
  const res = await fetch(`${GRAPH}/${WA_PHONE_ID}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${WA_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
  const out = await res.json()
  if (!res.ok || out.error) {
    throw new Error(`Graph API ${res.status}: ${out.error?.message || JSON.stringify(out)}`)
  }
  return out.messages?.[0]?.id || 'sent'
}

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
