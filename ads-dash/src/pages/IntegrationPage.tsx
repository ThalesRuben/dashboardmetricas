import { useCallback, useEffect, useRef, useState } from 'react'
import { saveDailyMetrics } from '@/features/ads/hooks/useMetrics'
import { useMetricsContext } from '@/app/providers/MetricsContext'
import { useToast } from '@/app/providers/ToastContext'
import { supabase, invokeFunction } from '@/shared/lib/supabase'
import PageHeader from '@/components/ui/PageHeader'
import styles from './IntegrationPage.module.css'

// ─────────────────────────────────────────────────────────────
// Central de sincronização.
// Mostra o estado real de cada origem de dados que abastece o dashboard.
// Nenhum OAuth simulado — cada origem tem seu próprio caminho de ingestão.
// ─────────────────────────────────────────────────────────────

type OriginKey = 'instagram' | 'whatsapp' | 'meta' | 'google' | 'tiktok' | 'youtube'
type Freshness = 'fresh' | 'stale' | 'empty' | 'error'

interface OriginStatus {
  key: string                      // ex: "instagram" ou "whatsapp:5531990842381"
  origin: OriginKey
  label: string
  sub: string                      // linha secundária (última data / contato)
  metric: string | null            // KPI resumo (seguidores, threads, etc.)
  metricLabel: string | null
  freshness: Freshness
}

interface OriginConfig {
  origin: OriginKey
  label: string
  ingressao: string                // como o dado chega
  ver?: string                     // rota interna pra ver os dados
}

const CONFIG: Record<OriginKey, OriginConfig> = {
  instagram: {
    origin: 'instagram',
    label: 'Instagram',
    ingressao: 'Edge Function `instagram-sync` chama a Meta Graph API.',
    ver: '/instagram',
  },
  whatsapp: {
    origin: 'whatsapp',
    label: 'WhatsApp Business',
    ingressao: 'n8n recebe da Cloud API e posta em `inbox-ingest`.',
    ver: '/whatsapp',
  },
  meta: {
    origin: 'meta',
    label: 'Meta Ads',
    ingressao: 'Entrada manual dos números do Ads Manager.',
    ver: '/',
  },
  google: {
    origin: 'google',
    label: 'Google Ads',
    ingressao: 'Entrada manual dos números do Google Ads.',
    ver: '/',
  },
  tiktok: {
    origin: 'tiktok',
    label: 'TikTok',
    ingressao: 'Seed / entrada manual — sem sincronização automática.',
    ver: '/tiktok',
  },
  youtube: {
    origin: 'youtube',
    label: 'YouTube',
    ingressao: 'Seed / entrada manual — sem sincronização automática.',
    ver: '/youtube',
  },
}

function timeAgo(iso: string | null | undefined): string {
  if (!iso) return 'sem dados'
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return 'sem dados'
  const diff = Date.now() - t
  const mins = Math.round(diff / 60000)
  if (mins < 1) return 'agora mesmo'
  if (mins < 60) return `há ${mins} min`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `há ${hours}h`
  const days = Math.round(hours / 24)
  if (days < 30) return `há ${days} dia${days > 1 ? 's' : ''}`
  const months = Math.round(days / 30)
  return `há ${months} mês${months > 1 ? 'es' : ''}`
}

function ageFreshness(iso: string | null | undefined, staleAfterHours: number): Freshness {
  if (!iso) return 'empty'
  const diffH = (Date.now() - new Date(iso).getTime()) / 3_600_000
  if (Number.isNaN(diffH)) return 'empty'
  return diffH <= staleAfterHours ? 'fresh' : 'stale'
}

function formatNumber(n: number | null | undefined): string {
  if (n == null) return '—'
  return n.toLocaleString('pt-BR')
}

