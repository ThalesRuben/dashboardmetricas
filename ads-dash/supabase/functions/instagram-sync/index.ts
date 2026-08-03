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

const GRAPH = 'https://graph.facebook.com/v22.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  if (!IG_TOKEN || !IG_USER_ID) {
    return json({ error: 'IG_ACCESS_TOKEN ou IG_BUSINESS_ACCOUNT_ID não configurados' }, 400)
  }

  // Modo discover: dado um ?discover_handle=nome (sem @), usa
  // business_discovery pra devolver o ig_user_id da conta.
  // Só funciona pra contas Business/Creator ligadas ao MESMO Meta Business
  // Manager do IG_BUSINESS_ACCOUNT_ID atual.
  try {
    const url = new URL(req.url)
    const handle = url.searchParams.get('discover_handle')?.replace(/^@/, '')
    if (handle) {
      const res = await ig(IG_USER_ID, {
        fields: `business_discovery.username(${handle}){id,username,followers_count,media_count}`,
      })
      const found = res.business_discovery
      if (!found) return json({ error: `Nada encontrado pra @${handle}` }, 404)
      return json({
        ig_user_id: found.id,
        username:   '@' + found.username,
        seguidores: found.followers_count,
        posts:      found.media_count,
      })
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return json({ error: `discover: ${msg}` }, 502)
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

  // Multi-conta: itera sobre todas as instagram_accounts ativas.
  // Fallback pro IG_USER_ID do env se a tabela estiver vazia (compat com
  // deploys anteriores). Pode focar em uma conta específica via
  // ?ig_user_id=xxx (útil pro botão manual "Sincronizar" da UI).
  try {
    const url = new URL(req.url)
    const focusId = url.searchParams.get('ig_user_id')

    let accountsToSync: Array<{ ig_user_id: string; username: string }> = []
    if (focusId) {
      const { data: row } = await supabase
        .from('instagram_accounts')
        .select('ig_user_id, username')
        .eq('ig_user_id', focusId)
        .maybeSingle()
      accountsToSync = [{ ig_user_id: focusId, username: row?.username ?? '' }]
    } else {
      const { data: rows, error } = await supabase
        .from('instagram_accounts')
        .select('ig_user_id, username')
        .eq('active', true)
      if (error) throw new Error('list accounts: ' + error.message)
      accountsToSync = (rows && rows.length > 0)
        ? rows
        : [{ ig_user_id: IG_USER_ID, username: '' }]
    }

    const results = []
    for (const acc of accountsToSync) {
      try {
        const account = await syncAccount(supabase, acc.ig_user_id)
        const posts   = await syncPosts(supabase, acc.ig_user_id)
        results.push({
          ig_user_id:    acc.ig_user_id,
          username:      account.username,
          mode:          'admin',
          ok:            true,
          posts_saved:   posts.length,
          seguidores:    account.seguidores,
          alcance_dia:   account.alcance_dia,
          impressoes_dia:account.impressoes_dia,
          visitas_perfil:account.visitas_perfil,
          cliques_site:  account.cliques_site,
          insights_errors: (account.payload as any)?.insightsErrors ?? [],
        })
      } catch (adminErr) {
        // Fallback: token não tem admin nessa conta → tenta business_discovery
        // com o handle vindo da tabela. Não traz insights privados (reach,
        // views, cliques) mas grava seguidores + posts públicos.
        const adminMsg = adminErr instanceof Error ? adminErr.message : String(adminErr)
        const handle = acc.username?.replace(/^@/, '')
        if (!handle) {
          results.push({ ig_user_id: acc.ig_user_id, ok: false, error: adminMsg })
          continue
        }
        try {
          const bd = await syncViaBusinessDiscovery(supabase, acc.ig_user_id, handle)
          results.push({
            ig_user_id:  acc.ig_user_id,
            username:    bd.username,
            mode:        'public',
            ok:          true,
            posts_saved: bd.posts,
            seguidores:  bd.seguidores,
            note:        'sem admin no Meta Business — só dados públicos (sem reach/views/cliques)',
          })
        } catch (bdErr) {
          const bdMsg = bdErr instanceof Error ? bdErr.message : String(bdErr)
          results.push({
            ig_user_id: acc.ig_user_id,
            ok: false,
            error: `admin: ${adminMsg} | discovery: ${bdMsg}`,
          })
        }
      }
    }

    const oks = results.filter(r => r.ok).length
    return json({
      message: `Sincronização concluída — ${oks}/${results.length} conta(s) ok.`,
      total: results.length,
      results,
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

// Fallback pra contas que o token não administra: usa business_discovery
// via IG_USER_ID (a conta principal do Meta Business). Grava seguidores +
// posts públicos, sem insights privados.
async function syncViaBusinessDiscovery(
  supabase: ReturnType<typeof createClient>,
  igUserId: string,
  handle: string,
) {
  const res = await ig(IG_USER_ID, {
    fields: `business_discovery.username(${handle}){id,username,followers_count,follows_count,media_count,media.limit(25){id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count}}`,
  })
  const bd = res.business_discovery
  if (!bd) throw new Error(`business_discovery vazio pra @${handle}`)

  const today = new Date().toISOString().slice(0, 10)
  const accountRow = {
    date: today,
    ig_user_id: igUserId,
    username: '@' + bd.username,
    seguidores: bd.followers_count || 0,
    seguindo:   bd.follows_count   || 0,
    total_posts: bd.media_count    || 0,
    alcance_dia: 0,
    impressoes_dia: 0,
    visitas_perfil: 0,
    cliques_site: 0,
    payload: { business_discovery: bd, source_mode: 'public' },
    source: 'business_discovery',
  }
  const { error: accErr } = await supabase
    .from('instagram_account_metrics')
    .upsert(accountRow, { onConflict: 'date,ig_user_id' })
  if (accErr) throw new Error('upsert account (bd): ' + accErr.message)

  const media = bd.media?.data || []
  const rows = media.map((m: any) => {
    const tipo = m.media_type === 'VIDEO' ? 'REEL' : (m.media_type || 'IMAGE')
    return {
      ig_post_id: m.id,
      ig_user_id: igUserId,
      tipo,
      caption: m.caption?.slice(0, 500) || null,
      media_url: m.media_url || null,
      thumbnail_url: m.thumbnail_url || m.media_url || null,
      permalink: m.permalink || null,
      publicado_em: m.timestamp,
      curtidas: m.like_count || 0,
      comentarios: m.comments_count || 0,
      salvamentos: 0,
      compartilhamentos: 0,
      alcance: 0,
      impressoes: 0,
      plays: 0,
      engajamento_taxa: 0,
      raw: { media: m, source_mode: 'public' },
      fetched_at: new Date().toISOString(),
    }
  })
  if (rows.length) {
    const { error } = await supabase
      .from('instagram_posts')
      .upsert(rows, { onConflict: 'ig_post_id' })
    if (error) throw new Error('upsert posts (bd): ' + error.message)
  }
  return { username: '@' + bd.username, seguidores: bd.followers_count || 0, posts: rows.length }
}

async function syncAccount(supabase: ReturnType<typeof createClient>, igUserId: string) {
  const profile = await ig(igUserId, {
    fields: 'username,followers_count,follows_count,media_count',
  })

  // A partir da Graph API v22, métricas agregadas do account exigem
  // metric_type=total_value e o valor sai em `total_value.value` em vez de
  // `values[0].value`. `impressions` foi descontinuado; usa `views`.
  const insightsErrors: string[] = []
  const insights: any = { data: [] }

  async function tryMetric(metric: string) {
    try {
      const res = await ig(`${igUserId}/insights`, {
        metric,
        period: 'day',
        metric_type: 'total_value',
      })
      if (Array.isArray(res.data)) insights.data.push(...res.data)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      insightsErrors.push(`${metric}: ${msg}`)
      console.error(`[instagram-sync] insight "${metric}" failed pra ${igUserId}:`, msg)
    }
  }

  await tryMetric('reach')
  await tryMetric('views')
  await tryMetric('profile_views')
  await tryMetric('website_clicks')

  const getMetric = (name: string) => {
    const item = insights.data.find((x: any) => x.name === name)
    return item?.total_value?.value ?? item?.values?.[0]?.value ?? 0
  }

  const today = new Date().toISOString().slice(0, 10)
  const row = {
    date: today,
    ig_user_id: igUserId,
    username: '@' + profile.username,
    seguidores: profile.followers_count || 0,
    seguindo:   profile.follows_count   || 0,
    total_posts: profile.media_count    || 0,
    alcance_dia:    getMetric('reach'),
    impressoes_dia: getMetric('views'),
    visitas_perfil: getMetric('profile_views'),
    cliques_site:   getMetric('website_clicks'),
    payload: { profile, insights, insightsErrors },
    source: 'api',
  }

  const { error } = await supabase
    .from('instagram_account_metrics')
    .upsert(row, { onConflict: 'date,ig_user_id' })

  if (error) throw new Error('upsert account: ' + error.message)
  return row
}

async function syncPosts(supabase: ReturnType<typeof createClient>, igUserId: string) {
  const media = await ig(`${igUserId}/media`, {
    fields: 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count',
    limit: '25',
  })

  const rows: any[] = []
  for (const m of media.data || []) {
    let insightsByName: Record<string, number> = {}
    // v22: `impressions` e `plays` foram unificados em `views`. Se pedirmos uma
    // métrica inválida, o request inteiro é rejeitado — por isso pedimos uma
    // por vez e tolerâmos falhas individuais.
    const metricList = ['reach', 'views', 'likes', 'comments', 'shares', 'saved']
    for (const metric of metricList) {
      try {
        const ins = await ig(`${m.id}/insights`, { metric })
        for (const x of ins.data || []) {
          const value = x.total_value?.value ?? x.values?.[0]?.value ?? 0
          insightsByName[x.name] = value
        }
      } catch (_) { /* posts muito antigos ou sem permissão — ignora */ }
    }

    const tipo = m.media_type === 'VIDEO' ? 'REEL' : (m.media_type || 'IMAGE')
    const reach = insightsByName.reach || 0
    const likes = insightsByName.likes ?? m.like_count ?? 0
    const comments = insightsByName.comments ?? m.comments_count ?? 0
    const saved = insightsByName.saved || 0
    const shares = insightsByName.shares || 0
    const views = insightsByName.views || 0
    const engagementRate = reach > 0
      ? +(((likes + comments + saved + shares) / reach) * 100).toFixed(2)
      : 0

    rows.push({
      ig_post_id: m.id,
      ig_user_id: igUserId,
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
      impressoes: views,
      plays: views,
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
