// Supabase Edge Function — instagram-sync
//
// Puxa métricas orgânicas da Instagram Graph API e grava em:
//   - instagram_account_metrics  (snapshot diário da conta)
//   - instagram_posts            (posts/reels/stories individuais)
//
// Variáveis de ambiente (Supabase → Edge Functions → Secrets):
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//   IG_ACCESS_TOKEN              long-lived token (60 dias)
//   IG_BUSINESS_ACCOUNT_ID       ex: 17841401234567890
//
// Deploy:
//   supabase functions deploy instagram-sync --no-verify-jwt
//
// Manual: invocar sem body para sincronizar agora.
//   supabase.functions.invoke('instagram-sync')
//
// Cron (recomendado, 1x/hora): ver supabase/cron-setup.sql

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL  = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const IG_TOKEN      = Deno.env.get('IG_ACCESS_TOKEN')!
const IG_USER_ID    = Deno.env.get('IG_BUSINESS_ACCOUNT_ID')!
const INTERNAL_KEY  = Deno.env.get('INTERNAL_API_KEY')

const GRAPH = 'https://graph.facebook.com/v19.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  if (INTERNAL_KEY && req.headers.get('x-internal-key') !== INTERNAL_KEY) {
    return json({ error: 'unauthorized' }, 401)
  }

  if (!IG_TOKEN || !IG_USER_ID) {
    return json({ error: 'IG_ACCESS_TOKEN ou IG_BUSINESS_ACCOUNT_ID não configurados' }, 400)
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

  try {
    const account = await syncAccount(supabase)
    const posts   = await syncPosts(supabase)

    return json({
      message: 'Sincronização concluída.',
      account_saved: !!account,
      posts_saved: posts.length,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return json({ error: msg }, 500)
  }
})

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function ig(path: string, params: Record<string, string> = {}) {
  const u = new URL(`${GRAPH}/${path}`)
  u.searchParams.set('access_token', IG_TOKEN)
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v)
  const res = await fetch(u.toString())
  const json = await res.json()
  if (!res.ok || json.error) {
    throw new Error(`Graph API ${res.status}: ${json.error?.message || JSON.stringify(json)}`)
  }
  return json
}

async function syncAccount(supabase: ReturnType<typeof createClient>) {
  const profile = await ig(IG_USER_ID, {
    fields: 'username,followers_count,follows_count,media_count',
  })

  // Insights agregados das últimas 24h
  let insights: any = { data: [] }
  try {
    insights = await ig(`${IG_USER_ID}/insights`, {
      metric: 'reach,impressions,profile_views,website_clicks',
      period: 'day',
    })
  } catch (_) { /* alguns endpoints exigem permissões extras — ignora silenciosamente */ }

  const getMetric = (name: string) => {
    const item = insights.data?.find((x: any) => x.name === name)
    return item?.values?.[0]?.value || 0
  }

  const today = new Date().toISOString().slice(0, 10)
  const row = {
    date: today,
    ig_user_id: IG_USER_ID,
    username: '@' + profile.username,
    seguidores: profile.followers_count || 0,
    seguindo:   profile.follows_count   || 0,
    total_posts: profile.media_count    || 0,
    alcance_dia:    getMetric('reach'),
    impressoes_dia: getMetric('impressions'),
    visitas_perfil: getMetric('profile_views'),
    cliques_site:   getMetric('website_clicks'),
    payload: { profile, insights },
    source: 'api',
  }

  const { error } = await supabase
    .from('instagram_account_metrics')
    .upsert(row, { onConflict: 'date,ig_user_id' })

  if (error) throw new Error('upsert account: ' + error.message)
  return row
}

async function syncPosts(supabase: ReturnType<typeof createClient>) {
  const media = await ig(`${IG_USER_ID}/media`, {
    fields: 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count',
    limit: '25',
  })

  const rows: any[] = []
  for (const m of media.data || []) {
    let insightsByName: Record<string, number> = {}
    try {
      const isReel = m.media_type === 'VIDEO' || m.media_type === 'REELS'
      const metrics = isReel
        ? 'reach,plays,likes,comments,shares,saved'
        : 'reach,impressions,saved,likes,comments,shares'
      const ins = await ig(`${m.id}/insights`, { metric: metrics })
      insightsByName = Object.fromEntries(
        (ins.data || []).map((x: any) => [x.name, x.values?.[0]?.value || 0])
      )
    } catch (_) { /* nem todo post permite insights se for muito antigo */ }

    const tipo = m.media_type === 'VIDEO' ? 'REEL' : (m.media_type || 'IMAGE')
    const reach = insightsByName.reach || 0
    const likes = insightsByName.likes ?? m.like_count ?? 0
    const comments = insightsByName.comments ?? m.comments_count ?? 0
    const saved = insightsByName.saved || 0
    const shares = insightsByName.shares || 0
    const engagementRate = reach > 0
      ? +(((likes + comments + saved + shares) / reach) * 100).toFixed(2)
      : 0

    rows.push({
      ig_post_id: m.id,
      ig_user_id: IG_USER_ID,
      tipo,
      caption: m.caption?.slice(0, 500) || null,
      media_url: m.media_url || null,
      thumbnail_url: m.thumbnail_url || m.media_url || null,
      permalink: m.permalink || null,
      publicado_em: m.timestamp,
      curtidas: likes,
      comentarios: comments,
      salvamentos: saved,
      compartilhamentos: shares,
      alcance: reach,
      impressoes: insightsByName.impressions || 0,
      plays: insightsByName.plays || 0,
      engajamento_taxa: engagementRate,
      raw: { media: m, insights: insightsByName },
      fetched_at: new Date().toISOString(),
    })
  }

  if (rows.length) {
    const { error } = await supabase
      .from('instagram_posts')
      .upsert(rows, { onConflict: 'ig_post_id' })
    if (error) throw new Error('upsert posts: ' + error.message)
  }
  return rows
}
