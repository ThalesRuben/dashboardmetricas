import { Link } from 'react-router-dom'
import { useMetas } from '../hooks/useMetas'
import { progressoTempo, rotuloPeriodo, veredito } from '../lib/periodo'
import type { MetaKpi, MetaPeriodo } from '../api/types'
import styles from './MetasBanner.module.css'

const PERIODOS: { id: MetaPeriodo; label: string }[] = [
  { id: 'semana',    label: 'Semana' },
  { id: 'trimestre', label: 'Trimestre' },
  { id: 'ano',       label: 'Ano' },
]

export default function MetasBanner() {
  return (
    <Link to="/metas" className={styles.bannerLink}>
      <div className={styles.banner}>
        {PERIODOS.map((p) => (
          <PeriodoCard key={p.id} id={p.id} label={p.label} />
        ))}
        <div className={styles.cta}>
          Ver metas →
        </div>
      </div>
    </Link>
  )
}

function PeriodoCard({ id, label }: { id: MetaPeriodo; label: string }) {
  const { metas, loading, periodoRef } = useMetas({ periodo: id })
  const tempo = progressoTempo(id)
  const sumario = resumir(metas, tempo)

  if (loading) {
    return (
      <div className={styles.card}>
        <span className={styles.label}>{label}</span>
        <span className={styles.loading}>—</span>
      </div>
    )
  }

  return (
    <div className={styles.card}>
      <div className={styles.head}>
        <span className={styles.label}>{label}</span>
        <span className={styles.subref}>{rotuloPeriodo(id, periodoRef)}</span>
      </div>
      <div className={styles.statRow}>
        <span className={styles.pctBig}>{sumario.pctConsolidado}%</span>
        <span className={styles.pctLabel}>da meta</span>
      </div>
      <div className={styles.statusRow}>
        <span className={`${styles.tag} ${styles.tagOk}`}>
          <span className={styles.dot} /> {sumario.naoCaminho} no caminho
        </span>
        {sumario.atrasado > 0 && (
          <span className={`${styles.tag} ${styles.tagWarn}`}>
            <span className={styles.dot} /> {sumario.atrasado} atrasada{sumario.atrasado === 1 ? '' : 's'}
          </span>
        )}
      </div>
    </div>
  )
}

interface Sumario {
  pctConsolidado: number
  naoCaminho: number
  atrasado: number
}

function resumir(metas: MetaKpi[], tempo: number): Sumario {
  const comMeta = metas.filter(m => m.valor_meta > 0)
  if (comMeta.length === 0) return { pctConsolidado: 0, naoCaminho: 0, atrasado: 0 }

  let soma = 0
  let nc = 0
  let at = 0
  for (const m of comMeta) {
    const pct = (m.valor_realizado / m.valor_meta) * 100
    soma += Math.min(150, pct)
    const v = veredito(pct, tempo, m.valor_meta)
    if (v === 'batida' || v === 'adiantado' || v === 'no-ritmo') nc++
    if (v === 'atrasado') at++
  }
  return {
    pctConsolidado: Math.round(soma / comMeta.length),
    naoCaminho: nc,
    atrasado: at,
  }
}
