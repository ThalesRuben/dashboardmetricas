import { useMemo } from 'react'
import { fmtNumber, fmtRoas } from '@/shared/lib/format'
import { HYPE_LEVELS } from '@/features/organic/instagram/lib/hypeDetector'
import styles from './AtelierAtencao.module.css'

/* ---------------------------------------------------------------
 * Atelier — "Folha de fórmula do dia".
 *
 * Vocabulário roubado do colorista técnico:
 *  - Cada KPI é um "ingrediente" com nível (1 a 10, como a escala
 *    universal de coloração capilar).
 *  - "Nuance" (delta%) sai escrita, não com badge colorida.
 *  - Signature = tira de swatches na base, 7 dias com o tom real
 *    (platinum / mel / walnut) que reflete a performance.
 * -------------------------------------------------------------- */

interface Summary {
  roas: number
  mensagens: number
  agendamentos: number
  vendas: number
}
type DayRow = { date: string } & Partial<Summary>

interface Anomaly {
  key: string
  metric: string
  severity: 'good' | 'warn' | 'bad'
  title: string
  detail: string
}
interface HypePost {
  level: string
  caption?: string
  titulo?: string
}

interface Props {
  summary: Summary
  prevSummary: Summary | null | undefined
  days: DayRow[]
  anomalies: Anomaly[]
  hype: HypePost | null
  hypeCount: number
  onKpiClick?: (key: 'roas' | 'mensagens' | 'agendamentos' | 'vendas') => void
  onOpenBriefing?: () => void
  onOpenRange?: () => void
  rangeLabel: string
}

const MONTH_PT = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez']
const WEEKDAY_ABBR = ['dom','seg','ter','qua','qui','sex','sáb']
const LEVEL_WORDS = ['zero','um','dois','três','quatro','cinco','seis','sete','oito','nove','dez']

function levelFromDelta(curr: number, prev: number | undefined): number {
  if (!prev || prev === 0) return 5
  const pct = ((curr - prev) / prev) * 100
  // +25% ou mais → 10; -25% ou menos → 1; linear entre eles
  const lvl = Math.round(5 + pct / 5)
  return Math.max(1, Math.min(10, lvl))
}

function pctSigned(curr: number, prev: number | undefined): string {
  if (!prev || prev === 0) return ''
  const pct = ((curr - prev) / prev) * 100
  const sign = pct >= 0 ? 'alta' : 'queda'
  return `${sign} ${Math.abs(pct).toFixed(0)}%`
}

function nuanceWord(curr: number, prev: number | undefined): string {
  if (!prev || prev === 0) return 'sem referência anterior'
  const pct = ((curr - prev) / prev) * 100
  if (pct >= 15)  return 'bem acima da semana anterior'
  if (pct >= 5)   return 'acima da semana anterior'
  if (pct >= -5)  return 'na linha da semana anterior'
  if (pct >= -15) return 'abaixo da semana anterior'
  return 'bem abaixo da semana anterior'
}

function swatchTone(pct: number | null): string {
  if (pct == null) return 'var(--sw-empty)'
  if (pct >= 10)  return 'var(--sw-platinum)'
  if (pct >= -5)  return 'var(--sw-blond)'
  return 'var(--sw-walnut)'
}

function verdictSentence(items: Array<{ level: number }>): string {
  const fortes = items.filter(i => i.level >= 7).length
  const fracos = items.filter(i => i.level <= 4).length
  if (fortes >= 3 && fracos === 0) return 'Fórmula no ponto — semana inteira acima da meta.'
  if (fortes >= 2 && fracos <= 1)  return 'Semana forte em conversão.'
  if (fracos >= 3)                 return 'Fórmula pede ajuste — três ingredientes abaixo.'
  if (fracos === 2)                return 'Semana morna — dois ingredientes pedem atenção.'
  if (fortes === 4)                return 'Semana impecável.'
  return 'Semana estável — nenhum ingrediente fora da linha.'
}

