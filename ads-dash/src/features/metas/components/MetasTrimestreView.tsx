// Visão rica de um trimestre: header com cenários do Q, linha de 3 meses por
// KPI principal (faturamento + tráfego), bloco compacto de KPIs auto.

import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { metasRepo } from '../api/metasRepo'
import { KPIS_PADRAO } from '../api/types'
import type { MetaKpi } from '../api/types'
import {
  mesesDoTrimestre,
  progressoTempoRef,
  rotuloMes,
  rotuloPeriodo,
  vereditoCenario,
  quantoFalta,
} from '../lib/periodo'
import type { VereditoCenario } from '../lib/periodo'
import { fmtBRL, fmtCompact, fmtNumber, fmtRoas, fmtPct } from '@/shared/lib/format'
import styles from './MetasTrimestreView.module.css'

interface Props { trimestreRef: string }

interface DadosKpi {
  kpi: string
  label: string
  unidade: MetaKpi['unidade']
  trim: MetaKpi | null
  meses: { ref: string; meta: MetaKpi | null }[]
}

const KPIS_PRINCIPAIS = ['faturamento', 'investimento_ads']
const KPIS_SECUNDARIOS = ['conversas_whatsapp', 'leads', 'agendamentos', 'vendas', 'roas_medio']

function fmtUnidade(valor: number, unidade: MetaKpi['unidade']): string {
  if (unidade === 'BRL') return fmtBRL(valor)
  if (unidade === 'x')   return fmtRoas(valor)
  if (unidade === '%')   return fmtPct(valor)
  return fmtNumber(valor)
}

function fmtUnidadeCompacta(valor: number, unidade: MetaKpi['unidade']): string {
  if (unidade === 'BRL') return 'R$ ' + fmtCompact(valor)
  if (unidade === 'x')   return fmtRoas(valor)
  if (unidade === '%')   return fmtPct(valor)
  return fmtCompact(valor)
}

const VEREDITO_INFO: Record<VereditoCenario, { tone: string; text: string }> = {
  'superou':      { tone: 'success', text: '🚀 superou otimista' },
  'no-plano':     { tone: 'success', text: '✅ no plano' },
  'piso-ok':      { tone: 'info',    text: '🟡 piso ok' },
  'abaixo-piso':  { tone: 'danger',  text: '❌ abaixo do piso' },
  'no-inicio':    { tone: 'subtle',  text: '🔜 ainda no início' },
  'sem-meta':     { tone: 'subtle',  text: 'sem meta' },
}

export default function MetasTrimestreView({ trimestreRef }: Props) {
  const mesRefs = useMemo(() => mesesDoTrimestre(trimestreRef), [trimestreRef])
  const [dados, setDados] = useState<DadosKpi[] | null>(null)

  useEffect(() => {
    let cancel = false
    async function carregar() {
      const trim = await metasRepo.listarPorPeriodo('trimestre', trimestreRef)
      const meses = await Promise.all(mesRefs.map(r => metasRepo.listarPorPeriodo('mes', r)))
      if (cancel) return

      const todosKpis = [...KPIS_PRINCIPAIS, ...KPIS_SECUNDARIOS]
      const out: DadosKpi[] = todosKpis.map(kpiId => {
        const def = KPIS_PADRAO.find(k => k.kpi === kpiId)!
        return {
          kpi: kpiId,
          label: def.label,
          unidade: def.unidade,
          trim: trim.find(m => m.kpi === kpiId) ?? null,
          meses: mesRefs.map((r, i) => ({ ref: r, meta: meses[i].find(m => m.kpi === kpiId) ?? null })),
        }
      })
      setDados(out)
    }
    carregar()
    return () => { cancel = true }
  }, [trimestreRef, mesRefs])

  const tempoTrim = progressoTempoRef('trimestre', trimestreRef)

  if (!dados) return <p className={styles.loading}>Carregando trimestre…</p>

  return (
    <div className={styles.wrap}>
      {KPIS_PRINCIPAIS.map(id => {
        const d = dados.find(x => x.kpi === id)
        if (!d) return null
        return <KpiPrincipalCard key={id} dados={d} tempoTrim={tempoTrim} trimestreRef={trimestreRef} />
      })}

      <section className={styles.secundarios}>
        <h3 className={styles.secTitle}>Outros KPIs neste trimestre</h3>
        <div className={styles.secGrid}>
          {KPIS_SECUNDARIOS.map(id => {
            const d = dados.find(x => x.kpi === id)
            if (!d) return null
            return <KpiSecundarioChip key={id} dados={d} tempoTrim={tempoTrim} />
          })}
        </div>
      </section>
    </div>
  )
}