// ─────────────────────────────────────────────────────────────
// Consulta ao vivo de todas as origens em paralelo.
// Tolerante a erro: cada origem falha isolada.
// ─────────────────────────────────────────────────────────────
async function fetchAllOrigins(): Promise<OriginStatus[]> {
  const out: OriginStatus[] = []

  // Instagram
  try {
    const { data, error } = await supabase
      .from('instagram_account_metrics')
      .select('date, seguidores, username')
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) throw error
    out.push({
      key: 'instagram',
      origin: 'instagram',
      label: CONFIG.instagram.label,
      sub: data?.username ? `${data.username} · ${timeAgo(data.date)}` : timeAgo(data?.date),
      metric: data?.seguidores != null ? formatNumber(data.seguidores) : null,
      metricLabel: 'seguidores',
      freshness: ageFreshness(data?.date, 30),
    })
  } catch {
    out.push({
      key: 'instagram',
      origin: 'instagram',
      label: CONFIG.instagram.label,
      sub: 'não foi possível ler os dados',
      metric: null,
      metricLabel: null,
      freshness: 'error',
    })
  }

  // WhatsApp — uma linha por inbox
  try {
    const { data, error } = await supabase.rpc('list_whatsapp_inboxes')
    if (error) throw error
    const inboxes = (data ?? []) as Array<{ inbox_phone: string; threads: number; ultima_atividade: string }>
    if (inboxes.length === 0) {
      out.push({
        key: 'whatsapp:empty',
        origin: 'whatsapp',
        label: CONFIG.whatsapp.label,
        sub: 'nenhuma inbox recebeu mensagens ainda',
        metric: null,
        metricLabel: null,
        freshness: 'empty',
      })
    } else {
      for (const ib of inboxes) {
        out.push({
          key: `whatsapp:${ib.inbox_phone}`,
          origin: 'whatsapp',
          label: `${CONFIG.whatsapp.label} · +${ib.inbox_phone}`,
          sub: `última atividade ${timeAgo(ib.ultima_atividade)}`,
          metric: formatNumber(ib.threads),
          metricLabel: 'conversas',
          freshness: ageFreshness(ib.ultima_atividade, 24),
        })
      }
    }
  } catch {
    out.push({
      key: 'whatsapp:error',
      origin: 'whatsapp',
      label: CONFIG.whatsapp.label,
      sub: 'não foi possível ler as inboxes',
      metric: null,
      metricLabel: null,
      freshness: 'error',
    })
  }

  // Meta / Google Ads — última linha em daily_metrics
  try {
    const { data, error } = await supabase
      .from('daily_metrics')
      .select('date, period, payload, source, created_at')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) throw error
    const ref = data?.date || data?.created_at
    const investido = (data?.payload as { investimento?: number } | null)?.investimento
    const receita = (data?.payload as { receita?: number } | null)?.receita
    const kpi = investido != null && receita != null
      ? `R$ ${formatNumber(receita)} / ${formatNumber(investido)}`
      : null

    for (const key of ['meta', 'google'] as const) {
      out.push({
        key,
        origin: key,
        label: CONFIG[key].label,
        sub: ref ? `último registro ${timeAgo(ref)}` : 'sem registros',
        metric: kpi,
        metricLabel: kpi ? 'receita / invest.' : null,
        freshness: ageFreshness(ref, 48),
      })
    }
  } catch {
    for (const key of ['meta', 'google'] as const) {
      out.push({
        key,
        origin: key,
        label: CONFIG[key].label,
        sub: 'não foi possível ler daily_metrics',
        metric: null,
        metricLabel: null,
        freshness: 'error',
      })
    }
  }

  // TikTok
  try {
    const { data, error } = await supabase
      .from('tiktok_account_metrics')
      .select('date, seguidores')
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) throw error
    out.push({
      key: 'tiktok',
      origin: 'tiktok',
      label: CONFIG.tiktok.label,
      sub: data ? `snapshot ${timeAgo(data.date)}` : 'sem snapshots',
      metric: data?.seguidores != null ? formatNumber(data.seguidores) : null,
      metricLabel: 'seguidores',
      freshness: ageFreshness(data?.date, 30 * 24),
    })
  } catch {
    out.push({
      key: 'tiktok',
      origin: 'tiktok',
      label: CONFIG.tiktok.label,
      sub: 'tabela não disponível',
      metric: null,
      metricLabel: null,
      freshness: 'error',
    })
  }

  // YouTube
  try {
    const { data, error } = await supabase
      .from('youtube_channel_metrics')
      .select('date, inscritos')
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) throw error
    out.push({
      key: 'youtube',
      origin: 'youtube',
      label: CONFIG.youtube.label,
      sub: data ? `snapshot ${timeAgo(data.date)}` : 'sem snapshots',
      metric: data?.inscritos != null ? formatNumber(data.inscritos) : null,
      metricLabel: 'inscritos',
      freshness: ageFreshness(data?.date, 30 * 24),
    })
  } catch {
    out.push({
      key: 'youtube',
      origin: 'youtube',
      label: CONFIG.youtube.label,
      sub: 'tabela não disponível',
      metric: null,
      metricLabel: null,
      freshness: 'error',
    })
  }

  return out
}

