import type { ReactNode } from 'react'
import styles from './EmptyState.module.css'

interface ProgressItem { label: string; current: number; target: number }
interface PartialItem { label: string; value: string; valueColor?: string }
interface Cta { label: string; onClick: () => void }

interface EmptyStateProps {
  icon?: ReactNode
  title: ReactNode
  description?: ReactNode
  progress?: ProgressItem[]
  partialData?: PartialItem[]
  cta?: Cta
}

export default function EmptyState({ icon, title, description, progress, partialData, cta }: EmptyStateProps) {
  return (
    <div className={styles.box}>
      {icon && <div className={styles.icon}>{icon}</div>}
      <h2 className={styles.title}>{title}</h2>
      {description && <p className={styles.desc}>{description}</p>}

      {progress && progress.length > 0 && (
        <div className={styles.progress}>
          {progress.map((p, i) => {
            const pct = Math.min(100, Math.round((p.current / p.target) * 100))
            return (
              <div key={i} className={styles.progressRow}>
                <div className={styles.progressLabelRow}>
                  <span className={styles.progressLabel}>{p.label}</span>
                  <span className={styles.progressValue}>{p.current} / {p.target}</span>
                </div>
                <div className={styles.progressTrack}>
                  <span className={styles.progressFill} style={{ width: `${pct}%` }} />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {partialData && partialData.length > 0 && (
        <div className={styles.partial}>
          <span className={styles.partialTag}>ENQUANTO ISSO</span>
          <div className={styles.partialRow}>
            {partialData.map((p, i) => (
              <div key={i} className={styles.partialItem}>
                <span className={styles.partialValue} style={p.valueColor ? { color: p.valueColor } : undefined}>
                  {p.value}
                </span>
                <span className={styles.partialLabel}>{p.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {cta && (
        <button className={styles.cta} onClick={cta.onClick}>
          {cta.label}
        </button>
      )}
    </div>
  )
}