// ---------- KPI principal (faturamento, tráfego) ----------

interface KpiPrincipalProps { dados: DadosKpi; tempoTrim: number; trimestreRef: string }

function KpiPrincipalCard({ dados, tempoTrim, trimestreRef }: KpiPrincipalProps) {
  const m = dados.trim
  const realizado = m?.valor_realizado ?? 0
  const base = m?.valor_meta ?? 0
  const min  = m?.valor_meta_min ?? null
  const max  = m?.valor_meta_max ?? null
  const cenarios = { min, base, max }
  const v = vereditoCenario(realizado, cenarios, tempoTrim)
  const info = VEREDITO_INFO[v]
  const falta = quantoFalta(realizado, cenarios)

  const pctBase = base > 0 ? Math.round((realizado / base) * 100) : 0

  return (
    <article className={`${styles.principal} ${styles[`tone_${info.tone}`]}`}>
      <header className={styles.pHead}>
        <div>
          <h3 className={styles.pTitle}>{dados.label}</h3>
          <p className={styles.pSubtitle}>{rotuloPeriodo('trimestre', trimestreRef)}</p>
        </div>
        <span className={`${styles.tag} ${styles[`tag_${info.tone}`]}`}>{info.text}</span>
      </header>

      <div className={styles.pStats}>
        <Stat label="Realizado"        value={fmtUnidade(realizado, dados.unidade)} big tone={info.tone} />
        <Stat label="Mínimo"           value={min != null ? fmtUnidade(min, dados.unidade) : '—'}  hint={falta.min  != null ? rotuloFalta(falta.min, dados.unidade)  : undefined} />
        <Stat label="Base"             value={base > 0  ? fmtUnidade(base, dados.unidade) : '—'} hint={falta.base != null ? rotuloFalta(falta.base, dados.unidade) : undefined} />
        <Stat label="Otimista"         value={max != null ? fmtUnidade(max, dados.unidade) : '—'}  hint={falta.max  != null ? rotuloFalta(falta.max, dados.unidade)  : undefined} />
      </div>

      <BarraCenarios realizado={realizado} c={cenarios} tempoTrim={tempoTrim} pctBase={pctBase} />

      <div className={styles.mesesRow}>
        {dados.meses.map(({ ref, meta }) => (
          <MesCard key={ref} ref_={ref} meta={meta} unidade={dados.unidade} />
        ))}
      </div>
    </article>
  )
}

function rotuloFalta(delta: number, unidade: MetaKpi['unidade']): string {
  if (delta <= 0) return `+${fmtUnidadeCompacta(Math.abs(delta), unidade)} acima`
  return `falta ${fmtUnidadeCompacta(delta, unidade)}`
}

interface StatProps { label: string; value: string; hint?: string; big?: boolean; tone?: string }
function Stat({ label, value, hint, big, tone }: StatProps) {
  return (
    <div className={`${styles.stat} ${big ? styles.statBig : ''}`}>
      <span className={styles.statLabel}>{label}</span>
      <span className={styles.statValue} data-tone={tone}>{value}</span>
      {hint && <span className={styles.statHint}>{hint}</span>}
    </div>
  )
}

// ---------- Barra com marcações de mín/base/máx ----------

