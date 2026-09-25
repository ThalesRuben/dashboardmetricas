// Supabase Edge Function — gsc-sync
//
// Puxa dados do Google Search Console (Search Analytics API) e grava em:
//   - seo_monitored_keywords  (posicao, posicao_anterior, impressions, clicks, ctr, last_synced_at)
//   - seo_snapshots           (score + resumo agregado do site pro dia)
//   - seo_sync_log            (auditoria)
//
// Secrets (Supabase → Edge Functions → Secrets):
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//   GSC_CLIENT_ID
//   GSC_CLIENT_SECRET
//   GSC_REFRESH_TOKEN
//   GSC_SITE_URL              sc-domain:theblondeconcept.com.br  OU  https://theblondeconcept.com.br/
//   GSC_TENANT_ID             uuid do tenant no Supabase
//
// Deploy:
//   supabase functions deploy gsc-sync --no-verify-jwt
//
// Invocação (body opcional):
//   { "days": 28 }   (default 28 — GSC costuma ter 2-3 dias de defasagem, então usamos [hoje-2-28, hoje-2])

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL   = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY    = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const CLIENT_ID      = Deno.env.get('GSC_CLIENT_ID')!
const CLIENT_SECRET  = Deno.env.get('GSC_CLIENT_SECRET')!
const REFRESH_TOKEN  = Deno.env.get('GSC_REFRESH_TOKEN')!
const SITE_URL       = Deno.env.get('GSC_SITE_URL')!
const TENANT_ID      = Deno.env.get('GSC_TENANT_ID')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  if (!CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN || !SITE_URL || !TENANT_ID) {
    return json({ error: 'GSC_CLIENT_ID / GSC_CLIENT_SECRET / GSC_REFRESH_TOKEN / GSC_SITE_URL / GSC_TENANT_ID ausentes' }, 400)
  }

  const body  = await safeJson(req)
  const days  = clampInt(body.days ?? 28, 7, 90)
  const lag   = 2
  const until = isoDaysAgo(lag)
  const since = isoDaysAgo(lag + days)
  const priorUntil = since
  const priorSince = isoDaysAgo(lag + days * 2)

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

  const { data: logRow } = await supabase.from('seo_sync_log')
    .insert({ tenant_id: TENANT_ID, source: 'gsc', range_from: since, range_to: until })
    .select().single()

  try {
    const accessToken = await refreshAccessToken()

    // 1. Snapshot do site inteiro no período + período anterior (pro delta).
    const [now, prior] = await Promise.all([
      queryGSCTotal(accessToken, since, until),
      queryGSCTotal(accessToken, priorSince, priorUntil),
    ])
    const trafego_organico_mes = Math.round(now.clicks)
    const trafego_delta = prior.clicks > 0
      ? ((now.clicks - prior.clicks) / prior.clicks) * 100
      : 0

    // 2. Uma query só listando todas as queries do período — depois cruzamos com as monitoradas.
    const allQueries = await queryGSCByDimension(accessToken, since, until, ['query'], 5000)
    const queryMap = new Map<string, GscRow>()
    for (const r of allQueries) {
      queryMap.set(String(r.keys?.[0] ?? '').toLowerCase(), r)
    }

    // 3. Lê keywords monitoradas do tenant e atualiza posicao/impressions/clicks/ctr.
    const { data: keywords, error: kwErr } = await supabase
      .from('seo_monitored_keywords')
      .select('id, termo, posicao')
      .eq('tenant_id', TENANT_ID)
      .eq('ativo', true)
    if (kwErr) throw new Error(`select seo_monitored_keywords: ${kwErr.message}`)

    let updated = 0
    for (const kw of keywords ?? []) {
      const row = queryMap.get(kw.termo.toLowerCase())
      const nowIso = new Date().toISOString()
      const { error } = await supabase.from('seo_monitored_keywords').update({
        posicao_anterior: kw.posicao ?? 0,
        posicao:          row ? Math.round(row.position ?? 0) : 0,
        impressions:      Math.round(row?.impressions ?? 0),
        clicks:           Math.round(row?.clicks ?? 0),
        ctr:              +(row?.ctr ?? 0).toFixed(4),
        last_synced_at:   nowIso,
        updated_at:       nowIso,
      }).eq('id', kw.id)
      if (error) throw new Error(`update kw ${kw.termo}: ${error.message}`)
      updated++
    }

    // 4. Recalcula agregados após update (top10 etc).
    const { data: refreshed } = await supabase
      .from('seo_monitored_keywords')
      .select('posicao')
      .eq('tenant_id', TENANT_ID)
      .eq('ativo', true)
    const monitored = refreshed?.length ?? 0
    const no_top10  = (refreshed ?? []).filter(k => k.posicao > 0 && k.posicao <= 10).length

    // 5. Score (fórmula simples — documentada abaixo).
    const score = computeScore({ monitored, no_top10, trafego_organico_mes, trafego_delta })
    const { data: yesterday } = await supabase
      .from('seo_snapshots')
      .select('score')
      .eq('tenant_id', TENANT_ID)
      .lt('date', new Date().toISOString().slice(0, 10))
      .order('date', { ascending: false })
      .limit(1)
    const score_delta = score - (yesterday?.[0]?.score ?? score)

    // 6. Merge parcial do snapshot do dia (não sobrescreve `auditoria` do seo-audit).
    const today = new Date().toISOString().slice(0, 10)
    const patch = {
      score,
      score_delta,
      resumo: {
        keywords_monitoradas: monitored,
        no_top10,
        trafego_organico_mes,
        trafego_delta: +trafego_delta.toFixed(1),
      },
      site_total: {
        impressions: Math.round(now.impressions),
        clicks:      Math.round(now.clicks),
        ctr:         +(now.ctr ?? 0).toFixed(4),
        position:    +(now.position ?? 0).toFixed(2),
      },
      range: { since, until },
      synced_at: new Date().toISOString(),
    }
    const { error: snapErr } = await supabase.rpc('seo_snapshot_merge', {
      p_tenant_id: TENANT_ID,
      p_date:      today,
      p_patch:     patch,
      p_score:     score,
    })
    if (snapErr) throw new Error(`seo_snapshot_merge: ${snapErr.message}`)

    await supabase.from('seo_sync_log').update({
      finished_at: new Date().toISOString(),
      status: 'ok',
      rows_upserted: updated,
    }).eq('id', logRow!.id)

    return json({
      ok: true,
      since, until,
      keywords_synced: updated,
      score, trafego_organico_mes,
      trafego_delta: +trafego_delta.toFixed(1),
    })
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

// ---------- GSC ----------

interface GscRow {
  keys?: string[]
  clicks?: number
  impressions?: number
  ctr?: number
  position?: number
}

async function refreshAccessToken(): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: REFRESH_TOKEN,
      grant_type:    'refresh_token',
    }),
  })
  const j = await res.json()
  if (!res.ok) throw new Error(`OAuth refresh: ${j.error_description || j.error || res.status}`)
  return j.access_token as string
}

