import type { ReactNode } from 'react'
import { sectionInfo } from '@/lib/sectionColors'
import styles from './PageHeader.module.css'

interface PageHeaderProps {
  section?: string
  number?: string | number
  sectionLabel?: string
  color?: string
  title: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
}

export default function PageHeader({
  section,
  number,
  sectionLabel,
  color,
  title,
  subtitle,
  actions,
}: PageHeaderProps) {
  const info = sectionInfo(section)
  const n = number ?? info.number
  const lbl = sectionLabel ?? info.label
  const col = color ?? info.color

  return (
    <header className={styles.head}>
      <div className={styles.left}>
        <div className={styles.kicker} style={{ color: col }}>
          <span className={styles.num}>{n}</span>
          <span className={styles.sep}>//</span>
          <span>{lbl}</span>
        </div>
        <h1 className={styles.title}>{title}</h1>
        {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </header>
  )
}
