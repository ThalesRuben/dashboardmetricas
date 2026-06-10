import type { ReactNode } from 'react'
import styles from './Tabs.module.css'

interface TabItem {
  id: string
  label: ReactNode
  badge?: ReactNode | number
}

interface TabsProps {
  items: TabItem[]
  activeId: string
  onChange: (id: string) => void
  accentColor?: string
}

export default function Tabs({ items, activeId, onChange, accentColor = 'var(--accent)' }: TabsProps) {
  return (
    <div className={styles.tabs} role="tablist">
      {items.map(it => {
        const active = it.id === activeId
        return (
          <button
            key={it.id}
            role="tab"
            aria-selected={active}
            className={`${styles.tab} ${active ? styles.active : ''}`}
            style={active ? { borderBottomColor: accentColor, color: 'var(--text)' } : undefined}
            onClick={() => onChange(it.id)}
          >
            {it.label}
            {it.badge != null && it.badge !== '' && (
              <span
                className={styles.badge}
                style={active ? { background: accentColor, color: '#04130f' } : undefined}
              >
                {it.badge}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
