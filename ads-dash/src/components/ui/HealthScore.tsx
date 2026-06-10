import { computeHealth } from '@/lib/healthScore'
import styles from './HealthScore.module.css'

// Health Score — um único número 0-100 do quão saudável o marketing está.
// Decomposto em 4 dimensões. Estilo Apple Health / Whoop.
export default function HealthScore({ summary, prev, ig, whatsapp, competitors = null }) {
  const h = computeHealth({ summary, prev, ig, whatsapp, competitors })
  const dashArr = 226 // ~2π·36
  const offset = dashArr * (1 - h.total / 100)

  return (
    <div className={`${styles.card} cc-frame`}>
      <div className={styles.headRow}>
        <div className={styles.ring}>
          <svg width="92" height="92" viewBox="0 0 92 92">
            <circle cx="46" cy="46" r="36" stroke="var(--border)" strokeWidth="6" fill="none" />
            <circle
              cx="46" cy="46" r="36"
              stroke={`var(--${h.verdict.tone === 'accent' ? 'accent' : h.verdict.tone === 'good' ? 'color-success' : h.verdict.tone === 'warn' ? 'amber' : 'magenta'})`}
              strokeWidth="6"
              fill="none"
              strokeLinecap="round"
              strokeDasharray={dashArr}
              strokeDashoffset={offset}
              transform="rotate(-90 46 46)"
              style={{ transition: 'stroke-dashoffset .5s ease-out' }}
            />
          </svg>
          <div className={styles.ringInner}>
            <span className={styles.ringNum}>{h.total}</span>
            <span className={styles.ringMax}>/100</span>
          </div>
        </div>
        <div className={styles.headTxt}>
          <span className={styles.headTag}>HEALTH SCORE</span>
          <h2 className={styles.headTitle}>Operação</h2>
          <span className={`${styles.verdict} ${styles['v_' + h.verdict.tone]}`}>{h.verdict.label}</span>
          {h.trend !== 0 && (
            <span className={styles.trend}>
              {h.trend > 0 ? '▲' : '▼'} {Math.abs(h.trend)}% no ROAS vs período anterior
            </span>
          )}
        </div>
      </div>

      <div className={styles.dims}>
        {h.dims.map(d => (
          <div key={d.key} className={styles.dim}>
            <div className={styles.dimHead}>
              <span className={styles.dimLabel}>{d.label}</span>
              <span className={`${styles.dimScore} ${styles['s_' + d.tone]}`}>{d.score}</span>
            </div>
            <div className={styles.bar}>
              <span
                className={`${styles.barFill} ${styles['b_' + d.tone]}`}
                style={{ width: `${d.score}%` }}
              />
            </div>
            <span className={styles.dimNote}>{d.txt}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
