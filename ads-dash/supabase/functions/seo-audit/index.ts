// Supabase Edge Function — seo-audit
//
// Faz auditoria on-page do site do tenant e grava em seo_snapshots.payload.auditoria
// via RPC seo_snapshot_merge (não sobrescreve dados do gsc-sync).
//
// Checks:
//   1. Velocidade mobile (LCP) via PageSpeed Insights API
//   2. Meta descriptions   (fetch HTML + parse)
//   3. Títulos H1 únicos   (fetch HTML + parse)
//   4. Imagens com alt     (fetch HTML + parse)
//   5. Sitemap indexação   (HEAD /sitemap.xml + count links)
//
// Secrets (Supabase → Edge Functions → Secrets):
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//   PAGESPEED_API_KEY   — https://console.cloud.google.com/apis/library/pagespeedonline.googleapis.com
//   SEO_AUDIT_HOME      — ex: https://theblondeconcept.com.br
//   SEO_AUDIT_TENANT_ID — mesmo tenant que GSC_TENANT_ID
//   SEO_AUDIT_PATHS     — (opcional) JSON array de paths extras, ex: ["/servicos","/agende"]
//
// Deploy:
//   supabase functions deploy seo-audit --no-verify-jwt
//
// Invocação: POST sem body ou com { "extraPaths": ["/blog"] }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { DOMParser } from 'https://deno.land/x/deno_dom@v0.1.46/deno-dom-wasm.ts'