function Sparkline({ serie, color = 'var(--a-pigment)' }: { serie: number[]; color?: string }) {
  if (!serie || serie.length < 2) return <span aria-hidden />
  const min = Math.min(...serie)
  const max = Math.max(...serie)
  const span = max - min || 1
  const w = 84, h = 22
  const step = w / (serie.length - 1)
  const points = serie.map((v, i) => {
    const x = i * step
    const y = h - ((v - min) / span) * (h - 2) - 1
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  return (
    <svg className={styles.mini} viewBox={`0 0 ${w} ${h}`} aria-hidden>
      <polyline fill="none" stroke={color} strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" points={points} />
    </svg>
  )
}

export default function AtelierAtencao({
  summary, prevSummary, days, anomalies, hype, hypeCount,
  onKpiClick, onOpenBriefing, onOpenRange, rangeLabel,
}: Props) {
  const now = new Date()
  const dateLabel = `${String(now.getDate()).padStart(2,'0')} · ${MONTH_PT[now.getMonth()]} · ${String(now.getFullYear()).slice(2)}`

  const kpis = useMemo(() => [
    { key: 'roas' as const,         label: 'roas',                 value: fmtRoas(summary.roas),        level: levelFromDelta(summary.roas,         prevSummary?.roas),         nuance: nuanceWord(summary.roas,         prevSummary?.roas),         pct: pctSigned(summary.roas,         prevSummary?.roas),         serie: days.map(d => Number(d.roas)         || 0) },
    { key: 'mensagens' as const,    label: 'mensagens',            value: fmtNumber(summary.mensagens), level: levelFromDelta(summary.mensagens,    prevSummary?.mensagens),    nuance: nuanceWord(summary.mensagens,    prevSummary?.mensagens),    pct: pctSigned(summary.mensagens,    prevSummary?.mensagens),    serie: days.map(d => Number(d.mensagens)    || 0) },
    { key: 'agendamentos' as const, label: 'agendamentos',         value: fmtNumber(summary.agendamentos), level: levelFromDelta(summary.agendamentos, prevSummary?.agendamentos), nuance: nuanceWord(summary.agendamentos, prevSummary?.agendamentos), pct: pctSigned(summary.agendamentos, prevSummary?.agendamentos), serie: days.map(d => Number(d.agendamentos) || 0) },
    { key: 'vendas' as const,       label: 'vendas',               value: fmtNumber(summary.vendas),    level: levelFromDelta(summary.vendas,       prevSummary?.vendas),       nuance: nuanceWord(summary.vendas,       prevSummary?.vendas),       pct: pctSigned(summary.vendas,       prevSummary?.vendas),       serie: days.map(d => Number(d.vendas)       || 0) },
  ], [summary, prevSummary, days])

  // Signature: 7 swatches — cor derivada da variação de ROAS dia contra a média
  const swatchDays = useMemo(() => {
    const last7 = days.slice(-7)
    if (last7.length === 0) return []
    const avg = last7.reduce((s, d) => s + (Number(d.roas) || 0), 0) / last7.length || 1
    return last7.map(d => {
      const roas = Number(d.roas) || 0
      const pct = ((roas - avg) / avg) * 100
      const dow = new Date(d.date).getDay()
      return { color: swatchTone(pct), day: WEEKDAY_ABBR[dow] }
    })
  }, [days])

  const verdict = verdictSentence(kpis)

  return (
    <div className={styles.sheet}>
      <div className={styles.head}>
        <div>
          <div className={styles.wordmark}>The Blonde Concept · Fabio Oliver</div>
          <span className={styles.wordmarkRule} />
        </div>
        <div className={styles.meta}>
          <span className={styles.metaDate}>Fórmula · {dateLabel}</span>
          <button className={styles.rangeBtn} onClick={onOpenRange} type="button">
            {rangeLabel} ↓
          </button>
          <button className={styles.rangeBtn} onClick={onOpenBriefing} type="button">
            Briefing 1p
          </button>
        </div>
      </div>

      <div className={styles.verdict}>{verdict}</div>
      <div className={styles.verdictSub}>
        Quatro ingredientes na folha de hoje. Cada um com seu nível na escala 1 – 10.
      </div>

      <div className={styles.rule} />

      {kpis.map(k => (
        <div key={k.key} className={styles.row} onClick={() => onKpiClick?.(k.key)}>
          <div className={styles.rowLeft}>
            <span className={styles.label}>{k.label}</span>
            <span className={styles.levelLine}>
              nível <em>{LEVEL_WORDS[k.level]}</em> <span className={styles.levelBadge}>· {k.level.toString().padStart(2,'0')}/10</span>
              {k.pct && <> · {k.nuance}</>}
            </span>
          </div>
          <div className={styles.rowRight}>
            <Sparkline serie={k.serie} />
            <span className={styles.value}>{k.value}</span>
          </div>
        </div>
      ))}

      <div className={styles.rule} />

      <div className={styles.signatureBar}>
        <div className={styles.signatureLabel}>
          Sete swatches — um por dia da semana. Tom espelha a performance de ROAS na bancada.
        </div>
        <div className={styles.swatches} aria-label="Swatches dos últimos 7 dias">
          {swatchDays.map((s, i) => (
            <span key={i} className={styles.swatch} style={{ background: s.color }} title={s.day} />
          ))}
        </div>
      </div>

      <section className={styles.attention}>
        <h3 className={styles.attentionHead}>Pede sua atenção</h3>
        {anomalies.length === 0 && !hype && (
          <p className={styles.attnEmpty}>Bancada limpa. Nada gritando por revisão agora.</p>
        )}
        {hype && (
          <div className={styles.attnRow}>
            <span className={styles.attnMarker}>hype</span>
            <div>
              <div className={styles.attnTitle}>
                {HYPE_LEVELS[hype.level]?.label}: {hype.titulo || (hype.caption || 'post').slice(0, 60)}
              </div>
              <div className={styles.attnSub}>
                {hypeCount} post{hypeCount > 1 ? 's' : ''} acima da média do perfil · momento de amplificar
              </div>
            </div>
            <a href="/instagram" className={styles.attnAction}>abrir instagram</a>
          </div>
        )}
        {anomalies.map(a => (
          <div key={a.key} className={styles.attnRow}>
            <span className={styles.attnMarker}>{a.severity === 'good' ? 'alta' : a.severity === 'bad' ? 'queda' : 'nota'}</span>
            <div>
              <div className={styles.attnTitle}>{a.title}</div>
              <div className={styles.attnSub}>{a.detail}</div>
            </div>
            <span className={styles.attnAction} style={{ opacity: 0.4, cursor: 'default' }}>—</span>
          </div>
        ))}
      </section>

      <div className={styles.foot}>
        <span>The Blonde Concept · painel operacional</span>
        <span>{days.length} dias no período</span>
      </div>
    </div>
  )
}
