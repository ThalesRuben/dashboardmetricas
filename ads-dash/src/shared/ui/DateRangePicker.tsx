import { useState, useRef, useEffect } from 'react'
import styles from './DateRangePicker.module.css'

interface PresetItem {
  key: string
  label: string
  days: number | null
  offset?: number
}

interface DateRange {
  from: Date
  to: Date
  presetKey?: string
}

interface DateRangePickerProps {
  value?: DateRange | null
  onChange?: (range: DateRange | null) => void
  presets?: PresetItem[]
  initialDate?: Date
}

const PRESETS: PresetItem[] = [
  { key: 'hoje',    label: 'Hoje',          days: 1   },
  { key: 'ontem',   label: 'Ontem',         days: 1, offset: 1 },
  { key: '7',       label: 'Últimos 7d',    days: 7   },
  { key: '14',      label: 'Últimos 14d',   days: 14  },
  { key: '30',      label: 'Últimos 30d',   days: 30  },
  { key: '90',      label: 'Últimos 90d',   days: 90  },
  { key: 'custom',  label: 'Personalizado', days: null },
]

function fmt(d: Date | null | undefined): string {
  if (!d) return ''
  const day = String(d.getDate()).padStart(2, '0')
  const mon = String(d.getMonth() + 1).padStart(2, '0')
  return `${day}/${mon}/${d.getFullYear()}`
}

function toInput(d: Date | null | undefined): string {
  if (!d) return ''
  return d.toISOString().slice(0, 10)
}

function fromPreset(key: string): DateRange | null {
  const preset = PRESETS.find(p => p.key === key)
  if (!preset || !preset.days) return null
  const to = new Date()
  to.setHours(23, 59, 59, 999)
  const from = new Date(to)
  if (preset.offset) {
    to.setDate(to.getDate() - preset.offset)
    from.setDate(from.getDate() - preset.offset - preset.days + 1)
  } else {
    from.setDate(from.getDate() - preset.days + 1)
  }
  from.setHours(0, 0, 0, 0)
  return { from, to, presetKey: key }
}

export default function DateRangePicker({ value, onChange, presets = PRESETS }: DateRangePickerProps) {
  const [open, setOpen] = useState(false)
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function handlePreset(key: string) {
    if (key === 'custom') {
      setCustomFrom(toInput(value?.from))
      setCustomTo(toInput(value?.to))
      return
    }
    const range = fromPreset(key)
    onChange?.(range)
    setOpen(false)
  }

  function applyCustom() {
    if (!customFrom || !customTo) return
    const from = new Date(customFrom + 'T00:00:00')
    const to   = new Date(customTo   + 'T23:59:59')
    if (from > to) return
    onChange?.({ from, to, presetKey: 'custom' })
    setOpen(false)
  }

  const label = value
    ? value.presetKey && value.presetKey !== 'custom'
      ? presets.find(p => p.key === value.presetKey)?.label || `${fmt(value.from)} – ${fmt(value.to)}`
      : `${fmt(value.from)} – ${fmt(value.to)}`
    : 'Selecionar período'

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button className={styles.trigger} onClick={() => setOpen(o => !o)}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/>
          <line x1="8" y1="2" x2="8" y2="6"/>
          <line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        <span>{label}</span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
      </button>

      {open && (
        <div className={styles.panel}>
          <div className={styles.presets}>
            {presets.map(p => (
              <button
                key={p.key}
                className={`${styles.preset} ${value?.presetKey === p.key ? styles.presetActive : ''}`}
                onClick={() => handlePreset(p.key)}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className={styles.customSection}>
            <div className={styles.customLabel}>Personalizado</div>
            <div className={styles.customRow}>
              <input
                type="date"
                className={styles.dateInput}
                value={customFrom}
                onChange={e => setCustomFrom(e.target.value)}
              />
              <span className={styles.dash}>–</span>
              <input
                type="date"
                className={styles.dateInput}
                value={customTo}
                onChange={e => setCustomTo(e.target.value)}
              />
            </div>
            <button className={styles.applyBtn} onClick={applyCustom} disabled={!customFrom || !customTo}>
              Aplicar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export { fromPreset, fmt as formatDate }
