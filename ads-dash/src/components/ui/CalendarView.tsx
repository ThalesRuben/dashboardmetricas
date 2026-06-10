import { useState, useMemo } from 'react'
import { generateDailyRange } from '@/features/ads/hooks/useDailyMetrics'
import styles from './CalendarView.module.css'

const DOW = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']
const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

const METRIC_OPTIONS = [
  { key: 'receita',   label: 'Receita',     fmt: v => 'R$' + Math.round(v/1000) + 'k', threshold: { good: 3500, mid: 2200 } },
  { key: 'roas',      label: 'ROAS',        fmt: v => v.toFixed(1) + 'x',              threshold: { good: 4.0,  mid: 3.0 } },
  { key: 'vendas',    label: 'Vendas',      fmt: v => v,                                threshold: { good: 30,   mid: 18 } },
  { key: 'mensagens', label: 'Mensagens',   fmt: v => v,                                threshold: { good: 130,  mid: 80 } },
  { key: 'investido', label: 'Investimento',fmt: v => 'R$' + Math.round(v/100)*100,    threshold: { good: 1500, mid: 0  } },
]

export default function CalendarView({ initialDate = null }) {
  const [cursor, setCursor] = useState(() => {
    const d = initialDate ? new Date(initialDate) : new Date()
    d.setDate(1)
    d.setHours(0, 0, 0, 0)
    return d
  })
  const [metric, setMetric] = useState('receita')
  const [hoveredDay, setHoveredDay] = useState(null)

  const days = useMemo(() => {
    const start = new Date(cursor.getFullYear(), cursor.getMonth(), 1)
    const end   = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0)
    return generateDailyRange(start, end)
  }, [cursor.getTime()])

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const firstDow = new Date(cursor.getFullYear(), cursor.getMonth(), 1).getDay()
  const blanks = Array(firstDow).fill(null)

  const opt = METRIC_OPTIONS.find(o => o.key === metric)
  const max = Math.max(...days.map(d => d[metric] || 0))

  function prevMonth() {
    const next = new Date(cursor); next.setMonth(next.getMonth() - 1); setCursor(next)
  }
  function nextMonth() {
    const next = new Date(cursor); next.setMonth(next.getMonth() + 1); setCursor(next)
  }

  function intensity(value) {
    if (!value) return 0
    return Math.min(1, value / max)
  }

  return (
    <div className={styles.card}>
      <div className={styles.head}>
        <div className={styles.navRow}>
          <button className={styles.navBtn} onClick={prevMonth} title="Mês anterior">‹</button>
          <h3 className={styles.monthTitle}>{MONTHS[cursor.getMonth()]} {cursor.getFullYear()}</h3>
          <button className={styles.navBtn} onClick={nextMonth} title="Próximo mês">›</button>
        </div>

        <div className={styles.metricRow}>
          {METRIC_OPTIONS.map(m => (
            <button
              key={m.key}
              className={`${styles.metricBtn} ${metric === m.key ? styles.metricActive : ''}`}
              onClick={() => setMetric(m.key)}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.dowRow}>
        {DOW.map(d => <div key={d} className={styles.dowCell}>{d}</div>)}
      </div>

      <div className={styles.grid}>
        {blanks.map((_, i) => <div key={`b${i}`} className={styles.blank} />)}
        {days.map(d => {
          const dt = new Date(d.iso)
          const isToday  = dt.toDateString() === today.toDateString()
          const isFuture = dt > today
          const value = d[metric] || 0
          const inten = intensity(value)
          return (
            <div
              key={d.date}
              className={`${styles.cell} ${isToday ? styles.cellToday : ''} ${isFuture ? styles.cellFuture : ''}`}
              onMouseEnter={() => setHoveredDay(d)}
              onMouseLeave={() => setHoveredDay(null)}
              style={!isFuture ? ({ '--heat': inten } as React.CSSProperties) : undefined}
            >
              <div className={styles.cellNum}>{dt.getDate()}</div>
              {!isFuture && (
                <>
                  <div className={styles.cellMain}>{opt.fmt(value)}</div>
                  {d.posts > 0 && <div className={styles.cellPosts}>📷 {d.posts}</div>}
                </>
              )}
            </div>
          )
        })}
      </div>

      {hoveredDay && (
        <div className={styles.tooltipBar}>
          <strong>{new Date(hoveredDay.iso).toLocaleDateString('pt-BR', { weekday:'long', day:'2-digit', month:'long' })}</strong>
          <span>ROAS <strong>{hoveredDay.roas}x</strong></span>
          <span>Receita <strong>R$ {hoveredDay.receita.toLocaleString('pt-BR')}</strong></span>
          <span>Vendas <strong>{hoveredDay.vendas}</strong></span>
          <span>Mensagens <strong>{hoveredDay.mensagens}</strong></span>
          <span>CTR <strong>{hoveredDay.ctr}%</strong></span>
          {hoveredDay.posts > 0 && <span>📷 <strong>{hoveredDay.posts} post(s)</strong></span>}
        </div>
      )}

      <div className={styles.legend}>
        <span className={styles.legendLabel}>Menos</span>
        <div className={styles.legendCells}>
          {[0.15, 0.35, 0.55, 0.75, 1].map(v => (
            <div key={v} className={styles.legendCell} style={{ '--heat': v } as React.CSSProperties} />
          ))}
        </div>
        <span className={styles.legendLabel}>Mais</span>
      </div>
    </div>
  )
}