interface BarraProps { realizado: number; c: { min: number | null; base: number; max: number | null }; tempoTrim: number; pctBase: number }
function BarraCenarios({ realizado, c, tempoTrim, pctBase }: BarraProps) {
  const escala = Math.max(c.max ?? 0, c.base, realizado, 1)
  const pos = (v: number) => Math.min(100, (v / escala) * 100)
  return (
    <div className={styles.barraWrap}>
      <div className={styles.barraTrack}>
        <span className={styles.barraReal} style={{ width: `${pos(realizado)}%` }} />
        {c.min  != null && <span className={styles.marca} style={{ left: `${pos(c.min)}%` }}  data-kind="min"  title={`Mínimo`} />}
        {c.base > 0      && <span className={styles.marca} style={{ left: `${pos(c.base)}%` }} data-kind="base" title={`Base`} />}
        {c.max  != null && <span className={styles.marca} style={{ left: `${pos(c.max)}%` }}  data-kind="max"  title={`Otimista`} />}
      </div>
      <div className={styles.barraFoot}>
        <span>{pctBase}% da base · {Math.round(tempoTrim * 100)}% do tempo</span>
      </div>
    </div>
  )
}

// ---------- Card mensal ----------

function MesCard({ ref_, meta, unidade }: { ref_: string; meta: MetaKpi | null; unidade: MetaKpi['unidade'] }) {
  const realizado = meta?.valor_realizado ?? 0
  const base = meta?.valor_meta ?? 0
  const min  = meta?.valor_meta_min ?? null
  const max  = meta?.valor_meta_max ?? null
  const cenarios = { min, base, max }
  const tempoMes = progressoTempoRef('mes', ref_)
  const v = vereditoCenario(realizado, cenarios, tempoMes)
  const info = VEREDITO_INFO[v]

  return (
    <div className={`${styles.mes} ${styles[`mesTone_${info.tone}`]}`}>
      <div className={styles.mesHead}>
        <span className={styles.mesLabel}>{rotuloMes(ref_)}</span>
        <span className={`${styles.mesTag} ${styles[`mesTag_${info.tone}`]}`} title={info.text}>{statusIcon(v)}</span>
      </div>
      <div className={styles.mesReal}>{fmtUnidadeCompacta(realizado, unidade)}</div>
      <div className={styles.mesCenarios}>
        <span><span className={styles.mesCenLabel}>mín</span> {min  != null ? fmtUnidadeCompacta(min,  unidade) : '—'}</span>
        <span><span className={styles.mesCenLabel}>base</span> {base > 0  ? fmtUnidadeCompacta(base, unidade) : '—'}</span>
        <span><span className={styles.mesCenLabel}>máx</span> {max  != null ? fmtUnidadeCompacta(max,  unidade) : '—'}</span>
      </div>
    </div>
  )
}

function statusIcon(v: VereditoCenario): string {
  if (v === 'superou')     return '🚀'
  if (v === 'no-plano')    return '✅'
  if (v === 'piso-ok')     return '🟡'
  if (v === 'abaixo-piso') return '❌'
  if (v === 'no-inicio')   return '🔜'
  return '—'
}

// ---------- KPIs secundários (chips compactos) ----------

function KpiSecundarioChip({ dados, tempoTrim }: { dados: DadosKpi; tempoTrim: number }) {
  const m = dados.trim
  const realizado = m?.valor_realizado ?? 0
  const base = m?.valor_meta ?? 0
  const min  = m?.valor_meta_min ?? null
  const max  = m?.valor_meta_max ?? null
  const v = vereditoCenario(realizado, { min, base, max }, tempoTrim)
  const info = VEREDITO_INFO[v]
  const pct = base > 0 ? Math.round((realizado / base) * 100) : 0

  return (
    <Link to="/settings#metas" className={`${styles.chip} ${styles[`chipTone_${info.tone}`]}`}>
      <span className={styles.chipLabel}>{dados.label}</span>
      <span className={styles.chipValue}>{fmtUnidadeCompacta(realizado, dados.unidade)}</span>
      <span className={styles.chipMeta}>/ {base > 0 ? fmtUnidadeCompacta(base, dados.unidade) : '—'}</span>
      <span className={styles.chipPct}>{base > 0 ? `${pct}%` : ''}</span>
    </Link>
  )
}