export default function IntegrationPage() {
  const toast = useToast()
  const [origins, setOrigins] = useState<OriginStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [syncingIg, setSyncingIg] = useState(false)
  const manualRef = useRef<HTMLDivElement | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const data = await fetchAllOrigins()
    setOrigins(data)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function syncInstagram() {
    setSyncingIg(true)
    try {
      const { data, error } = await invokeFunction<{ message?: string; posts_saved?: number; error?: string }>(
        'instagram-sync',
      )
      if (error) throw error
      if (data?.error) throw new Error(data.error)
      toast.success(
        data?.message
          ? `${data.message}${data.posts_saved != null ? ` ${data.posts_saved} posts atualizados.` : ''}`
          : 'Sincronização iniciada.',
      )
      await load()
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'erro desconhecido'
      toast.error(`Falha na sincronização: ${msg}`, {
        title: 'Instagram',
      })
    } finally {
      setSyncingIg(false)
    }
  }

  function scrollToManual() {
    manualRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const withData = origins.filter(o => o.freshness === 'fresh' || o.freshness === 'stale').length
  const total = origins.length

  return (
    <div className={styles.page}>
      <PageHeader
        section="integrations"
        title="Central de sincronização"
        subtitle={
          loading
            ? 'Lendo o estado real de cada origem…'
            : `${withData} de ${total} origens com dados recentes. Cada origem tem seu próprio caminho de ingestão — nada aqui pede senha de rede.`
        }
      />

      <div className={styles.grid}>
        {origins.map(o => (
          <OriginCard
            key={o.key}
            status={o}
            syncing={o.origin === 'instagram' && syncingIg}
            onSync={o.origin === 'instagram' ? syncInstagram : undefined}
            onManual={o.origin === 'meta' || o.origin === 'google' ? scrollToManual : undefined}
          />
        ))}
      </div>

      <p className={styles.privacy}>
        Sem OAuth simulado. Tokens de API (Meta Graph, WhatsApp Cloud) ficam no Supabase → Edge Functions → Secrets.
        Os números de Ads são registrados manualmente (Meta / Google não expõem OAuth simples para leitura de conta).
      </p>

      <div ref={manualRef} />
      <ManualEntry toast={toast} />
    </div>
  )
}

interface OriginCardProps {
  status: OriginStatus
  syncing: boolean
  onSync?: () => void
  onManual?: () => void
}

function OriginCard({ status, syncing, onSync, onManual }: OriginCardProps) {
  const cfg = CONFIG[status.origin]
  const dotClass =
    status.freshness === 'fresh'  ? styles.dotFresh  :
    status.freshness === 'stale'  ? styles.dotStale  :
    status.freshness === 'error'  ? styles.dotError  :
                                    styles.dotEmpty
  const freshLabel =
    status.freshness === 'fresh'  ? 'ao vivo' :
    status.freshness === 'stale'  ? 'defasado' :
    status.freshness === 'error'  ? 'erro'    :
                                    'sem dados'

  return (
    <div className={styles.originCard}>
      <div className={styles.originHead}>
        <span className={`${styles.originDot} ${dotClass}`} />
        <div className={styles.originId}>
          <div className={styles.originLabel}>{status.label}</div>
          <div className={styles.originFresh}>{freshLabel}</div>
        </div>
      </div>

      <div className={styles.originMetric}>
        <div className={styles.originValue}>{status.metric ?? '—'}</div>
        {status.metricLabel && <div className={styles.originValueLbl}>{status.metricLabel}</div>}
      </div>

      <div className={styles.originSub}>{status.sub}</div>
      <div className={styles.originIngress}>{cfg.ingressao}</div>

      <div className={styles.originActions}>
        {onSync && (
          <button
            className="btn btn--primary"
            onClick={onSync}
            disabled={syncing}
            style={{ flex: 1, justifyContent: 'center' }}
          >
            {syncing ? 'Sincronizando…' : 'Sincronizar agora'}
          </button>
        )}
        {onManual && (
          <button
            className="btn btn--primary"
            onClick={onManual}
            style={{ flex: 1, justifyContent: 'center' }}
          >
            Registrar dia
          </button>
        )}
        {!onSync && !onManual && cfg.ver && (
          <a href={cfg.ver} className={styles.originLink}>
            Ver dados →
          </a>
        )}
      </div>
    </div>
  )
}

function ManualEntry({ toast }) {
  const { loadAds } = useMetricsContext()
  const [manualData, setManualData] = useState({
    metaInvest: '', metaRevenue: '', metaImp: '', metaClk: '', metaMsgs: '', metaAgend: '',
    googleInvest: '', googleRevenue: '', googleImp: '', googleClk: '', googleConv: '', googleVendas: '',
  })
  const [saving, setSaving] = useState(false)
  const setField = (k, v) => setManualData(d => ({ ...d, [k]: v }))

  const n = k => parseFloat(manualData[k]) || 0
  const totalInvest  = n('metaInvest') + n('googleInvest')
  const totalRevenue = n('metaRevenue') + n('googleRevenue')
  const totalMsgs    = n('metaMsgs')
  const totalAgend   = n('metaAgend')
  const totalVendas  = n('googleVendas')
  const totalImp     = n('metaImp') + n('googleImp')
  const totalClk     = n('metaClk') + n('googleClk')
  const roas = totalInvest > 0 ? (totalRevenue / totalInvest).toFixed(2) : '—'
  const roi  = totalInvest > 0 ? Math.round(((totalRevenue - totalInvest) / totalInvest) * 100) + '%' : '—'
  const ctrMeta   = n('metaImp')   > 0 ? (n('metaClk')   / n('metaImp')   * 100).toFixed(2) + '%' : '—'
  const ctrGoogle = n('googleImp') > 0 ? (n('googleClk') / n('googleImp') * 100).toFixed(2) + '%' : '—'

  async function handleSaveManual() {
    if (totalInvest <= 0) { toast.error('Informe ao menos o investimento para salvar.'); return }
    setSaving(true)
    const payload = {
      roas: parseFloat(roas) || 0, roi: parseInt(roi) || 0,
      ctrMeta: parseFloat(ctrMeta) || 0, ctrGoogle: parseFloat(ctrGoogle) || 0,
      mensagens: totalMsgs, agendamentos: totalAgend, vendas: totalVendas,
      investimento: totalInvest, receita: totalRevenue,
      funil: { impressoes: totalImp, cliques: totalClk, mensagens: totalMsgs, agendamentos: totalAgend, vendas: totalVendas },
      campanhas: [],
      chartRoas: { labels: ['Meta Ads', 'Google Ads'], hoje: [parseFloat(ctrMeta) || 0, parseFloat(ctrGoogle) || 0], ontem: [0, 0] },
      chartConv: { labels: ['—'], mensagens: [totalMsgs], agendamentos: [totalAgend], vendas: [totalVendas] },
      chartCtr:  { labels: ['—'], meta: [parseFloat(ctrMeta) || 0], google: [parseFloat(ctrGoogle) || 0] },
      budget:    { meta: n('metaInvest'), google: n('googleInvest') },
    }
    const { error } = await saveDailyMetrics('hoje', payload, 'manual')
    setSaving(false)
    if (error) toast.error('Erro ao salvar: ' + (error.message || 'verifique a conexão.'))
    else { toast.success('Dados salvos! O dashboard foi atualizado.'); loadAds('hoje') }
  }

  return (
    <div className={styles.card} style={{ marginTop: 24 }}>
      <h2 className={styles.cardTitle}>Entrada manual — dados de hoje</h2>
      <div className={styles.infoBox}>Cole os números do Meta Ads Manager e do Google Ads. ROAS, ROI e CTR são calculados automaticamente.</div>

      <div className={styles.sectionLabel}>Meta Ads</div>
      <div className={styles.manualGrid}>
        <ManualField label="Investimento (R$)"   value={manualData.metaInvest}   onChange={v => setField('metaInvest', v)} />
        <ManualField label="Receita gerada (R$)" value={manualData.metaRevenue}  onChange={v => setField('metaRevenue', v)} />
        <ManualField label="Impressões"           value={manualData.metaImp}      onChange={v => setField('metaImp', v)} />
        <ManualField label="Cliques"              value={manualData.metaClk}      onChange={v => setField('metaClk', v)} />
        <ManualField label="Mensagens (CTWA)"     value={manualData.metaMsgs}     onChange={v => setField('metaMsgs', v)} />
        <ManualField label="Agendamentos"         value={manualData.metaAgend}    onChange={v => setField('metaAgend', v)} />
      </div>

      <div className={styles.divider} />
      <div className={styles.sectionLabel}>Google Ads</div>
      <div className={styles.manualGrid}>
        <ManualField label="Investimento (R$)"   value={manualData.googleInvest}   onChange={v => setField('googleInvest', v)} />
        <ManualField label="Receita gerada (R$)" value={manualData.googleRevenue}  onChange={v => setField('googleRevenue', v)} />
        <ManualField label="Impressões"           value={manualData.googleImp}      onChange={v => setField('googleImp', v)} />
        <ManualField label="Cliques"              value={manualData.googleClk}      onChange={v => setField('googleClk', v)} />
        <ManualField label="Conversões"           value={manualData.googleConv}     onChange={v => setField('googleConv', v)} />
        <ManualField label="Vendas aprovadas"     value={manualData.googleVendas}   onChange={v => setField('googleVendas', v)} />
      </div>

      <div className={styles.divider} />
      <div className={styles.sectionLabel}>Resultados calculados</div>
      <div className={styles.resultsGrid}>
        <Result label="ROAS total"    value={roas !== '—' ? roas + 'x' : '—'} highlight={roas !== '—'} />
        <Result label="ROI total"     value={roi} highlight={roi !== '—'} />
        <Result label="CTR Meta"      value={ctrMeta} />
        <Result label="CTR Google"    value={ctrGoogle} />
        <Result label="Invest. total" value={totalInvest > 0 ? 'R$' + totalInvest.toLocaleString('pt-BR') : '—'} />
        <Result label="Receita total" value={totalRevenue > 0 ? 'R$' + totalRevenue.toLocaleString('pt-BR') : '—'} />
      </div>

      <button onClick={handleSaveManual} disabled={saving || totalInvest <= 0} className={styles.saveBtn}>
        {saving ? 'Salvando...' : 'Salvar no dashboard'}
      </button>
    </div>
  )
}

function ManualField({ label, value, onChange }) {
  return (
    <div className={styles.manualField}>
      <label className={styles.manualLabel}>{label}</label>
      <input type="number" value={value} onChange={e => onChange(e.target.value)} placeholder="0" className={styles.manualInput} />
    </div>
  )
}

function Result({ label, value, highlight = false }) {
  return (
    <div className={styles.resultBox}>
      <div className={highlight ? styles.resultValHi : styles.resultVal}>{value}</div>
      <div className={styles.resultLbl}>{label}</div>
    </div>
  )
}
