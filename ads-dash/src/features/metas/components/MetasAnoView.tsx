// Visão do Ano: 4 cards de trimestre (Q1..Q4), cada um com real × cenários
// e status. Clicar troca pra aba Trimestre filtrada naquele Q.

import { useEffect, useMemo, useState } from 'react'
import { metasRepo } from '../api/metasRepo'
import type { MetaKpi } from '../api/types'
import {
  trimestresDoAno,
  progressoTempoRef,
  rotuloPeriodo,
  vereditoCenario,
  quantoFalta,
} from '../lib/periodo'
import type { VereditoCenario } from '../lib/periodo'
import { fmtBRL, fmtCompact } from '@/shared/lib/format'
import styles from './MetasAnoView.module.css'

interface Props { anoRef: string; onAbrirTrimestre: (qRef: string) => void }

const KPI_PRINCIPAL = 'faturamento'

interface ResumoQ {
  ref: string
  meta: MetaKpi | null
  tempo: number
  veredito: VereditoCenario
}

const VEREDITO_INFO: Record<VereditoCenario, { tone: string; text: string; icon: string }> = {
  'superou':     { tone: 'success', text: 'Superou otimista', icon: '🚀' },
  'no-plano':    { tone: 'success', text: 'No plano',         icon: '✅' },
  'piso-ok':     { tone: 'info',    text: 'Piso ok',          icon: '🟡' },
  'abaixo-piso': { tone: 'danger',  text: 'Abaixo do piso',   icon: '❌' },
  'no-inicio':   { tone: 'subtle',  text: 'Em preparação',    icon: '🔜' },
  'sem-meta':    { tone: 'subtle',  text: 'Sem meta',         icon: '—' },
}

export default function MetasAnoView({ anoRef, onAbrirTrimestre }: Props) {
  const qRefs = useMemo(() => trimestresDoAno(anoRef), [anoRef])
  const [resumos, setResumos] = useState<ResumoQ[] | null>(null)

  useEffect(() => {
    let cancel = false
    async function carregar() {
      const linhas = await Promise.all(qRefs.map(r => metasRepo.listarPorPeriodo('trimestre', r)))
      if (cancel) return
      setResumos(qRefs.map((r, i) => {
        const meta = linhas[i].find(m => m.kpi === KPI_PRINCIPAL) ?? null
        const tempo = progressoTempoRef('trimestre', r)
        const c = { min: meta?.valor_meta_min ?? null, base: meta?.valor_meta ?? 0, max: meta?.valor_meta_max ?? null }
        const v = vereditoCenario(meta?.valor_realizado ?? 0, c, tempo)
        return { ref: r, meta, tempo, veredito: v }
      }))
    }
    carregar()
    return () => { cancel = true }
  }, [qRefs])

  if (!resumos) return <p className={styles.loading}>Carregando ano…</p>

  return (
    <div className={styles.grid}>
      {resumos.map(r => (
        <QCard key={r.ref} resumo={r} onAbrir={() => onAbrirTrimestre(r.ref)} />
      ))}
    </div>
  )
}

function QCard({ resumo, onAbrir }: { resumo: ResumoQ; onAbrir: () => void }) {
  const m = resumo.meta
  const realizado = m?.valor_realizado ?? 0
  const base = m?.valor_meta ?? 0
  const min  = m?.valor_meta_min ?? null
  const max  = m?.valor_meta_max ?? null
  const cenarios = { min, base, max }
  const info = VEREDITO_INFO[resumo.veredito]
  const falta = quantoFalta(realizado, cenarios)
  const pct = base > 0 ? Math.round((realizado / base) * 100) : 0

  return (
    <button type="button" className={`${styles.card} ${styles[`tone_${info.tone}`]}`} onClick={onAbrir}>
      <header className={styles.head}>
        <div>
          <span className={styles.qLabel}>{rotuloPeriodo('trimestre', resumo.ref)}</span>
        </div>
        <span className={`${styles.tag} ${styles[`tag_${info.tone}`]}`}>
          {info.icon} {info.text}
        </span>
      </header>

      <div className={styles.realizado}>
        <span className={styles.realValor}>{fmtBRL(realizado)}</span>
        <span className={styles.realPct}>{base > 0 ? `${pct}% da base` : 'sem base'}</span>
      </div>

      <div className={styles.cenariosRow}>
        <Cenario label="Mín"  valor={min}  falta={falta.min}  />
        <Cenario label="Base" valor={base} falta={falta.base} destaque />
        <Cenario label="Máx"  valor={max}  falta={falta.max}  />
      </div>

      <footer className={styles.foot}>
        <span>{Math.round(resumo.tempo * 100)}% do trimestre decorrido</span>
        <span className={styles.cta}>ver detalhes →</span>
      </footer>
    </button>
  )
}

function Cenario({ label, valor, falta, destaque }: { label: string; valor: number | null; falta: number | null; destaque?: boolean }) {
  if (valor == null || valor === 0) {
    return (
      <div className={`${styles.cen} ${destaque ? styles.cenDestaque : ''}`}>
        <span className={styles.cenLabel}>{label}</span>
        <span className={styles.cenValor}>—</span>
      </div>
    )
  }
  const hint = falta == null ? '' : falta <= 0 ? '✓ batido' : `falta R$ ${fmtCompact(falta)}`
  return (
    <div className={`${styles.cen} ${destaque ? styles.cenDestaque : ''}`}>
      <span className={styles.cenLabel}>{label}</span>
      <span className={styles.cenValor}>R$ {fmtCompact(valor)}</span>
      <span className={styles.cenHint} data-batido={falta != null && falta <= 0}>{hint}</span>
    </div>
  )
}
