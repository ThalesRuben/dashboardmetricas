// Supabase Edge Function — inbox-ingest
//
// Recebe mensagens vindas do n8n (que escuta o webhook do WhatsApp Cloud API),
// faz upsert do contato/thread e grava a mensagem.
//
// Variáveis de ambiente:
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//   INTERNAL_API_KEY              obrigatória — n8n manda no header x-internal-key
//   DEFAULT_TENANT_SLUG           opcional, default 'the-blonde-concept'
//
// Deploy:
//   supabase functions deploy inbox-ingest --no-verify-jwt
//
// Body esperado:
//   {
//     "phone": "5511984321100",
//     "nome": "Marina Alves",          // opcional
//     "texto": "Oi, queria agendar",
//     "msg_id": "wamid.HBgN...",       // id externo p/ dedup
//     "hora": "2026-06-19T14:32:00Z",  // ISO, opcional (default now)
//     "direction": "in",                // "in" cliente / "out" atendente
//     "origem": "whatsapp",            // opcional
//     "tenant_slug": "the-blonde-concept"  // opcional (override do default)
//   }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL  = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const INTERNAL_KEY  = Deno.env.get('INTERNAL_API_KEY')
const DEFAULT_TENANT_SLUG = Deno.env.get('DEFAULT_TENANT_SLUG') || 'the-blonde-concept'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-internal-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface IngestBody {
  phone: string
  nome?: string
  texto: string
  msg_id?: string
  hora?: string
  direction?: 'in' | 'out'
  origem?: string
  tenant_slug?: string
}

// Normaliza telefone BR pra formato canônico `55DDXXXXXXXXX` (13 dígitos).
// Sem isso, o n8n entrega o mesmo cliente em variantes (com/sem o "9" do
// celular, com/sem DDI, com formatação) e o upsert por (tenant_id, phone)
// cria um contato novo a cada variação, espalhando as msgs por threads
// que nunca se encontram. Espelha src/features/whatsapp/lib/phone.ts.
function normalizarPhoneBR(raw: string): string {
  let n = (raw || '').replace(/\D/g, '')
  if (!n) return ''
  if (n.length >= 11 && n[0] === '0') n = n.slice(1)
  if (n.length === 10 || n.length === 11) n = '55' + n
  if (n.length === 12 && n.startsWith('55')) {
    n = n.slice(0, 4) + '9' + n.slice(4)
  }
  return n
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  if (!INTERNAL_KEY || req.headers.get('x-internal-key') !== INTERNAL_KEY) {
    return json({ error: 'unauthorized' }, 401)
  }

  let body: IngestBody
  try {
    body = await req.json()
  } catch {
    return json({ error: 'JSON inválido' }, 400)
  }

  const phone = normalizarPhoneBR(body.phone || '')
  if (!phone) return json({ error: 'phone é obrigatório' }, 400)
  if (!body.texto) return json({ error: 'texto é obrigatório' }, 400)

  const direction = body.direction === 'out' ? 'out' : 'in'
  const hora      = body.hora || new Date().toISOString()
  const origem    = body.origem || 'whatsapp'

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

  // 1. Resolver tenant pelo slug
  const tenantSlug = body.tenant_slug || DEFAULT_TENANT_SLUG
  const { data: tenant, error: tenantErr } = await supabase
    .from('tenants').select('id').eq('slug', tenantSlug).single()
  if (tenantErr || !tenant) {
    return json({ error: `tenant '${tenantSlug}' não encontrado` }, 404)
  }
  const tenant_id = tenant.id

  // 2. Dedup por msg_id_externo (se vier)
  if (body.msg_id) {
    const { data: existente } = await supabase
      .from('whatsapp_msgs')
      .select('id, thread_id')
      .eq('tenant_id', tenant_id)
      .eq('msg_id_externo', body.msg_id)
      .maybeSingle()
    if (existente) {
      return json({ ok: true, deduped: true, msg_id: existente.id, thread_id: existente.thread_id })
    }
  }

  // 3. Upsert contato
  const { data: contato, error: contatoErr } = await supabase
    .from('whatsapp_contatos')
    .upsert(
      { tenant_id, phone, nome: body.nome || null, atualizado_em: new Date().toISOString() },
      { onConflict: 'tenant_id,phone', ignoreDuplicates: false },
    )
    .select('id, nome')
    .single()
  if (contatoErr || !contato) {
    return json({ error: 'falha ao upsert contato: ' + (contatoErr?.message || '') }, 500)
  }
  const contato_id = contato.id

  // Se chegou nome novo e o existente era null, atualiza
  if (body.nome && !contato.nome) {
    await supabase.from('whatsapp_contatos').update({ nome: body.nome }).eq('id', contato_id)
  }

  // 4. Buscar ou criar thread (1 thread "aberta" por contato; se todas arquivadas, abre nova)
  let { data: thread } = await supabase
    .from('whatsapp_threads')
    .select('id, nao_lidas, status')
    .eq('tenant_id', tenant_id)
    .eq('contato_id', contato_id)
    .neq('status', 'arquivada')
    .order('ultima_atividade', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!thread) {
    const { data: novaThread, error: threadErr } = await supabase
      .from('whatsapp_threads')
      .insert({
        tenant_id, contato_id, origem,
        status: 'aberta',
        ultima_atividade: hora,
        ultima_msg_cliente_em: direction === 'in' ? hora : null,
        nao_lidas: direction === 'in' ? 1 : 0,
      })
      .select('id, nao_lidas, status')
      .single()
    if (threadErr || !novaThread) {
      return json({ error: 'falha ao criar thread: ' + (threadErr?.message || '') }, 500)
    }
    thread = novaThread
  } else {
    const update: Record<string, unknown> = { ultima_atividade: hora }
    if (direction === 'in') {
      update.ultima_msg_cliente_em = hora
      update.nao_lidas = (thread.nao_lidas || 0) + 1
    }
    await supabase.from('whatsapp_threads').update(update).eq('id', thread.id)
  }

  // 5. Inserir mensagem
  const { data: msg, error: msgErr } = await supabase
    .from('whatsapp_msgs')
    .insert({
      tenant_id,
      thread_id: thread.id,
      autor: direction === 'in' ? 'cliente' : 'atendente',
      texto: body.texto,
      msg_id_externo: body.msg_id || null,
      hora,
      status: 'enviada',
    })
    .select('id')
    .single()
  if (msgErr || !msg) {
    return json({ error: 'falha ao inserir msg: ' + (msgErr?.message || '') }, 500)
  }

  return json({
    ok: true,
    tenant_id,
    contato_id,
    thread_id: thread.id,
    msg_id: msg.id,
  })
})

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
