import type { ReactNode } from 'react'
import styles from './HeroBlock.module.css'

interface HeroBlockProps {
  left: ReactNode
  right: ReactNode
  columns?: '1.6:1' | '2:1' | '1:1'
}

export default function HeroBlock({ left, right, columns = '1.6:1' }: HeroBlockProps) {
  const cls =
    columns === '2:1'   ? styles.col21 :
    columns === '1:1'   ? styles.col11 :
                          styles.col1611
  return (
    <div className={`${styles.wrap} ${cls}`}>
      <div className={styles.panel}>{left}</div>
      <div className={styles.panel}>{right}</div>
    </div>
  )
}
