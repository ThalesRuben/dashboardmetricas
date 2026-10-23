// Supabase Edge Function — inbox-ingest (v3, thin RPC wrapper)
//
// A versão anterior (v2) fazia 7-9 chamadas sequenciais ao banco por
// mensagem, somando ~2s em dias calmos e >10s em pico. Em 2026-10-23
// o operador diagnosticou que o custo era de rede (round trips Edge→DB),
// não de queries. Esta v3 delega tudo pro RPC `ingest_whatsapp_msg`
// (migration 0051): 1 roundtrip, lógica inteira em plpgsql, atomic.
//
// Variáveis de ambiente:
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//   INTERNAL_API_KEY             n8n manda em x-internal-key
//
// Body esperado (passa direto pro RPC, sem reformatar):
//   {
//     "phone":           "5531988887777" | "704508911666@lid",
//     "nome":            "Marina Alves" | null,
//     "texto":           "Oi, queria agendar",
//     "msg_id":          "wamid.HBgN..." | "3EB0...",
//     "hora":            "2026-10-23T14:32:00Z",
//     "direction":       "in" | "out",
//     "origem":          "whatsapp",
//     "tenant_slug":     "the-blonde-concept",
//     "inbox_phone":     "5531990842381",
//     "connected_phone": aliases do Z-API
//     "connectedPhone":  idem
//     "chat_lid":        "704508911666@lid"
//     "chatLid":         idem
//   }
//
// Resposta: 200 { ok, deduped?, contato_id, thread_id, msg_id } ou
//           400 { error, ignored: true } pra payload inválido ou
//           500 { error } pra erro de infra.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL  = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const INTERNAL_KEY  = Deno.env.get('INTERNAL_API_KEY')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-internal-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  if (!INTERNAL_KEY || req.headers.get('x-internal-key') !== INTERNAL_KEY) {
    return json({ error: 'unauthorized' }, 401)
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return json({ error: 'JSON inválido' }, 400)
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY)
  const t0 = Date.now()
  const { data, error } = await supabase.rpc('ingest_whatsapp_msg', { p_body: body })
  const elapsed_ms = Date.now() - t0

  if (error) {
    console.log(JSON.stringify({ tag: 'ingest-rpc-error', elapsed_ms, msg: error.message }))
    return json({ error: error.message }, 500)
  }

  // Log mínimo pra manter observabilidade na view de Edge Logs — `raise
  // notice` da RPC só vai pro log do Postgres (acessível mas separado).
  // Payload do result é pequeno e sem PII (só UUIDs).
  const result = (data ?? {}) as Record<string, unknown>
  if (result.error) {
    console.log(JSON.stringify({ tag: 'ingest-reject', elapsed_ms, result }))
    const status = result.ignored ? 400 : 500
    return json(result, status)
  }
  console.log(JSON.stringify({
    tag: result.deduped ? 'ingest-dedup' : 'ingest-ok',
    elapsed_ms,
    thread_id: result.thread_id,
    contato_id: result.contato_id,
  }))
  return json(result, 200)
})

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
