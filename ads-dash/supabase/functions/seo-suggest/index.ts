// Supabase Edge Function — seo-suggest
//
// Gera 4-6 sugestões de SEO contextuais para o tenant, baseadas no snapshot
// atual (keywords + posições reais do GSC + auditoria on-page do seo-audit).
// Escreve em seo_snapshots.payload.sugestoes via RPC seo_snapshot_merge
// (não pisa no que gsc-sync/seo-audit já gravaram).
//
// Provider: OpenAI (gpt-4o-mini) via OPENAI_API_KEY — mesmo padrão dos
// gemini-* insights (nome legado, provider real é OpenAI).
//
// Secrets:
//   OPENAI_API_KEY
//   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY
//   SEO_SUGGEST_TENANT_ID   uuid do tenant
//   SEO_SUGGEST_CONTEXT     (opcional) texto livre com contexto do negócio
//                           default: descrição de salão de beleza (The Blonde Concept)
//
// Deploy:
//   supabase functions deploy seo-suggest --no-verify-jwt

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL   = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY    = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const OPENAI_KEY     = Deno.env.get('OPENAI_API_KEY')!
const TENANT_ID      = Deno.env.get('SEO_SUGGEST_TENANT_ID')!
const CONTEXT        = Deno.env.get('SEO_SUGGEST_CONTEXT') ??
  'The Blonde Concept — salão de beleza em Belo Horizonte especializado em cabelos loiros ' +
  '(mechas, iluminadas, platinado, correção de cor, progressiva). Público: mulheres 25-45 anos ' +
  'que buscam serviço técnico de alta qualidade. Pretende aparecer em buscas locais (BH + região).'

const MODEL = 'gpt-4o-mini'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface Sugestao {
  titulo: string
  tipo: string
  prioridade: 'alta' | 'média' | 'baixa'
  descricao: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  if (!OPENAI_KEY || !TENANT_ID) {
    return json({ error: 'OPENAI_API_KEY / SEO_SUGGEST_TENANT_ID ausentes' }, 400)
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

  const { data: logRow } = await supabase.from('seo_sync_log')
    .insert({ tenant_id: TENANT_ID, source: 'ai' })
    .select().single()

  try {
    // 1. Coleta contexto real: snapshot mais recente + keywords monitoradas
    const [{ data: snapRows }, { data: kwRows }] = await Promise.all([
      supabase.from('seo_snapshots')
        .select('date, score, payload')
        .eq('tenant_id', TENANT_ID)
        .order('date', { ascending: false })
        .limit(1),
      supabase.from('seo_monitored_keywords')
        .select('termo, posicao, posicao_anterior, volume, dificuldade, oportunidade, impressions, clicks, ctr')
        .eq('tenant_id', TENANT_ID)
        .eq('ativo', true)
        .order('volume', { ascending: false }),
    ])

    const snap = snapRows?.[0]
    const keywords = kwRows ?? []

    if (!snap && keywords.length === 0) {
      throw new Error('Sem dados suficientes: rode gsc-sync/seo-audit primeiro ou adicione keywords.')
    }

    // 2. Monta prompt e chama OpenAI
    const prompt = buildPrompt(snap, keywords)
    const sugestoes = await callOpenAI(prompt)

    // 3. Merge no snapshot do dia
    const today = new Date().toISOString().slice(0, 10)
    const { error: mergeErr } = await supabase.rpc('seo_snapshot_merge', {
      p_tenant_id: TENANT_ID,
      p_date:      today,
      p_patch:     { sugestoes, suggested_at: new Date().toISOString(), model: MODEL },
      p_score:     null,
    })
    if (mergeErr) throw new Error(`seo_snapshot_merge: ${mergeErr.message}`)

    await supabase.from('seo_sync_log').update({
      finished_at: new Date().toISOString(),
      status: 'ok',
      rows_upserted: sugestoes.length,
      raw: { count: sugestoes.length } as unknown,
    }).eq('id', logRow!.id)

    return json({ ok: true, count: sugestoes.length, sugestoes })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    await supabase.from('seo_sync_log').update({
      finished_at: new Date().toISOString(),
      status: 'error',
      error: msg,
    }).eq('id', logRow!.id)
    return json({ error: msg }, 500)
  }
})

// ---------- Prompt ----------

interface Snapshot {
  date: string
  score: number
  payload: {
    resumo?: {
      keywords_monitoradas?: number
      no_top10?: number
      trafego_organico_mes?: number
      trafego_delta?: number
    }
    site_total?: {
      impressions?: number
      clicks?: number
      ctr?: number
      position?: number
    }
    auditoria?: Array<{ item: string; status: string; nota: string }>
  }
}

