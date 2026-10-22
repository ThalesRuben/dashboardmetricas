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
//     "tenant_slug": "the-blonde-concept",  // opcional (override do default)
//     "inbox_phone": "5531990842381"   // opcional — número WhatsApp Business do salão
//                                      //   que recebeu a msg. Aceita também os aliases
//                                      //   `connected_phone` / `connectedPhone` (n8n
//                                      //   pode mandar direto o campo do Z-API).
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
  inbox_phone?: string
  connected_phone?: string
  connectedPhone?: string
  // Novo (2026-10-22): Z-API inbound traz chatLid (LID da conversa) em
  // paralelo ao phone real. Outbound entrega o LID no próprio campo phone
  // (sufixo @lid). O ingest usa isso pra resolver o par e evitar criar
  // contato órfão a cada envio do atendente.
  chat_lid?: string
  chatLid?: string
}

// Extrai dígitos puros de "<digitos>@lid" → "<digitos>". Null se não parece LID.
function extrairLid(raw: string | null | undefined): string | null {
  if (!raw) return null
  if (!/@lid$/i.test(raw)) return null
  const digits = raw.replace(/@lid$/i, '').replace(/\D/g, '')
  return digits || null
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

  // Detecta se o `phone` do payload é um LID (acontece em outbound Z-API,
  // fromMe=true). Nesse caso, NÃO rejeita — vai resolver via lookup pelo LID.
  const phoneRaw = body.phone || ''
  const lidFromPhone = extrairLid(phoneRaw)
  const lidFromChat  = extrairLid(body.chat_lid || body.chatLid || null)
  const lid = lidFromPhone || lidFromChat || null
  const isLidOnly = !!lidFromPhone  // phone chegou como @lid, não temos telefone real

  // Antes rejeitava texto vazio. Problema: reações, stickers e áudios sem
  // caption chegam com `text.message = ""` e sumiam (~80/semana). Agora
  // aceita e grava placeholder — o prettyPreview() no front já traduz.
  const texto = body.texto && body.texto.trim() ? body.texto : '[sem texto]'

  // Telefone real: só normaliza/valida quando NÃO é LID-only.
  // Telefone BR válido tem 12 dígitos (fixo: 55+DDD+8) ou 13 (celular: 55+DDD+9).
  let phone = ''
  if (!isLidOnly) {
    phone = normalizarPhoneBR(phoneRaw)
    if (!phone) return json({ error: 'phone é obrigatório' }, 400)
    if (phone.length !== 12 && phone.length !== 13) {
      console.log(JSON.stringify({
        tag: 'ingest-reject',
        reason: 'phone_length_invalido',
        phone_length: phone.length,
        phone_raw: phoneRaw,
        phone_normalized: phone,
        body_keys: Object.keys(body),
      }))
      return json({ error: `phone com ${phone.length} dígitos rejeitado (esperado 12 ou 13)`, ignored: true }, 400)
    }
  } else if (!lid) {
    return json({ error: 'phone @lid sem dígitos válidos', ignored: true }, 400)
  }

  const direction = body.direction === 'out' ? 'out' : 'in'
  const hora      = body.hora || new Date().toISOString()
  const origem    = body.origem || 'whatsapp'
  // Aceita 3 nomes pra facilitar wire-up no n8n. Vazio → null (legacy).
  const inboxRaw    = body.inbox_phone || body.connected_phone || body.connectedPhone || ''
  const inbox_phone = inboxRaw ? normalizarPhoneBR(inboxRaw) : null

  // Mesmo filtro pro inbox_phone quando presente. Null (legacy) continua ok.
  if (inbox_phone !== null && inbox_phone.length !== 12 && inbox_phone.length !== 13) {
    console.log(JSON.stringify({
      tag: 'ingest-reject',
      reason: 'inbox_phone_length_invalido',
      inbox_phone_length: inbox_phone.length,
      inbox_raw: inboxRaw,
      inbox_normalized: inbox_phone,
    }))
    return json({ error: `inbox_phone com ${inbox_phone.length} dígitos rejeitado (esperado 12 ou 13)`, ignored: true }, 400)
  }

  // Log de diagnóstico (temporário até estabilizar o fluxo LID).
  console.log(JSON.stringify({
    tag: 'ingest-recv',
    body_keys: Object.keys(body),
    phone_cliente: phone || null,
    lid,
    is_lid_only: isLidOnly,
    inbox_phone_final: inbox_phone,
  }))

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

  // 3. Resolver contato — 2 caminhos:
  //    A) Outbound Z-API com phone=@lid → busca por lid, cai pra provisional.
  //    B) Inbound (ou outbound com phone real) → upsert por (tenant_id,phone)
  //       e, se veio chat_lid, grava lid no contato real + funde órfão.
  let contato_id: string
  let contato_nome: string | null = null

  if (isLidOnly) {
    // --- Caminho A: só temos o LID
    const { data: byLid } = await supabase
      .from('whatsapp_contatos')
      .select('id, nome')
      .eq('tenant_id', tenant_id)
      .eq('lid', lid)
      .maybeSingle()

    if (byLid) {
      contato_id = byLid.id
      contato_nome = byLid.nome
    } else {
      // Edge case (fix #4): o LID em dígitos pode colidir com phone de um
      // contato preexistente (ex.: um dos 8 internacionais desmarcados pela
      // 0047 cujo phone casa com o LID vindo agora). Antes do insert tenta
      // casar por phone = lid; se achar, associa o LID a esse contato.
      const { data: byPhone } = await supabase
        .from('whatsapp_contatos')
        .select('id, nome, lid')
        .eq('tenant_id', tenant_id)
        .eq('phone', lid)
        .maybeSingle()

      if (byPhone) {
        if (!byPhone.lid) {
          await supabase.from('whatsapp_contatos').update({ lid }).eq('id', byPhone.id)
        }
        contato_id = byPhone.id
        contato_nome = byPhone.nome
      } else {
        // Provisional de verdade: cria com phone = lid (placeholder).
        // Quando o inbound chegar com telefone real + chatLid, o merge
        // no caminho B refaz.
        const { data: novo, error: ne } = await supabase
          .from('whatsapp_contatos')
          .insert({ tenant_id, phone: lid, lid, nome: body.nome || null })
          .select('id, nome')
          .single()
        if (ne || !novo) {
          return json({ error: 'falha ao criar contato LID: ' + (ne?.message || '') }, 500)
        }
        contato_id = novo.id
        contato_nome = novo.nome
      }
    }
  } else {
    // --- Caminho B: temos telefone real
    // Fix #1: só inclui `nome` no upsert quando ele vier preenchido.
    // Antes, outbound com nome vazio sobrescrevia nome existente com null
    // (ocorria em ~148 msgs/semana — SET nome=null roda em qualquer upsert).
    const { data: up, error: ue } = await supabase
      .from('whatsapp_contatos')
      .upsert(
        {
          tenant_id,
          phone,
          atualizado_em: new Date().toISOString(),
          ...(body.nome ? { nome: body.nome } : {}),
        },
        { onConflict: 'tenant_id,phone', ignoreDuplicates: false },
      )
      .select('id, nome, lid')
      .single()
    if (ue || !up) {
      return json({ error: 'falha ao upsert contato: ' + (ue?.message || '') }, 500)
    }
    contato_id = up.id
    contato_nome = up.nome

    // Se chat_lid veio e o contato real ainda não tem lid:
    // 1) FUNDE PRIMEIRO (merge apaga o contato órfão que tem lid=X)
    // 2) DEPOIS grava o lid no real.
    // Ordem importa — o índice único (tenant_id, lid) proíbe 2 contatos
    // com mesmo lid, então gravar no real antes de apagar o órfão daria
    // violação de unicidade.
    if (lid && !(up as { lid: string | null }).lid) {
      const { data: fused, error: mergeErr } = await supabase.rpc('whatsapp_merge_lid', {
        p_tenant_id: tenant_id,
        p_real_contato_id: contato_id,
        p_lid: lid,
      })
      if (mergeErr) {
        console.log(JSON.stringify({ tag: 'ingest-merge-error', lid, error: mergeErr.message }))
      }
      await supabase.from('whatsapp_contatos').update({ lid }).eq('id', contato_id)
      if (fused && Number(fused) > 0) {
        console.log(JSON.stringify({ tag: 'ingest-merge', contato_id, lid, threads_fused: fused }))
      }
    }
  }

  // Se chegou nome novo e o existente era null, atualiza
  if (body.nome && !contato_nome) {
    await supabase.from('whatsapp_contatos').update({ nome: body.nome }).eq('id', contato_id)
  }

  // 4. Buscar ou criar thread.
  //
  // Regras:
  //   - Se body trouxe inbox_phone X:
  //       * acha thread existente com inbox_phone = X → usa.
  //       * senão, acha thread legada com inbox_phone = NULL → backfilla
  //         pra X e usa (cliente que já existia antes da feature).
  //       * senão, cria nova com inbox_phone = X.
  //   - Se body NÃO trouxe inbox_phone (modo legacy): pega qualquer
  //     thread aberta do contato, ou cria nova com inbox_phone = NULL.
  const { data: candidatas } = await supabase
    .from('whatsapp_threads')
    .select('id, nao_lidas, status, inbox_phone')
    .eq('tenant_id', tenant_id)
    .eq('contato_id', contato_id)
    .neq('status', 'arquivada')
    .order('ultima_atividade', { ascending: false })

  type ThreadRow = { id: string; nao_lidas: number; status: string; inbox_phone: string | null }
  const lista = (candidatas || []) as ThreadRow[]

  let thread: ThreadRow | null = null
  let backfillInbox = false

  if (inbox_phone) {
    thread = lista.find((t) => t.inbox_phone === inbox_phone) || null
    if (!thread) {
      const legada = lista.find((t) => t.inbox_phone === null) || null
      if (legada) {
        thread = legada
        backfillInbox = true
      }
    }
  } else {
    thread = lista[0] || null
  }

  if (!thread) {
    const { data: novaThread, error: threadErr } = await supabase
      .from('whatsapp_threads')
      .insert({
        tenant_id, contato_id, origem,
        status: 'aberta',
        inbox_phone,
        ultima_atividade: hora,
        ultima_msg_cliente_em: direction === 'in' ? hora : null,
        nao_lidas: direction === 'in' ? 1 : 0,
      })
      .select('id, nao_lidas, status, inbox_phone')
      .single()
    if (threadErr || !novaThread) {
      return json({ error: 'falha ao criar thread: ' + (threadErr?.message || '') }, 500)
    }
    thread = novaThread as ThreadRow
  } else {
    const update: Record<string, unknown> = { ultima_atividade: hora }
    if (direction === 'in') {
      update.ultima_msg_cliente_em = hora
      update.nao_lidas = (thread.nao_lidas || 0) + 1
    }
    if (backfillInbox) update.inbox_phone = inbox_phone
    await supabase.from('whatsapp_threads').update(update).eq('id', thread.id)
  }

  // 5. Inserir mensagem
  const { data: msg, error: msgErr } = await supabase
    .from('whatsapp_msgs')
    .insert({
      tenant_id,
      thread_id: thread.id,
      autor: direction === 'in' ? 'cliente' : 'atendente',
      texto,
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
