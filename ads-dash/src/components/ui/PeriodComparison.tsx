import { useMemo } from 'react'
import { generateDailyRange, aggregate, deltaPct, previousRange } from '@/features/ads/hooks/useDailyMetrics'
import { formatDate } from '@/shared/ui/DateRangePicker'
import styles from './PeriodComparison.module.css'

const ROWS = [
  { key: 'roas',         label: 'ROAS',          fmt: v => v.toFixed(2) + 'x',                 betterUp: true  },
  { key: 'roi',          label: 'ROI',           fmt: v => v + '%',                            betterUp: true  },
  { key: 'receita',      label: 'Receita',       fmt: v => 'R$ ' + v.toLocaleString('pt-BR'),  betterUp: true  },
  { key: 'investido',    label: 'Investimento',  fmt: v => 'R$ ' + v.toLocaleString('pt-BR'),  betterUp: false },
  { key: 'ctr',          label: 'CTR',           fmt: v => v.toFixed(2) + '%',                 betterUp: true  },
  { key: 'mensagens',    label: 'Mensagens',     fmt: v => v.toLocaleString('pt-BR'),          betterUp: true  },
  { key: 'agendamentos', label: 'Agendamentos',  fmt: v => v.toLocaleString('pt-BR'),          betterUp: true  },
  { key: 'vendas',       label: 'Vendas',        fmt: v => v.toLocaleString('pt-BR'),          betterUp: true  },
  { key: 'cliques',      label: 'Cliques',       fmt: v => v.toLocaleString('pt-BR'),          betterUp: true  },
  { key: 'impressoes',   label: 'Impressões',    fmt: v => v.toLocaleString('pt-BR'),          betterUp: true  },
]

export default function PeriodComparison({ rangeA, rangeB }) {
  const a = useMemo(() => rangeA ? aggregate(generateDailyRange(rangeA.from, rangeA.to)) : null, [rangeA?.from?.getTime?.(), rangeA?.to?.getTime?.()])
  const b = useMemo(() => rangeB ? aggregate(generateDailyRange(rangeB.from, rangeB.to)) : null, [rangeB?.from?.getTime?.(), rangeB?.to?.getTime?.()])

  if (!a || !b) {
    return <div className={styles.card}><div className={styles.empty}>Selecione dois períodos para comparar.</div></div>
  }

  const narrative = buildNarrative(a, b)

  return (
    <div className={styles.card}>
      <div className={styles.head}>
        <h3 className={styles.title}>Comparativo de períodos</h3>
        <p className={styles.sub}>Variação percentual e absoluta entre os dois intervalos</p>
      </div>

      <div className={styles.narrative}>
        <span className={styles.narrativeTag}>RESUMO EM 1 FRASE</span>
        <p className={styles.narrativeTxt}>{narrative}</p>
      </div>

      <div className={styles.headerRow}>
        <div className={styles.colLabel}>Métrica</div>
        <div className={styles.colA}>
          <div className={styles.periodLabel}>Período A</div>
          <div className={styles.periodDates}>{formatDate(rangeA.from)} – {formatDate(rangeA.to)}</div>
          <div className={styles.periodDays}>{a.days} dia(s)</div>
        </div>
        <div className={styles.colB}>
          <div className={styles.periodLabel}>Período B</div>
          <div className={styles.periodDates}>{formatDate(rangeB.from)} – {formatDate(rangeB.to)}</div>
          <div className={styles.periodDays}>{b.days} dia(s)</div>
        </div>
        <div className={styles.colDelta}>Variação</div>
      </div>

      <div className={styles.rows}>
        {ROWS.map(r => {
          const va = a[r.key] ?? 0
          const vb = b[r.key] ?? 0
          const pct = deltaPct(va, vb)
          const better = r.betterUp ? pct > 0 : pct < 0
          const sym = pct > 0 ? '▲' : pct < 0 ? '▼' : '·'
          const cls = pct === 0 ? styles.deltaNeutral : better ? styles.deltaUp : styles.deltaDown
          return (
            <div key={r.key} className={styles.row}>
              <div className={styles.cellLabel}>{r.label}</div>
              <div className={styles.cellA}>{r.fmt(va)}</div>
              <div className={styles.cellB}>{r.fmt(vb)}</div>
              <div className={`${styles.cellDelta} ${cls}`}>
                <span className={styles.deltaSym}>{sym}</span>
                {Math.abs(pct).toFixed(1)}%
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function buildNarrative(a, b) {
  const invDelta = deltaPct(a.investido, b.investido)
  const recDelta = deltaPct(a.receita, b.receita)
  const efic = +(recDelta - invDelta).toFixed(1)
  const sign = n => (n >= 0 ? '+' : '') + n.toFixed(1) + '%'

  let efiTxt
  if (efic >= 3)       efiTxt = `eficiência subiu ${efic} pontos`
  else if (efic <= -3) efiTxt = `eficiência caiu ${Math.abs(efic)} pontos`
  else                  efiTxt = 'eficiência estável'

  const vendasDelta = deltaPct(a.vendas, b.vendas)
  const vendaTxt = vendasDelta > 5  ? `e fechou ${sign(vendasDelta)} vendas` :
                   vendasDelta < -5 ? `mas fechou ${sign(vendasDelta)} vendas` :
                                       'com vendas no mesmo nível'

  return `No período A você gastou ${sign(invDelta)}, faturou ${sign(recDelta)} ${vendaTxt} — ${efiTxt} comparado ao período B.`
}

export { previousRange }
