// Supabase Edge Function — whatsapp-templates
//
// CRUD de templates HSM da WhatsApp Cloud API (Meta oficial), com submissão
// e sync contra a Graph API.
//
// A função usa o JWT do usuário chamador — RLS + `current_user_first_tenant()`
// resolvem o tenant automaticamente. Não precisa passar tenant_id no body.
//
// Endpoints (todos POST, distinguidos pelo campo `action`):
//
//   { action: "create", template: {...} }
//     Grava local (status='draft') e submete pra Graph
//     /{WABA_ID}/message_templates. Se a Graph aceitar, status vira
//     'pending' e meta_template_id fica preenchido.
//
//   { action: "sync" }
//     Lê /{WABA_ID}/message_templates e atualiza status/motivo_rejeicao
//     dos templates locais que casam por (name, language).
//
//   { action: "delete", id, hard? }
//     Delete local (RLS-scoped). Se `hard=true` e o template já foi submetido,
//     também chama DELETE /{WABA_ID}/message_templates?name=... na Graph.
//
// Env:
//   SUPABASE_URL
//   SUPABASE_ANON_KEY        pra criar client com o JWT do usuário
//   META_WHATSAPP_TOKEN      System User long-lived
//   META_WABA_ID             WABA default
//   META_GRAPH_VERSION       opcional, default 'v21.0'
//   INTERNAL_API_KEY         opcional — se setado, exige header x-internal-key

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL   = Deno.env.get('SUPABASE_URL')!
const ANON_KEY       = Deno.env.get('SUPABASE_ANON_KEY')!
const META_TOKEN     = Deno.env.get('META_WHATSAPP_TOKEN')
const META_WABA_ID   = Deno.env.get('META_WABA_ID')
const GRAPH_VERSION  = Deno.env.get('META_GRAPH_VERSION') || 'v21.0'
const INTERNAL_KEY   = Deno.env.get('INTERNAL_API_KEY')

const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-internal-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type MetaCategory = 'MARKETING' | 'UTILITY' | 'AUTHENTICATION'
type MetaStatus =
  | 'APPROVED' | 'PENDING' | 'REJECTED' | 'PAUSED' | 'DISABLED' | 'IN_APPEAL'

interface TemplateInput {
  name: string
  language: string
  category: MetaCategory
  components: unknown[]
}

interface Body {
  action: 'create' | 'sync' | 'delete'
  template?: TemplateInput
  id?: string
  hard?: boolean
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  if (INTERNAL_KEY && req.headers.get('x-internal-key') !== INTERNAL_KEY) {
    return json({ error: 'unauthorized' }, 401)
  }

  const authHeader = req.headers.get('Authorization') || ''
  if (!authHeader.startsWith('Bearer ')) {
    return json({ error: 'faltou Authorization: Bearer <jwt>' }, 401)
  }

  let body: Body
  try {
    body = await req.json()
  } catch {
    return json({ error: 'JSON inválido' }, 400)
  }
  if (!body.action) return json({ error: 'action é obrigatória' }, 400)

  // Cliente com o JWT do usuário: RLS + defaults do banco resolvem tenant/autor.
  const supabase = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  })

  try {
    switch (body.action) {
      case 'create': return await handleCreate(supabase, body)
      case 'sync':   return await handleSync(supabase)
      case 'delete': return await handleDelete(supabase, body)
      default:       return json({ error: `action desconhecida: ${body.action}` }, 400)
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return json({ error: msg }, 500)
  }
})

// ------------------------------------------------------------
// create — grava local + submete pra Graph
// ------------------------------------------------------------

