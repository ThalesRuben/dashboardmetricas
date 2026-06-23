import { useState, useEffect } from 'react'
import { useMetas } from '../hooks/useMetas'
import { rotuloPeriodo } from '../lib/periodo'
import { KPIS_PADRAO } from '../api/types'
import type { MetaPeriodo, MetaKpi } from '../api/types'
import styles from './MetasSettings.module.css'

const PERIODOS: { id: MetaPeriodo; label: string }[] = [
  { id: 'semana',    label: 'Semana' },
  { id: 'trimestre', label: 'Trimestre' },
  { id: 'ano',       label: 'Ano' },
]

function isAuto(kpi: string): boolean {
  return KPIS_PADRAO.find(k => k.kpi === kpi)?.auto ?? false
}

export default function MetasSettings() {
  const [periodo, setPeriodo] = useState<MetaPeriodo>('semana')
  const { metas, loading, periodoRef, upsert } = useMetas({ periodo })

  return (
    <div className={styles.card}>
      <div className={styles.head}>
        <div>
          <h2 className={styles.title}>Metas</h2>
          <p className={styles.sub}>
            Defina o objetivo por KPI em cada período. Realizado dos KPIs marcados
            como <strong>auto</strong> é calculado do banco; os demais aceitam
            valor manual.
          </p>
        </div>
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
          {metas.map(m => (
            <Linha key={m.kpi} meta={m} periodo={periodo} onSalvar={upsert} />
          ))}
        </div>
      )}
    </div>
  )
}

interface LinhaProps {
  meta: MetaKpi
  periodo: MetaPeriodo
  onSalvar: (input: {
    kpi: string;
    valor_meta: number;
    valor_realizado?: number;
    unidade: MetaKpi['unidade'];
    label: string;
    ordem: number;
  }) => Promise<void>
}

function Linha({ meta, onSalvar }: LinhaProps) {
  const auto = isAuto(meta.kpi)
  const [metaVal, setMetaVal] = useState(String(meta.valor_meta))
  const [realVal, setRealVal] = useState(String(meta.valor_realizado))
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<number | null>(null)

  // Sincroniza quando muda de período (meta vem de outro fetch).
  useEffect(() => { setMetaVal(String(meta.valor_meta)) }, [meta.valor_meta])
  useEffect(() => { setRealVal(String(meta.valor_realizado)) }, [meta.valor_realizado])

  async function salvar() {
    const nMeta = Number(metaVal) || 0
    const nReal = auto ? undefined : (Number(realVal) || 0)
    if (nMeta === meta.valor_meta && (auto || nReal === meta.valor_realizado)) return
    setSaving(true)
    try {
      await onSalvar({
        kpi: meta.kpi,
        valor_meta: nMeta,
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
      <div className={styles.rowMid}>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Meta</span>
          <input
            type="number"
            className={styles.input}
            value={metaVal}
            onChange={e => setMetaVal(e.target.value)}
            onBlur={salvar}
            step="any"
            inputMode="decimal"
          />
        </label>
        <label className={`${styles.field} ${auto ? styles.fieldDisabled : ''}`}>
          <span className={styles.fieldLabel}>Realizado{auto && ' (auto)'}</span>
          <input
            type="number"
            className={styles.input}
            value={realVal}
            onChange={e => setRealVal(e.target.value)}
            onBlur={salvar}
            step="any"
            inputMode="decimal"
            disabled={auto}
            title={auto ? 'Computado automaticamente a partir das tabelas WhatsApp' : ''}
          />
        </label>
      </div>
      <div className={styles.rowRight}>
        {saving && <span className={styles.savingTag}>salvando...</span>}
        {!saving && recent && <span className={styles.savedTag}>✓ salvo</span>}
      </div>
    </div>
  )
}
