import { useState, useEffect } from 'react'
import { useMetas } from '../hooks/useMetas'
import { rotuloPeriodo } from '../lib/periodo'
import { KPIS_PADRAO } from '../api/types'
import { seedMetas2026 } from '../lib/seed2026'
import type { MetaPeriodo, MetaKpi } from '../api/types'
import styles from './MetasSettings.module.css'

const PERIODOS: { id: MetaPeriodo; label: string }[] = [
  { id: 'semana',    label: 'Semana' },
  { id: 'mes',       label: 'Mês' },
  { id: 'trimestre', label: 'Trimestre' },
  { id: 'ano',       label: 'Ano' },
]

function isAuto(kpi: string): boolean {
  return KPIS_PADRAO.find(k => k.kpi === kpi)?.auto ?? false
}

export default function MetasSettings() {
  const [periodo, setPeriodo] = useState<MetaPeriodo>('trimestre')
  const { metas, loading, periodoRef, upsert, refresh } = useMetas({ periodo })
  const [seeding, setSeeding] = useState(false)
  const [seedDone, setSeedDone] = useState(false)

  async function aplicarSeed() {
    if (!confirm('Aplicar metas reais de 2026 (Q1–Q4 + 12 meses)? Sobrescreve metas existentes nesses períodos.')) return
    setSeeding(true)
    try {
      await seedMetas2026()
      setSeedDone(true)
      setTimeout(() => setSeedDone(false), 4000)
      await refresh()
    } finally {
      setSeeding(false)
    }
  }

  return (
    <div className={styles.card}>
      <div className={styles.head}>
        <div>
          <h2 className={styles.title}>Metas</h2>
          <p className={styles.sub}>
            Defina cenários <strong>mín / base / máx</strong> por KPI em cada período.
            Realizado dos KPIs <strong>auto</strong> é calculado do banco.
          </p>
        </div>
        <button
          type="button"
          className={styles.seedBtn}
          onClick={aplicarSeed}
          disabled={seeding}
          title="Carrega os números reais de 2026 (faturamento + tráfego, por trimestre e mês)"
        >
          {seeding ? 'Aplicando...' : seedDone ? '✓ aplicado' : 'Aplicar metas 2026'}
        </button>
      </div>

      <div className={styles.tabs}>
        {PERIODOS.map(p => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPeriodo(p.id)}
            className={`${styles.tab} ${periodo === p.id ? styles.tabActive : ''}`}
          >
            {p.label}
          </button>
        ))}
        <span className={styles.refLabel}>{rotuloPeriodo(periodo, periodoRef)}</span>
      </div>

      {loading ? (
        <p className={styles.loading}>Carregando...</p>
      ) : (
        <div className={styles.list}>
          <div className={styles.colHead}>
            <span></span>
            <span>Mín</span>
            <span>Base</span>
            <span>Máx</span>
            <span>Realizado</span>
            <span></span>
          </div>
          {metas.map(m => (
            <Linha key={m.kpi} meta={m} onSalvar={upsert} />
          ))}
        </div>
      )}
    </div>
  )
}

interface LinhaProps {
  meta: MetaKpi
  onSalvar: (input: {
    kpi: string;
    valor_meta: number;
    valor_meta_min?: number | null;
    valor_meta_max?: number | null;
    valor_realizado?: number;
    unidade: MetaKpi['unidade'];
    label: string;
    ordem: number;
  }) => Promise<void>
}

function strOuVazio(n: number | null | undefined): string {
  if (n == null || n === 0) return ''
  return String(n)
}

function Linha({ meta, onSalvar }: LinhaProps) {
  const auto = isAuto(meta.kpi)
  const [minVal,  setMinVal]  = useState(strOuVazio(meta.valor_meta_min))
  const [baseVal, setBaseVal] = useState(strOuVazio(meta.valor_meta))
  const [maxVal,  setMaxVal]  = useState(strOuVazio(meta.valor_meta_max))
  const [realVal, setRealVal] = useState(strOuVazio(meta.valor_realizado))
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<number | null>(null)

  useEffect(() => { setMinVal(strOuVazio(meta.valor_meta_min)) }, [meta.valor_meta_min])
  useEffect(() => { setBaseVal(strOuVazio(meta.valor_meta)) }, [meta.valor_meta])
  useEffect(() => { setMaxVal(strOuVazio(meta.valor_meta_max)) }, [meta.valor_meta_max])
  useEffect(() => { setRealVal(strOuVazio(meta.valor_realizado)) }, [meta.valor_realizado])

  async function salvar() {
    const nBase = Number(baseVal) || 0
    const nMin  = minVal === '' ? null : (Number(minVal) || 0)
    const nMax  = maxVal === '' ? null : (Number(maxVal) || 0)
    const nReal = auto ? undefined : (Number(realVal) || 0)
    const inalterado = (
      nBase === meta.valor_meta &&
      nMin  === meta.valor_meta_min &&
      nMax  === meta.valor_meta_max &&
      (auto || nReal === meta.valor_realizado)
    )
    if (inalterado) return
    setSaving(true)
    try {
      await onSalvar({
        kpi: meta.kpi,
        valor_meta: nBase,
        valor_meta_min: nMin,
        valor_meta_max: nMax,
        valor_realizado: nReal,
        unidade: meta.unidade,
        label: meta.label || meta.kpi,
        ordem: meta.ordem,
      })
      setSavedAt(Date.now())
    } finally {
      setSaving(false)
    }
  }

  const recent = savedAt && Date.now() - savedAt < 3000

  return (
    <div className={styles.row}>
      <div className={styles.rowLeft}>
        <span className={styles.kpiLabel}>{meta.label || meta.kpi}</span>
        <span className={styles.kpiHint}>
          {meta.unidade.toUpperCase()} {auto && '· auto'}
        </span>
      </div>
      <input
        type="number"
        className={styles.input}
        value={minVal}
        onChange={e => setMinVal(e.target.value)}
        onBlur={salvar}
        step="any"
        inputMode="decimal"
        placeholder="—"
      />
      <input
        type="number"
        className={styles.input}
        value={baseVal}
        onChange={e => setBaseVal(e.target.value)}
        onBlur={salvar}
        step="any"
        inputMode="decimal"
        placeholder="0"
      />
      <input
        type="number"
        className={styles.input}
        value={maxVal}
        onChange={e => setMaxVal(e.target.value)}
        onBlur={salvar}
        step="any"
        inputMode="decimal"
        placeholder="—"
      />
      <input
        type="number"
        className={`${styles.input} ${auto ? styles.inputDisabled : ''}`}
        value={realVal}
        onChange={e => setRealVal(e.target.value)}
        onBlur={salvar}
        step="any"
        inputMode="decimal"
        disabled={auto}
        placeholder={auto ? 'auto' : '0'}
        title={auto ? 'Computado automaticamente a partir das tabelas WhatsApp' : ''}
      />
      <div className={styles.rowRight}>
        {saving && <span className={styles.savingTag}>salvando...</span>}
        {!saving && recent && <span className={styles.savedTag}>✓</span>}
      </div>
    </div>
  )
}