async function handleCreate(supabase: SupabaseClient, body: Body): Promise<Response> {
  const t = body.template
  if (!t?.name || !t?.language || !t?.category) {
    return json({ error: 'template.name / language / category são obrigatórios' }, 400)
  }
  if (!Array.isArray(t.components) || t.components.length === 0) {
    return json({ error: 'template.components não pode ser vazio' }, 400)
  }
  if (!/^[a-z0-9_]{1,512}$/.test(t.name)) {
    return json({ error: 'name inválido (use apenas a-z, 0-9, _; até 512 chars)' }, 400)
  }

  // 1. Grava local (idempotente por (tenant_id, name, language) via RLS + unique)
  const { data: existing } = await supabase
    .from('whatsapp_templates')
    .select('id, status')
    .eq('name', t.name)
    .eq('language', t.language)
    .maybeSingle()

  let localId: string
  if (existing) {
    if (existing.status === 'approved' || existing.status === 'pending') {
      return json({
        error: `Já existe um template ${existing.status} com esse name+language. Duplique com outro name.`,
      }, 409)
    }
    const { error: updErr } = await supabase
      .from('whatsapp_templates')
      .update({
        category: t.category,
        components: t.components,
        status: 'draft',
        motivo_rejeicao: null,
      })
      .eq('id', existing.id)
    if (updErr) return json({ error: `update local: ${updErr.message}` }, 500)
    localId = existing.id
  } else {
    const { data, error } = await supabase
      .from('whatsapp_templates')
      .insert({
        name: t.name,
        language: t.language,
        category: t.category,
        components: t.components,
        status: 'draft',
      })
      .select('id')
      .single()
    if (error || !data) return json({ error: `insert local: ${error?.message}` }, 500)
    localId = data.id as string
  }

  // 2. Sem Meta configurada → devolve só o draft (útil pra teste local).
  if (!META_TOKEN || !META_WABA_ID) {
    return json({
      message: 'Template salvo como draft. Meta não configurada — não foi submetido.',
      id: localId,
      status: 'draft',
      sem_config: true,
    })
  }

  // 3. Submete pra Graph API
  const graphRes = await fetch(`${GRAPH_BASE}/${META_WABA_ID}/message_templates`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${META_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: t.name,
      language: t.language,
      category: t.category,
      components: t.components,
    }),
  })
  const graphBody = await graphRes.json().catch(() => ({}))

  if (!graphRes.ok) {
    await supabase
      .from('whatsapp_templates')
      .update({
        status: 'rejected',
        motivo_rejeicao: graphBody?.error?.message || `HTTP ${graphRes.status}`,
        sincronizado_em: new Date().toISOString(),
      })
      .eq('id', localId)
    return json({
      error: 'Meta rejeitou o template',
      detalhe: graphBody?.error || graphBody,
    }, 400)
  }

  await supabase
    .from('whatsapp_templates')
    .update({
      meta_template_id: String(graphBody.id ?? ''),
      status: normalizeStatus(graphBody.status) ?? 'pending',
      sincronizado_em: new Date().toISOString(),
    })
    .eq('id', localId)

  return json({
    message: 'Submetido pra aprovação da Meta.',
    id: localId,
    meta_template_id: graphBody.id,
    status: normalizeStatus(graphBody.status) ?? 'pending',
  })
}

// ------------------------------------------------------------
// sync — puxa status atualizado do Graph e reflete no local
// ------------------------------------------------------------

async function handleSync(supabase: SupabaseClient): Promise<Response> {
  if (!META_TOKEN || !META_WABA_ID) {
    return json({ error: 'META_WHATSAPP_TOKEN e META_WABA_ID não configurados' }, 400)
  }

  const graphRes = await fetch(
    `${GRAPH_BASE}/${META_WABA_ID}/message_templates?fields=id,name,language,status,category,components,quality_score&limit=200`,
    { headers: { 'Authorization': `Bearer ${META_TOKEN}` } },
  )
  const graphBody = await graphRes.json().catch(() => ({}))
  if (!graphRes.ok) {
    return json({ error: `Graph ${graphRes.status}`, detalhe: graphBody?.error || graphBody }, 502)
  }

  const remotos: Array<{
    id: string; name: string; language: string; status: MetaStatus;
    category?: MetaCategory;
  }> = graphBody.data || []

  let atualizados = 0
  for (const r of remotos) {
    const patch: Record<string, unknown> = {
      meta_template_id: String(r.id),
      status: normalizeStatus(r.status) ?? 'pending',
      sincronizado_em: new Date().toISOString(),
    }
    if (patch.status !== 'rejected') patch.motivo_rejeicao = null

    const { data } = await supabase
      .from('whatsapp_templates')
      .update(patch)
      .eq('name', r.name)
      .eq('language', r.language)
      .select('id')
    if (data && data.length > 0) atualizados++
  }

  return json({
    message: 'Sync concluído.',
    templates_remotos: remotos.length,
    atualizados_localmente: atualizados,
  })
}

// ------------------------------------------------------------
// delete
// ------------------------------------------------------------

async function handleDelete(supabase: SupabaseClient, body: Body): Promise<Response> {
  if (!body.id) return json({ error: 'id é obrigatório' }, 400)

  const { data: t, error: getErr } = await supabase
    .from('whatsapp_templates')
    .select('id, name, meta_template_id')
    .eq('id', body.id)
    .maybeSingle()
  if (getErr) return json({ error: getErr.message }, 500)
  if (!t) return json({ error: 'template não encontrado' }, 404)

  if (body.hard && t.meta_template_id && META_TOKEN && META_WABA_ID) {
    const url = `${GRAPH_BASE}/${META_WABA_ID}/message_templates?name=${encodeURIComponent(t.name)}`
    const res = await fetch(url, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${META_TOKEN}` },
    })
    if (!res.ok) {
      const detalhe = await res.json().catch(() => ({}))
      return json({
        error: 'Falha ao apagar na Meta. Local mantido.',
        detalhe: detalhe?.error || detalhe,
      }, 502)
    }
  }

  const { error: delErr } = await supabase
    .from('whatsapp_templates')
    .delete()
    .eq('id', body.id)
  if (delErr) return json({ error: delErr.message }, 500)

  return json({ message: 'Template removido.', id: body.id })
}

// ------------------------------------------------------------
// helpers
// ------------------------------------------------------------

function normalizeStatus(s: string | undefined): string | null {
  switch (s?.toUpperCase()) {
    case 'APPROVED':  return 'approved'
    case 'PENDING':   return 'pending'
    case 'REJECTED':  return 'rejected'
    case 'PAUSED':    return 'paused'
    case 'DISABLED':  return 'disabled'
    case 'IN_APPEAL': return 'pending'
    default:          return null
  }
}

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