interface Keyword {
  termo: string
  posicao: number | null
  posicao_anterior: number | null
  volume: number
  dificuldade: string
  oportunidade: string
  impressions?: number
  clicks?: number
  ctr?: number
}

function buildPrompt(snap: Snapshot | undefined, keywords: Keyword[]): string {
  const resumo = snap?.payload?.resumo ?? {}
  const site   = snap?.payload?.site_total ?? {}
  const audit  = snap?.payload?.auditoria ?? []

  const kwCompact = keywords.slice(0, 25).map(k => ({
    termo: k.termo,
    pos: k.posicao ?? 0,
    pos_ant: k.posicao_anterior ?? 0,
    impressoes_28d: k.impressions ?? 0,
    cliques_28d: k.clicks ?? 0,
    ctr: k.ctr ?? 0,
    volume_estimado: k.volume,
    dificuldade: k.dificuldade,
  }))

  return `CONTEXTO DO NEGÓCIO:
${CONTEXT}

SNAPSHOT DE SEO (${snap?.date ?? 'sem dado'}):
- Score: ${snap?.score ?? '?'}/100
- Keywords monitoradas: ${resumo.keywords_monitoradas ?? 0} (no top 10: ${resumo.no_top10 ?? 0})
- Tráfego orgânico 28d: ${resumo.trafego_organico_mes ?? 0} cliques (delta ${resumo.trafego_delta ?? 0}%)
- Site total 28d: ${site.impressions ?? 0} impressões, ${site.clicks ?? 0} cliques, CTR ${((site.ctr ?? 0) * 100).toFixed(2)}%, posição média ${site.position ?? '?'}

KEYWORDS MONITORADAS (dados reais do Search Console, últimos 28d):
${kwCompact.length ? JSON.stringify(kwCompact, null, 2) : '(nenhuma keyword monitorada)'}

AUDITORIA ON-PAGE (real):
${audit.length ? audit.map(a => `- [${a.status}] ${a.item}: ${a.nota}`).join('\n') : '(sem auditoria)'}

TAREFA:
Você é o especialista de SEO da marca. Analise os dados reais acima e devolva
4-6 sugestões CONCRETAS e ACIONÁVEIS priorizadas por impacto.

Priorize:
1. Keywords com posição entre 11-25 que têm volume/impressões (fácil subir pro top 10 com pouca coisa).
2. Problemas críticos da auditoria on-page (status "erro" > "alerta" > "ok").
3. Oportunidades de conteúdo baseadas em intent do público.

Responda SOMENTE com JSON válido (sem markdown, sem \`\`\`) neste formato:
{
  "sugestoes": [
    {
      "titulo": "<título curto, específico, sem aspas duplas>",
      "tipo": "Blog / artigo | Landing page | SEO local | Correção on-page | Backlink | Técnico",
      "prioridade": "alta | média | baixa",
      "descricao": "<recomendação em 1-2 frases citando dados reais quando útil (ex: 'você está em 21º pra X com Y buscas/mês')>"
    }
  ]
}

Regras:
- 4 a 6 sugestões no máximo. Priorize as de MAIOR impacto no ROI.
- NUNCA invente números. Se citar posição/volume, use os dados acima.
- Português brasileiro, tom direto, sem floreios.
- Se auditoria tiver status "erro", pelo menos 1 sugestão deve endereçar isso.`
}

// ---------- OpenAI ----------

async function callOpenAI(prompt: string): Promise<Sugestao[]> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.4,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'Você é um especialista em SEO para pequenos negócios brasileiros. Responde sempre em JSON válido, sem markdown, sem preâmbulo.' },
        { role: 'user', content: prompt },
      ],
    }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${data.error?.message ?? 'erro'}`)

  const text = data.choices?.[0]?.message?.content ?? '{}'
  const parsed = JSON.parse(text) as { sugestoes?: Sugestao[] }
  const list = parsed.sugestoes ?? []
  if (!Array.isArray(list) || list.length === 0) throw new Error('OpenAI retornou lista vazia.')

  // Sanitiza
  return list.slice(0, 6).map(s => ({
    titulo: String(s.titulo ?? '').slice(0, 140),
    tipo: String(s.tipo ?? 'Correção on-page').slice(0, 40),
    prioridade: (['alta', 'média', 'baixa'] as const).includes(s.prioridade as never)
      ? s.prioridade
      : 'média',
    descricao: String(s.descricao ?? '').slice(0, 400),
  }))
}

// ---------- utils ----------

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
