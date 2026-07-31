import { useMemo, useState, type ReactNode } from 'react'
import Sparkline from '@/shared/ui/Sparkline'
import type { IgAccount, IgPost, IgDailyRow } from '@/app/providers/MetricsContext'
import styles from './IgPublicitySummary.module.css'

interface Props {
  account: IgAccount
  posts: IgPost[]
  daily: IgDailyRow[]
  onViewMore?: (kpiId: KpiId, sort: 'engaj' | 'plays' | 'recent' | 'reach') => void
}

type KpiId =
  | 'ganho_seguidores'
  | 'visualizadores'
  | 'engaj_post'
  | 'cliques_link'
  | 'engaj_pagina'
  | 'reproducoes'
  | 'compartilhamentos'
  | 'comentarios'
  | 'conversas'

const PERIODS = [
  { id: '30', label: 'Últimos 30 dias', days: 30 },
  { id: '60', label: 'Últimos 60 dias', days: 60 },
  { id: '7',  label: 'Últimos 7 dias',  days: 7 },
] as const

type PeriodId = typeof PERIODS[number]['id']

// Compact pt-BR (1_100_000 → "1,1 mi", 777_000 → "777 mil")
function fmtCompactBr(n: number): string {
  const v = Math.abs(n)
  if (v >= 1_000_000) {
    const s = (v / 1_000_000).toFixed(1).replace('.', ',')
    return `${s.endsWith(',0') ? s.slice(0, -2) : s} mi`
  }
  if (v >= 1_000) {
    const s = (v / 1_000).toFixed(1).replace('.', ',')
    return `${s.endsWith(',0') ? s.slice(0, -2) : s} mil`
  }
  return String(Math.round(v))
}

function periodLabel(days: number): string {
  const end = new Date()
  const start = new Date()
  start.setDate(end.getDate() - days + 1)
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }
  const s = start.toLocaleDateString('pt-BR', opts).replace('.', '')
  const e = end.toLocaleDateString('pt-BR', opts).replace('.', '')
  return `Últimos ${days} dias: ${s} a ${e}`
}

// Divide série em duas metades e compara para inferir delta%.
function deltaFromSeries(nums: number[]): number | null {
  if (!nums || nums.length < 4) return null
  const mid = Math.floor(nums.length / 2)
  const a = nums.slice(0, mid).reduce((s, v) => s + v, 0)
  const b = nums.slice(mid).reduce((s, v) => s + v, 0)
  if (a === 0 && b === 0) return null
  if (a === 0) return 100
  return +(((b - a) / a) * 100).toFixed(1)
}

// Bucketiza posts em N buckets no período e soma a métrica em cada bucket.
function seriesFromPosts(posts: IgPost[], days: number, metric: (p: IgPost) => number, buckets = 12): number[] {
  const now = Date.now()
  const start = now - days * 86_400_000
  const bucketMs = (days * 86_400_000) / buckets
  const arr = new Array(buckets).fill(0)
  for (const p of posts) {
    const t = new Date(p.publicado_em).getTime()
    if (isNaN(t) || t < start || t > now) continue
    const idx = Math.min(buckets - 1, Math.floor((t - start) / bucketMs))
    arr[idx] += metric(p) || 0
  }
  return arr
}

