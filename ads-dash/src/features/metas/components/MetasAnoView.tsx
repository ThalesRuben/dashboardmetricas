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
import { fmtBRL, fmtCompact, fmtNumber } from '@/shared/lib/format'
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

const KPIS_HERO = ['faturamento', 'investimento_ads', 'leads', 'agendamentos', 'vendas'] as const

export default function MetasAnoView({ anoRef, onAbrirTrimestre }: Props) {
  const qRefs = useMemo(() => trimestresDoAno(anoRef), [anoRef])
  const [resumos, setResumos] = useState<ResumoQ[] | null>(null)
  const [anoMetas, setAnoMetas] = useState<MetaKpi[] | null>(null)

  useEffect(() => {
    let cancel = false
    async function carregar() {
      const [linhasAno, ...linhasQ] = await Promise.all([
        metasRepo.listarPorPeriodo('ano', anoRef),
        ...qRefs.map(r => metasRepo.listarPorPeriodo('trimestre', r)),
      ])
      if (cancel) return
      setAnoMetas(linhasAno)
      setResumos(qRefs.map((r, i) => {
        const meta = linhasQ[i].find(m => m.kpi === KPI_PRINCIPAL) ?? null
        const tempo = progressoTempoRef('trimestre', r)
        const c = { min: meta?.valor_meta_min ?? null, base: meta?.valor_meta ?? 0, max: meta?.valor_meta_max ?? null }
        const v = vereditoCenario(meta?.valor_realizado ?? 0, c, tempo)
        return { ref: r, meta, tempo, veredito: v }
      }))
    }
    carregar()
    return () => { cancel = true }
  }, [qRefs, anoRef])

  if (!resumos || !anoMetas) return <p className={styles.loading}>Carregando ano…</p>

  const tempoAno = progressoTempoRef('ano', anoRef)

  return (
    <>
      <section className={styles.heroGrid}>
        {KPIS_HERO.map(kpi => {
          const meta = anoMetas.find(m => m.kpi === kpi) ?? null
          return <AnoHeroCard key={kpi} kpi={kpi} meta={meta} tempoAno={tempoAno} anoRef={anoRef} />
        })}
      </section>

      <h3 className={styles.secTitle}>Por trimestre</h3>
      <div className={styles.grid}>
        {resumos.map(r => (
          <QCard key={r.ref} resumo={r} onAbrir={() => onAbrirTrimestre(r.ref)} />
        ))}
      </div>
    </>
  )
}

const KPI_LABEL: Record<string, string> = {
  faturamento: 'Faturamento',
  investimento_ads: 'Investimento em Ads',
  leads: 'Leads',
  agendamentos: 'Agendamentos',
  vendas: 'Vendas',
}

function fmtByUnidade(valor: number, unidade: MetaKpi['unidade'] | undefined): string {
  if (unidade === 'BRL') return fmtBRL(valor)
  // 'num' | 'x' | '%' — usa número simples pt-BR
  return fmtNumber(valor)
}

function AnoHeroCard({ kpi, meta, tempoAno, anoRef }: { kpi: string; meta: MetaKpi | null; tempoAno: number; anoRef: string }) {
  const realizado = meta?.valor_realizado ?? 0
  const base = meta?.valor_meta ?? 0
  const min  = meta?.valor_meta_min ?? null
  const max  = meta?.valor_meta_max ?? null
  const cenarios = { min, base, max }
  const info = VEREDITO_INFO[vereditoCenario(realizado, cenarios, tempoAno)]
  const falta = quantoFalta(realizado, cenarios)
  const pctBase = base > 0 ? Math.round((realizado / base) * 100) : 0
  const label = KPI_LABEL[kpi] || meta?.label || kpi
  const unidade = meta?.unidade

  const isBrl = unidade === 'BRL'
  const faltaFmt = (v: number) => isBrl ? fmtBRL(v) : fmtNumber(v)

  return (
    <article className={`${styles.hero} ${styles[`tone_${info.tone}`]}`}>
      <header className={styles.heroHead}>
        <div>
          <h3 className={styles.heroTitle}>{label}</h3>
          <p className={styles.heroSub}>Ano {anoRef} · {Math.round(tempoAno * 100)}% decorrido</p>
        </div>
        <span className={`${styles.tag} ${styles[`tag_${info.tone}`]}`}>
          {info.icon} {info.text}
        </span>
      </header>

      <div className={styles.heroValor}>
        <span className={styles.heroReal}>{fmtByUnidade(realizado, unidade)}</span>
        <span className={styles.heroSlash}>/</span>
        <span className={styles.heroMeta}>{base > 0 ? fmtByUnidade(base, unidade) : 'sem meta'}</span>
      </div>

      <div className={styles.heroBarWrap}>
        <div className={styles.heroBarTrack}>
          <span className={styles.heroBarFill} style={{ width: `${Math.min(100, pctBase)}%` }} />
          <span className={styles.heroBarTime} style={{ left: `${Math.round(tempoAno * 100)}%` }} title="Tempo decorrido" />
        </div>
        <div className={styles.heroBarFoot}>
          <span>{pctBase}% da base</span>
          {falta.base != null && falta.base > 0 && base > 0 && (
            <span>falta {faltaFmt(falta.base)}</span>
          )}
          {falta.base != null && falta.base <= 0 && base > 0 && (
            <span className={styles.heroFootOk}>✓ meta batida</span>
          )}
        </div>
      </div>

      <div className={styles.cenariosRow}>
        <Cenario label="Mín"  valor={min}  falta={falta.min}  unidade={unidade}  />
        <Cenario label="Base" valor={base} falta={falta.base} unidade={unidade} destaque />
        <Cenario label="Máx"  valor={max}  falta={falta.max}  unidade={unidade}  />
      </div>
    </article>
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

function Cenario({ label, valor, falta, destaque, unidade }: { label: string; valor: number | null; falta: number | null; destaque?: boolean; unidade?: MetaKpi['unidade'] }) {
  if (valor == null || valor === 0) {
    return (
      <div className={`${styles.cen} ${destaque ? styles.cenDestaque : ''}`}>
        <span className={styles.cenLabel}>{label}</span>
        <span className={styles.cenValor}>—</span>
      </div>
    )
  }
  const isBrl = unidade === 'BRL' || unidade === undefined
  const prefix = isBrl ? 'R$ ' : ''
  const fmt = (n: number) => isBrl ? fmtCompact(n) : fmtNumber(n)
  const hint = falta == null ? '' : falta <= 0 ? '✓ batido' : `falta ${prefix}${fmt(falta)}`
  return (
    <div className={`${styles.cen} ${destaque ? styles.cenDestaque : ''}`}>
      <span className={styles.cenLabel}>{label}</span>
      <span className={styles.cenValor}>{prefix}{fmt(valor)}</span>
      <span className={styles.cenHint} data-batido={falta != null && falta <= 0}>{hint}</span>
    </div>
  )
}