const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY      = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const PSI_KEY          = Deno.env.get('PAGESPEED_API_KEY')!
const SITE_HOME        = (Deno.env.get('SEO_AUDIT_HOME') ?? '').replace(/\/+$/, '')
const TENANT_ID        = Deno.env.get('SEO_AUDIT_TENANT_ID')!
const EXTRA_PATHS_ENV  = Deno.env.get('SEO_AUDIT_PATHS') ?? '[]'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface AuditItem {
  item: string
  status: 'ok' | 'alerta' | 'erro'
  nota: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  if (!PSI_KEY || !SITE_HOME || !TENANT_ID) {
    return json({ error: 'PAGESPEED_API_KEY / SEO_AUDIT_HOME / SEO_AUDIT_TENANT_ID ausentes' }, 400)
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

  const { data: logRow } = await supabase.from('seo_sync_log')
    .insert({ tenant_id: TENANT_ID, source: 'psi' })
    .select().single()

  try {
    const body = await safeJson(req)
    const extraFromEnv = safeParseArray(EXTRA_PATHS_ENV)
    const extra = [...extraFromEnv, ...(body.extraPaths ?? [])]
    const paths = ['/', ...extra.map(p => p.startsWith('/') ? p : `/${p}`)]
    const urls  = paths.map(p => `${SITE_HOME}${p === '/' ? '' : p}`)

    // 1. PSI (só da home) — resiliente: se falhar, marca alerta e segue.
    const psi = await runPSISafe(urls[0])

    // 2-4. Parse HTML de cada página
    const htmlChecks = await Promise.all(urls.map(u => fetchAndParse(u).catch(err => ({
      url: u, ok: false as const, error: String(err),
      metaDescription: false as const, h1Count: 0 as const, imgs: 0 as const, imgsSemAlt: 0 as const,
      spaLikely: false as const,
    }))))
    const ok  = htmlChecks.filter(h => h.ok) as PageCheck[]
    const bad = htmlChecks.filter(h => !h.ok) as PageFail[]

    const spaPages = ok.filter(h => h.spaLikely).length
    const spaAll = ok.length > 0 && spaPages === ok.length

    const semMeta = ok.filter(h => !h.metaDescription).length
    const h1Bad   = ok.filter(h => h.h1Count !== 1).length
    const imgs    = ok.reduce((s, h) => s + h.imgs, 0)
    const imgsSemAlt = ok.reduce((s, h) => s + h.imgsSemAlt, 0)
    const pctSemAlt  = imgs > 0 ? (imgsSemAlt / imgs) * 100 : 0

    // 5. Sitemap
    const sitemap = await checkSitemap(SITE_HOME)

    const auditoria: AuditItem[] = [
      psiItem(psi),
      ...(spaAll ? [spaItem(ok.length)] : []),
      metaDescItem(semMeta, ok.length, spaAll),
      h1Item(h1Bad, ok.length, spaAll),
      altItem(imgs, imgsSemAlt, pctSemAlt, spaAll),
      sitemapItem(sitemap),
    ]

    // 6. Merge no snapshot do dia
    const today = new Date().toISOString().slice(0, 10)
    const patch = {
      auditoria,
      audit: {
        audited_at: new Date().toISOString(),
        urls_checked: urls,
        urls_failed: bad.map(b => ({ url: b.url, error: b.error })),
        spa_detected: spaAll,
        spa_pages: spaPages,
        psi: { lcp_ms: psi.lcp_ms, cls: psi.cls, inp_ms: psi.inp_ms, score: psi.score },
      },
    }
    const { error: mergeErr } = await supabase.rpc('seo_snapshot_merge', {
      p_tenant_id: TENANT_ID,
      p_date:      today,
      p_patch:     patch,
      p_score:     null,
    })
    if (mergeErr) throw new Error(`seo_snapshot_merge: ${mergeErr.message}`)

    await supabase.from('seo_sync_log').update({
      finished_at: new Date().toISOString(),
      status: 'ok',
      rows_upserted: 1,
      raw: patch as unknown,
    }).eq('id', logRow!.id)

    return json({ ok: true, auditoria, checked: urls.length, failed: bad.length })
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

// ---------- PageSpeed Insights ----------

interface PsiResult {
  lcp_ms: number | null
  cls: number | null
  inp_ms: number | null
  score: number | null
  error?: string
}

async function runPSISafe(url: string): Promise<PsiResult> {
  // 1a tentativa: mobile. Se falhar, tenta desktop (Lighthouse às vezes engasga com um mas não com o outro).
  for (const strategy of ['mobile', 'desktop'] as const) {
    try {
      return await runPSI(url, strategy)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      // se for erro de auth/quota, não adianta tentar outro strategy
      if (/^PSI (401|403|429)/.test(msg)) {
        return { lcp_ms: null, cls: null, inp_ms: null, score: null, error: msg }
      }
      if (strategy === 'desktop') {
        return { lcp_ms: null, cls: null, inp_ms: null, score: null, error: msg }
      }
    }
  }
  return { lcp_ms: null, cls: null, inp_ms: null, score: null, error: 'PSI: unknown' }
}

async function runPSI(url: string, strategy: 'mobile' | 'desktop'): Promise<PsiResult> {
  const api = new URL('https://www.googleapis.com/pagespeedonline/v5/runPagespeed')
  api.searchParams.set('url', url)
  api.searchParams.set('strategy', strategy)
  api.searchParams.set('category', 'performance')
  api.searchParams.set('key', PSI_KEY)

  const res = await fetch(api.toString())
  const j: unknown = await res.json()
  if (!res.ok) throw new Error(`PSI ${res.status}: ${(j as { error?: { message?: string } }).error?.message ?? 'unknown'}`)

  const jj = j as {
    lighthouseResult?: {
      audits?: Record<string, { numericValue?: number }>
      categories?: { performance?: { score?: number } }
    }
  }
  const audits = jj.lighthouseResult?.audits ?? {}
  return {
    lcp_ms: audits['largest-contentful-paint']?.numericValue ?? null,
    cls:    audits['cumulative-layout-shift']?.numericValue ?? null,
    inp_ms: audits['interaction-to-next-paint']?.numericValue
           ?? audits['experimental-interaction-to-next-paint']?.numericValue
           ?? null,
    score:  jj.lighthouseResult?.categories?.performance?.score != null
              ? Math.round((jj.lighthouseResult.categories.performance.score as number) * 100)
              : null,
  }
}

function psiItem(psi: PsiResult): AuditItem {
  if (psi.lcp_ms == null) {
    return {
      item: 'Velocidade de carregamento (mobile)',
      status: 'alerta',
      nota: psi.error ? `PageSpeed falhou: ${psi.error}` : 'PageSpeed sem resposta — checar depois.',
    }
  }
  const lcpS = (psi.lcp_ms / 1000).toFixed(1)
  if (psi.lcp_ms <= 2500) return { item: 'Velocidade de carregamento (mobile)', status: 'ok',     nota: `LCP ${lcpS}s — dentro do recomendado (score PSI ${psi.score ?? '—'}).` }
  if (psi.lcp_ms <= 4000) return { item: 'Velocidade de carregamento (mobile)', status: 'alerta', nota: `LCP ${lcpS}s — precisa melhorar (score PSI ${psi.score ?? '—'}).` }
  return                    { item: 'Velocidade de carregamento (mobile)', status: 'erro',   nota: `LCP ${lcpS}s — muito alto (score PSI ${psi.score ?? '—'}).` }
}

// ---------- HTML fetch + parse leve ----------

interface PageCheck {
  url: string
  ok: true
  metaDescription: boolean
  h1Count: number
  imgs: number
  imgsSemAlt: number
  spaLikely: boolean
}
interface PageFail { url: string; ok: false; error: string; metaDescription: false; h1Count: 0; imgs: 0; imgsSemAlt: 0; spaLikely: false }

async function fetchAndParse(url: string): Promise<PageCheck | PageFail> {
  const res = await fetch(url, {
    redirect: 'follow',
    headers: { 'User-Agent': 'ads-dash-seo-audit/1.0' },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const html = await res.text()

  const doc = new DOMParser().parseFromString(html, 'text/html')
  if (!doc) throw new Error('parse falhou (HTML inválido)')

  // Meta description: só conta se tem conteúdo não vazio.
  const metaEl = doc.querySelector('meta[name="description"]')
  const metaDescription = !!metaEl?.getAttribute('content')?.trim()

  // H1 (count real, inclui aria-hidden também — não discrimina, igual Google).
  const h1Count = doc.querySelectorAll('h1').length

  // Imagens: ignora <img> dentro de <picture><source>, data-URIs, decorativas (alt="").
  // Mas conta "sem alt" se não tem atributo alt nenhum.
  const imgEls = Array.from(doc.querySelectorAll('img'))
  const imgs = imgEls.length
  const imgsSemAlt = imgEls.filter(el => {
    const alt = el.getAttribute('alt')
    return alt === null   // atributo ausente = problema
  }).length

  // Detecção de SPA: body com estrutura mínima + root vazio + poucos H1/imgs renderizados.
  // (Com SSR/SSG o body vem preenchido. Com Vite/CRA puro, aparece um #root vazio.)
  const bodyText = doc.body?.textContent?.trim().length ?? 0
  const rootEmpty = !!doc.querySelector('#root:empty, #app:empty, #__next:empty')
  const spaLikely = rootEmpty || (bodyText < 200 && imgs === 0 && h1Count === 0)

  return {
    url, ok: true,
    metaDescription,
    h1Count,
    imgs,
    imgsSemAlt,
    spaLikely,
  }
}

function spaItem(total: number): AuditItem {
  return {
    item: 'Renderização do HTML (SSR)',
    status: 'alerta',
    nota: `Todas as ${total} páginas auditadas parecem SPA sem SSR — o HTML cru não traz conteúdo. Meta/H1/alt abaixo são inconclusivos. Considere SSR/SSG.`,
  }
}

function metaDescItem(sem: number, total: number, spa = false): AuditItem {
  if (total === 0) return { item: 'Meta descriptions', status: 'alerta', nota: 'Nenhuma página auditada respondeu.' }
  if (spa)         return { item: 'Meta descriptions', status: 'alerta', nota: 'Não aferível no HTML cru (SPA sem SSR).' }
  if (sem === 0)   return { item: 'Meta descriptions', status: 'ok',     nota: `Todas as ${total} páginas com meta description.` }
  if (sem / total < 0.5) return { item: 'Meta descriptions', status: 'alerta', nota: `${sem} de ${total} páginas sem meta description.` }
  return                   { item: 'Meta descriptions', status: 'erro',   nota: `${sem} de ${total} páginas sem meta description.` }
}

function h1Item(bad: number, total: number, spa = false): AuditItem {
  if (total === 0) return { item: 'Títulos H1 únicos', status: 'alerta', nota: 'Nenhuma página auditada respondeu.' }
  if (spa)         return { item: 'Títulos H1 únicos', status: 'alerta', nota: 'Não aferível no HTML cru (SPA sem SSR).' }
  if (bad === 0)   return { item: 'Títulos H1 únicos', status: 'ok',     nota: `Todas as ${total} páginas com H1 único.` }
  return               { item: 'Títulos H1 únicos', status: 'alerta', nota: `${bad} de ${total} páginas com 0 ou mais de 1 H1.` }
}

function altItem(imgs: number, semAlt: number, pct: number, spa = false): AuditItem {
  if (spa && imgs === 0) return { item: 'Imagens com texto alternativo (alt)', status: 'alerta', nota: 'Não aferível no HTML cru (SPA sem SSR).' }
  if (imgs === 0)      return { item: 'Imagens com texto alternativo (alt)', status: 'ok',     nota: 'Nenhuma imagem encontrada nas páginas auditadas.' }
  if (semAlt === 0)    return { item: 'Imagens com texto alternativo (alt)', status: 'ok',     nota: `${imgs} imagens, todas com alt.` }
  if (pct <= 30)       return { item: 'Imagens com texto alternativo (alt)', status: 'alerta', nota: `${pct.toFixed(0)}% das imagens sem atributo alt (${semAlt}/${imgs}).` }
  return                    { item: 'Imagens com texto alternativo (alt)', status: 'erro',   nota: `${pct.toFixed(0)}% das imagens sem atributo alt (${semAlt}/${imgs}).` }
}

// ---------- Sitemap ----------

interface SitemapCheck { status: number; urls: number | null; robotsOk: boolean }

async function checkSitemap(home: string): Promise<SitemapCheck> {
  const sm = await fetch(`${home}/sitemap.xml`, { redirect: 'follow' }).catch(() => null)
  const rb = await fetch(`${home}/robots.txt`,  { redirect: 'follow' }).catch(() => null)
  let urls: number | null = null
  if (sm && sm.ok) {
    const txt = await sm.text().catch(() => '')
    urls = (txt.match(/<loc>/gi) ?? []).length
  }
  return { status: sm?.status ?? 0, urls, robotsOk: !!rb?.ok }
}

function sitemapItem(s: SitemapCheck): AuditItem {
  if (s.status !== 200) return { item: 'Sitemap e indexação', status: 'erro',   nota: `sitemap.xml retornou ${s.status || 'erro'}.` }
  return                    { item: 'Sitemap e indexação', status: 'ok',     nota: `Sitemap OK — ${s.urls ?? '?'} URLs listadas${s.robotsOk ? '' : ' (robots.txt ausente)'}.` }
}

// ---------- utils ----------

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function safeJson(req: Request): Promise<{ extraPaths?: string[] }> {
  try { return await req.json() } catch { return {} }
}

function safeParseArray(s: string): string[] {
  try {
    const parsed = JSON.parse(s)
    return Array.isArray(parsed) ? parsed.filter(x => typeof x === 'string') : []
  } catch { return [] }
}