const GSC_BASE = 'https://searchconsole.googleapis.com/webmasters/v3/sites'

async function queryGSCByDimension(
  token: string,
  startDate: string,
  endDate: string,
  dimensions: string[],
  rowLimit = 1000,
): Promise<GscRow[]> {
  const url = `${GSC_BASE}/${encodeURIComponent(SITE_URL)}/searchAnalytics/query`
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ startDate, endDate, dimensions, rowLimit }),
  })
  const j = await res.json()
  if (!res.ok) throw new Error(`GSC query [${dimensions.join(',')}]: ${j.error?.message || res.status}`)
  return (j.rows ?? []) as GscRow[]
}

async function queryGSCTotal(token: string, startDate: string, endDate: string): Promise<GscRow> {
  const url = `${GSC_BASE}/${encodeURIComponent(SITE_URL)}/searchAnalytics/query`
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ startDate, endDate, rowLimit: 1 }),
  })
  const j = await res.json()
  if (!res.ok) throw new Error(`GSC total: ${j.error?.message || res.status}`)
  return (j.rows?.[0] ?? { clicks: 0, impressions: 0, ctr: 0, position: 0 }) as GscRow
}

// ---------- score ----------

// Score 0-100 baseado em:
//   40 pts  →  % de keywords monitoradas no top10
//   30 pts  →  volume de tráfego (log10, cap em 10k+ visitas = 30 pts)
//   30 pts  →  evolução (delta% de tráfego; 0% = 15pts, +30% = 30pts, negativo desce)
function computeScore(x: {
  monitored: number
  no_top10: number
  trafego_organico_mes: number
  trafego_delta: number
}): number {
  const top10Pct = x.monitored > 0 ? x.no_top10 / x.monitored : 0
  const trafficPts = x.trafego_organico_mes > 0
    ? Math.min(30, Math.log10(x.trafego_organico_mes + 1) * 8)
    : 0
  const deltaPts = Math.max(0, Math.min(30, 15 + x.trafego_delta * 0.5))
  return Math.round(top10Pct * 40 + trafficPts + deltaPts)
}

// ---------- utils ----------

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function safeJson(req: Request): Promise<{ days?: number }> {
  try { return await req.json() } catch { return {} }
}

function isoDaysAgo(n: number): string {
  const d = new Date(); d.setUTCDate(d.getUTCDate() - n)
  return d.toISOString().slice(0, 10)
}

function clampInt(n: number, lo: number, hi: number): number {
  const x = Math.floor(Number(n))
  return Math.max(lo, Math.min(hi, isFinite(x) ? x : lo))
}
