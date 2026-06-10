import type { ReactNode } from 'react'
import Sparkline from './Sparkline'
import styles from './KpiCard.module.css'

interface KpiCardProps {
  label: ReactNode
  value: ReactNode
  delta?: ReactNode
  up?: boolean
  neutral?: boolean
  serie?: number[]
  onClick?: () => void
  tone?: 'accent' | 'magenta' | 'amber' | 'plain'
  accentColor?: string
}

export default function KpiCard({
  label,
  value,
  delta,
  up,
  neutral,
  serie,
  onClick,
  tone = 'plain',
  accentColor,
}: KpiCardProps) {
  const Tag = onClick ? 'button' : 'div'
  const sparkColor = accentColor
    || (tone === 'magenta' ? 'var(--magenta)'
     :  tone === 'amber'   ? 'var(--amber)'
     :  tone === 'accent'  ? 'var(--accent)'
     :                       'var(--text-subtle)')
  const direction = neutral || !delta ? 'neutral' : up ? 'up' : 'down'

  return (
    <Tag
      type={onClick ? 'button' : undefined}
      className={`${styles.card} ${onClick ? styles.clickable : ''}`}
      onClick={onClick}
    >
      <div className={styles.label}>{label}</div>
      <div className={styles.row}>
        <span className={styles.value} style={accentColor ? { color: accentColor } : undefined}>
          {value}
        </span>
        {!neutral && delta && (
          <span className={`${styles.delta} ${styles['d_' + direction]}`}>
            {direction === 'up' ? '↑' : direction === 'down' ? '↓' : '—'} {delta}
          </span>
        )}
        {neutral && <span className={styles.neutralBadge}>—</span>}
      </div>
      {serie && serie.length > 1 && (
        <div className={styles.spark}>
          <Sparkline serie={serie} color={sparkColor} width={140} height={22} />
        </div>
      )}
    </Tag>
  )
}
