// Supabase Edge Function — meta-ads-sync
//
// Puxa insights diários do Meta Ads (Marketing API v20) e grava em:
//   - ads_campaigns          (metadata da campanha, idempotente por external_id)
//   - ads_daily_metrics      (uma linha por campanha por dia)
//   - ads_sync_log           (auditoria)
//
// Secrets (Supabase → Edge Functions → Secrets):
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//   META_ACCESS_TOKEN         long-lived (60d) com ads_read
//   META_AD_ACCOUNT_ID        ex: act_1234567890
//   META_TENANT_ID            uuid do tenant no Supabase
//
// Autenticação: protegida pelo JWT do Supabase (Authorization: Bearer <anon|service>).
// Não usa x-internal-key — esse header é reservado pra inbox-ingest (n8n).
//
// Deploy:
//   supabase functions deploy meta-ads-sync --no-verify-jwt
//
// Invocação (body opcional):
//   { "since": "2026-07-01", "until": "2026-07-22" }
//   omite = últimos 7 dias

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL   = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY    = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const META_TOKEN     = Deno.env.get('META_ACCESS_TOKEN')!
const AD_ACCOUNT_ID  = Deno.env.get('META_AD_ACCOUNT_ID')!   // formato: act_XXXXXXXXXX
const TENANT_ID      = Deno.env.get('META_TENANT_ID')!

const GRAPH = 'https://graph.facebook.com/v20.0'

// Actions relevantes pra salão (Click-to-WhatsApp / lead)
const MSG_ACTIONS  = new Set([
  'onsite_conversion.messaging_conversation_started_7d',
  'onsite_conversion.messaging_first_reply',
])
const LEAD_ACTIONS = new Set([
  'lead',
  'onsite_conversion.lead_grouped',
  'offsite_conversion.fb_pixel_lead',
])
const PURCHASE_ACTIONS = new Set([
  'purchase',
  'offsite_conversion.fb_pixel_purchase',
  'onsite_conversion.purchase',
])

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  if (!META_TOKEN || !AD_ACCOUNT_ID || !TENANT_ID) {
    return json({ error: 'META_ACCESS_TOKEN, META_AD_ACCOUNT_ID ou META_TENANT_ID ausentes' }, 400)
  }

  const body = await safeJson(req)
  const since = body.since ?? isoDaysAgo(7)
  const until = body.until ?? isoDaysAgo(0)

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

  const { data: logRow } = await supabase.from('ads_sync_log')
    .insert({ tenant_id: TENANT_ID, source: 'meta', range_from: since, range_to: until })
    .select().single()

  try {
    const insights = await fetchInsights(since, until)
    const campaignMap = await upsertCampaigns(supabase, insights)
    const upserted = await upsertDaily(supabase, insights, campaignMap)

    await supabase.from('ads_sync_log').update({
      finished_at: new Date().toISOString(),
      status: 'ok',
      rows_upserted: upserted,
    }).eq('id', logRow!.id)

    return json({ ok: true, since, until, campaigns: campaignMap.size, rows: upserted })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    await supabase.from('ads_sync_log').update({
      finished_at: new Date().toISOString(),
      status: 'error',
      error: msg,
    }).eq('id', logRow!.id)
    return json({ error: msg }, 500)
  }
})

// ---------- Meta Graph fetch ----------

interface Insight {
  campaign_id: string
  campaign_name: string
  date_start: string
  date_stop: string
  spend?: string
  impressions?: string
  clicks?: string
  ctr?: string
  actions?: { action_type: string; value: string }[]
  action_values?: { action_type: string; value: string }[]
}

async function fetchInsights(since: string, until: string): Promise<Insight[]> {
  const url = new URL(`${GRAPH}/${AD_ACCOUNT_ID}/insights`)
  url.searchParams.set('access_token', META_TOKEN)
  url.searchParams.set('level', 'campaign')
  url.searchParams.set('time_increment', '1')
  url.searchParams.set('time_range', JSON.stringify({ since, until }))
  url.searchParams.set('fields',
    'campaign_id,campaign_name,spend,impressions,clicks,ctr,actions,action_values')
  url.searchParams.set('limit', '500')

  const out: Insight[] = []
  let next: string | null = url.toString()
  while (next) {
    const res = await fetch(next)
    const j = await res.json()
    if (!res.ok || j.error) {
      throw new Error(`Meta API ${res.status}: ${j.error?.message || JSON.stringify(j)}`)
    }
    out.push(...(j.data || []))
    next = j.paging?.next || null
  }
  return out
}

// ---------- Upserts ----------

async function upsertCampaigns(
  supabase: ReturnType<typeof createClient>,
  insights: Insight[],
): Promise<Map<string, string>> {
  const unique = new Map<string, string>()   // external_id → name
  for (const i of insights) unique.set(i.campaign_id, i.campaign_name)

  const rows = [...unique.entries()].map(([external_id, name]) => ({
    tenant_id: TENANT_ID,
    source: 'meta',
    external_id,
    name,
  }))
  if (!rows.length) return new Map()

  const { data, error } = await supabase.from('ads_campaigns')
    .upsert(rows, { onConflict: 'tenant_id,source,external_id' })
    .select('id, external_id')
  if (error) throw new Error('upsert ads_campaigns: ' + error.message)

  return new Map((data ?? []).map((r: any) => [r.external_id as string, r.id as string]))
}

async function upsertDaily(
  supabase: ReturnType<typeof createClient>,
  insights: Insight[],
  campaignMap: Map<string, string>,
): Promise<number> {
  const rows = insights.map(i => {
    const actions = i.actions ?? []
    const values  = i.action_values ?? []
    const sumActions = (set: Set<string>) =>
      actions.filter(a => set.has(a.action_type)).reduce((s, a) => s + Number(a.value || 0), 0)
    const sumValues = (set: Set<string>) =>
      values.filter(a => set.has(a.action_type)).reduce((s, a) => s + Number(a.value || 0), 0)

    return {
      tenant_id: TENANT_ID,
      campaign_id: campaignMap.get(i.campaign_id) ?? null,
      date: i.date_start,
      investido: Number(i.spend || 0),
      receita:   sumValues(PURCHASE_ACTIONS),
      impressoes: Number(i.impressions || 0),
      cliques:    Number(i.clicks || 0),
      mensagens:  sumActions(MSG_ACTIONS),
      agendamentos: 0,   // não sai do Meta — vem do WhatsApp/CRM (cruzar depois)
      vendas:       sumActions(PURCHASE_ACTIONS),
      ctr_meta:   Number(i.ctr || 0),
      ctr_google: 0,
    }
  })
  if (!rows.length) return 0

  const { error, count } = await supabase.from('ads_daily_metrics')
    .upsert(rows, { onConflict: 'tenant_id,campaign_id,date', count: 'exact' })
  if (error) throw new Error('upsert ads_daily_metrics: ' + error.message)
  return count ?? rows.length
}

// ---------- utils ----------

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function safeJson(req: Request): Promise<{ since?: string; until?: string }> {
  try { return await req.json() } catch { return {} }
}

function isoDaysAgo(n: number): string {
  const d = new Date(); d.setUTCDate(d.getUTCDate() - n)
  return d.toISOString().slice(0, 10)
}