export default function IgPublicitySummary({ account, posts, daily, onViewMore }: Props) {
  const [periodId, setPeriodId] = useState<PeriodId>('30')
  const period = PERIODS.find(p => p.id === periodId)!
  const days = period.days

  const kpis = useMemo(() => {
    const now = Date.now()
    const windowMs = days * 86_400_000

    // --- daily rows dentro da janela ---
    const dailyInWindow = daily.filter(r => {
      const t = new Date(r.date).getTime()
      return !isNaN(t) && now - t <= windowMs
    })
    const sumDaily = (fn: (r: IgDailyRow) => number) => dailyInWindow.reduce((s, r) => s + (fn(r) || 0), 0)
    const seriesDaily = (fn: (r: IgDailyRow) => number) => dailyInWindow.map(fn)

    // --- posts dentro da janela ---
    const postsInWindow = posts.filter(p => {
      const t = new Date(p.publicado_em).getTime()
      return !isNaN(t) && now - t <= windowMs
    })
    const sumPosts = (fn: (p: IgPost) => number) => postsInWindow.reduce((s, p) => s + (fn(p) || 0), 0)

    const sEngaj = seriesFromPosts(postsInWindow, days, p => (p.curtidas || 0) + (p.comentarios || 0) + (p.salvamentos || 0) + (p.compartilhamentos || 0))
    const sPlays = seriesFromPosts(postsInWindow, days, p => p.plays || 0)
    const sShares = seriesFromPosts(postsInWindow, days, p => p.compartilhamentos || 0)
    const sComments = seriesFromPosts(postsInWindow, days, p => p.comentarios || 0)

    const sViews = seriesDaily(r => r.impressoes_dia)
    const sCliques = seriesDaily(r => r.cliques_site)
    const sVisitas = seriesDaily(r => r.visitas_perfil)
    const sMsg = seriesDaily(r => r.mensagens_ads || 0)
    const sSeguidores = seriesDaily(r => r.seguidores)

    // Ganho de seguidores no período (fim - início da janela)
    const seguidoresInicio = dailyInWindow[0]?.seguidores || 0
    const seguidoresFim = dailyInWindow[dailyInWindow.length - 1]?.seguidores || 0
    const ganhoSeguidores = seguidoresFim - seguidoresInicio
    const ganhoSeguidoresPct = seguidoresInicio
      ? +((ganhoSeguidores / seguidoresInicio) * 100).toFixed(2)
      : null

    return [
      {
        id: 'ganho_seguidores' as KpiId,
        label: 'Ganho de seguidores',
        tooltip: 'Diferença entre seguidores no fim e no início do período.',
        value: ganhoSeguidores,
        valueLabel: (ganhoSeguidores > 0 ? '+' : '') + fmtCompactBr(ganhoSeguidores),
        serie: sSeguidores,
        delta: ganhoSeguidoresPct,
        sortKey: 'recent' as const,
      },
      {
        id: 'visualizadores' as KpiId,
        label: 'Visualizadores',
        tooltip: 'Total de views (impressões) da conta no período — somado dos snapshots diários do Graph API.',
        value: sumDaily(r => r.impressoes_dia),
        serie: sViews,
        delta: deltaFromSeries(sViews),
        sortKey: 'reach' as const,
      },
      {
        id: 'engaj_post' as KpiId,
        label: 'Engajamentos com o post',
        tooltip: 'Curtidas + comentários + salvamentos + compartilhamentos dos posts publicados no período.',
        value: sumPosts(p => (p.curtidas || 0) + (p.comentarios || 0) + (p.salvamentos || 0) + (p.compartilhamentos || 0)),
        serie: sEngaj,
        delta: deltaFromSeries(sEngaj),
        sortKey: 'engaj' as const,
      },
      {
        id: 'cliques_link' as KpiId,
        label: 'Cliques no link',
        tooltip: 'Cliques no link da bio (site) — somado dos snapshots diários.',
        value: sumDaily(r => r.cliques_site),
        serie: sCliques,
        delta: deltaFromSeries(sCliques),
        sortKey: 'recent' as const,
      },
      {
        id: 'engaj_pagina' as KpiId,
        label: 'Engajamentos com a Página',
        tooltip: 'Visitas ao perfil — somado dos snapshots diários (proxy do Meta Business Suite).',
        value: sumDaily(r => r.visitas_perfil),
        serie: sVisitas,
        delta: deltaFromSeries(sVisitas),
        sortKey: 'recent' as const,
      },
      {
        id: 'reproducoes' as KpiId,
        label: 'Reproduções de vídeo',
        tooltip: 'Views dos reels/vídeos publicados no período.',
        value: sumPosts(p => p.plays || 0),
        serie: sPlays,
        delta: deltaFromSeries(sPlays),
        sortKey: 'plays' as const,
      },
      {
        id: 'compartilhamentos' as KpiId,
        label: 'Compartilhamentos do post',
        tooltip: 'Compartilhamentos totais dos posts publicados no período.',
        value: sumPosts(p => p.compartilhamentos || 0),
        serie: sShares,
        delta: deltaFromSeries(sShares),
        sortKey: 'engaj' as const,
      },
      {
        id: 'comentarios' as KpiId,
        label: 'Comentários no post',
        tooltip: 'Total de comentários nos posts publicados no período.',
        value: sumPosts(p => p.comentarios || 0),
        serie: sComments,
        delta: deltaFromSeries(sComments),
        sortKey: 'engaj' as const,
      },
      {
        id: 'conversas' as KpiId,
        label: 'Conversas por mensagem iniciadas',
        tooltip: 'Mensagens iniciadas via Click-to-WhatsApp — vem do Meta Ads (ads_daily_metrics.mensagens).',
        value: sumDaily(r => r.mensagens_ads || 0),
        serie: sMsg,
        delta: deltaFromSeries(sMsg),
        sortKey: 'recent' as const,
      },
    ]
  }, [account, posts, daily, days])

  const totalPosts = useMemo(
    () => posts.filter(p => {
      const t = new Date(p.publicado_em).getTime()
      return !isNaN(t) && Date.now() - t <= days * 86_400_000
    }).length,
    [posts, days],
  )

  return (
    <section className={styles.wrap}>
      <div className={styles.head}>
        <div>
          <h2 className={styles.title}>
            Resumo da publicidade <InfoIcon />
          </h2>
          <p className={styles.subtitle}>
            {account.username} publicou {totalPosts} post{totalPosts === 1 ? '' : 's'} nos últimos {days} dias.
          </p>
        </div>
        <div className={styles.periodBox}>
          <span className={styles.calIcon} aria-hidden>📅</span>
          <select
            className={styles.periodSelect}
            value={periodId}
            onChange={e => setPeriodId(e.target.value as PeriodId)}
            aria-label="Selecionar período"
          >
            {PERIODS.map(p => (
              <option key={p.id} value={p.id}>{periodLabel(p.days)}</option>
            ))}
          </select>
        </div>
      </div>

      <div className={styles.grid}>
        {kpis.map(k => (
          <PubCard
            key={k.id}
            label={k.label}
            tooltip={k.tooltip}
            value={'valueLabel' in k && k.valueLabel != null ? k.valueLabel : fmtCompactBr(k.value)}
            delta={k.delta}
            serie={k.serie}
            empty={k.value === 0 && (k.serie || []).every(v => !v)}
            onViewMore={() => onViewMore?.(k.id, k.sortKey)}
          />
        ))}
      </div>
    </section>
  )
}

