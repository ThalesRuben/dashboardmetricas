import { fmtNumber, fmtPct } from '@/shared/lib/format'
import styles from './BenchmarkPanel.module.css'

interface BenchmarkProfile {
  nome: string
  seguidores?: number
  engajamento_taxa?: number
  posts_semana?: number
  [key: string]: unknown
}

interface BenchmarkPanelProps {
  you?: BenchmarkProfile | null
  rivals?: BenchmarkProfile[]
  data?: unknown
  ig?: unknown
  content?: unknown
  source?: string
}

interface MetricDef {
  key: keyof BenchmarkProfile
  label: string
  fmt: (v: number) => string
  betterUp: boolean
}

const METRICS: MetricDef[] = [
  { key: 'seguidores',       label: 'Seguidores',  fmt: fmtNumber,           betterUp: true  },
  { key: 'engajamento_taxa', label: 'Engajamento', fmt: v => fmtPct(v, 1),   betterUp: true  },
  { key: 'posts_semana',     label: 'Posts/semana',fmt: v => `${v}`,         betterUp: true  },
]

export default function BenchmarkPanel({ you, rivals }: BenchmarkPanelProps) {
  if (!you || !rivals?.length) {
    return <div className={styles.card}><div className={styles.empty}>Cadastre concorrentes para ver o comparativo.</div></div>
  }

  const all = [you, ...rivals]

  return (
    <div className={styles.card}>
      <div className={styles.head}>
        <h3 className={styles.title}>Você vs. mercado</h3>
        <p className={styles.sub}>Posição entre {all.length} perfis monitorados</p>
      </div>

      <div className={styles.metrics}>
        {METRICS.map(m => {
          const values = all.map(p => (p[m.key] as number) || 0)
          const max = Math.max(...values, 1)
          const sorted = [...values].sort((a, b) => m.betterUp ? b - a : a - b)
          const youValue = (you[m.key] as number) || 0
          const rank = sorted.indexOf(youValue) + 1
          const avg = values.reduce((s, v) => s + v, 0) / values.length
          const vsAvg = avg > 0 ? ((youValue - avg) / avg) * 100 : 0
          const aboveAvg = m.betterUp ? vsAvg >= 0 : vsAvg <= 0

          return (
            <div key={m.key} className={styles.metricBlock}>
              <div className={styles.metricHead}>
                <span className={styles.metricLabel}>{m.label}</span>
                <span className={`${styles.rank} ${rank === 1 ? styles.rankFirst : ''}`}>
                  {rank}º de {all.length}
                </span>
              </div>

              <div className={styles.bars}>
                {all.map((p, i) => {
                  const v = (p[m.key] as number) || 0
                  const isYou = i === 0
                  return (
                    <div key={i} className={styles.barRow}>
                      <span className={`${styles.barName} ${isYou ? styles.barNameYou : ''}`}>
                        {isYou ? '★ ' : ''}{p.nome}
                      </span>
                      <div className={styles.barTrack}>
                        <div
                          className={`${styles.barFill} ${isYou ? styles.barFillYou : ''}`}
                          style={{ width: `${(v / max) * 100}%` }}
                        />
                      </div>
                      <span className={`${styles.barValue} ${isYou ? styles.barValueYou : ''}`}>
                        {m.fmt(v)}
                      </span>
                    </div>
                  )
                })}
              </div>

              <div className={`${styles.vsAvg} ${aboveAvg ? styles.vsAvgUp : styles.vsAvgDown}`}>
                {aboveAvg ? '▲' : '▼'} {Math.abs(vsAvg).toFixed(0)}% {aboveAvg ? 'acima' : 'abaixo'} da média do mercado
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