interface CardProps {
  label: string
  tooltip: string
  value: ReactNode
  delta: number | null
  serie: number[]
  onViewMore?: () => void
  empty?: boolean
}

function PubCard({ label, tooltip, value, delta, serie, onViewMore, empty }: CardProps) {
  const dir = delta == null ? 'neutral' : delta > 0 ? 'up' : delta < 0 ? 'down' : 'neutral'
  const deltaLabel = delta == null
    ? '0%'
    : `${Math.abs(delta).toFixed(1).replace('.0', '')}%`
  const sparkColor =
    dir === 'up' ? 'var(--accent-cyan)' :
    dir === 'down' ? 'var(--accent-red)' :
    'var(--section-instagram)'

  return (
    <div className={styles.card}>
      <div className={styles.cardHead}>
        <span className={styles.cardLabel}>{label}</span>
        <span className={styles.info} title={tooltip} aria-label={tooltip}><InfoIcon size={12} /></span>
      </div>
      <div className={styles.cardRow}>
        <span className={styles.value}>{value}</span>
        <span className={`${styles.delta} ${styles['d_' + dir]}`}>
          {dir === 'up' ? '↑' : dir === 'down' ? '↓' : ''} {deltaLabel}
        </span>
      </div>
      <div className={styles.spark}>
        {serie.length > 1 && !empty
          ? <Sparkline serie={serie} color={sparkColor} width={280} height={40} />
          : <span className={styles.sparkEmpty}>sem dado no período</span>}
      </div>
      <button
        type="button"
        className={styles.moreBtn}
        onClick={onViewMore}
        disabled={!onViewMore}
      >
        Ver mais
      </button>
    </div>
  )
}

function InfoIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden>
      <circle cx="8" cy="8" r="6.5" />
      <path d="M8 7.5v4" strokeLinecap="round" />
      <circle cx="8" cy="5" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  )
}
