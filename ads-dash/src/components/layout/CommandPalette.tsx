import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import styles from './CommandPalette.module.css'

/**
 * Paleta de comandos — ⌘K / Ctrl+K.
 * Cada item tem `label`, `hint`, `icon` e ou `to` (rota) ou `action` (fn).
 * `kind` controla agrupamento visual ('nav' | 'action').
 */
export default function CommandPalette({ commands }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    function onKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen(o => !o)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (open) {
      setQuery('')
      setActive(0)
      setTimeout(() => inputRef.current?.focus(), 20)
    }
  }, [open])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return commands
    return commands.filter(c =>
      c.label.toLowerCase().includes(q) || c.hint?.toLowerCase().includes(q)
    )
  }, [query, commands])

  async function run(cmd) {
    if (!cmd) return
    setOpen(false)
    if (cmd.action) {
      try { await cmd.action() } catch (_) { /* ignore */ }
    } else if (cmd.to) {
      navigate(cmd.to)
    }
  }

  function onKeyDown(e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(a + 1, results.length - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setActive(a => Math.max(a - 1, 0)) }
    if (e.key === 'Enter')     { e.preventDefault(); run(results[active]) }
  }

  if (!open) return null

  // separa visualmente as ações das navegações
  const navItems = results.filter(c => c.kind !== 'action')
  const actionItems = results.filter(c => c.kind === 'action')

  let cursor = -1
  const nextIndex = () => ++cursor

  return (
    <div className={styles.overlay} onMouseDown={() => setOpen(false)}>
      <div className={`${styles.palette} cc-frame`} onMouseDown={e => e.stopPropagation()}>
        <div className={styles.searchRow}>
          <span className={styles.prompt}>&gt;_</span>
          <input
            ref={inputRef}
            className={styles.input}
            placeholder="Buscar ou executar comando..."
            value={query}
            onChange={e => { setQuery(e.target.value); setActive(0) }}
            onKeyDown={onKeyDown}
          />
          <kbd className={styles.kbd}>ESC</kbd>
        </div>
        <div className={styles.list}>
          {results.length === 0 && (
            <div className={styles.empty}>Nenhum comando encontrado</div>
          )}

          {navItems.length > 0 && <div className={styles.group}>NAVEGAR</div>}
          {navItems.map(c => {
            const i = nextIndex()
            return (
              <Row key={c.to || c.label} cmd={c} active={i === active}
                   onHover={() => setActive(i)} onClick={() => run(c)} />
            )
          })}

          {actionItems.length > 0 && <div className={styles.group}>EXECUTAR</div>}
          {actionItems.map(c => {
            const i = nextIndex()
            return (
              <Row key={c.label} cmd={c} active={i === active}
                   onHover={() => setActive(i)} onClick={() => run(c)} />
            )
          })}
        </div>
        <div className={styles.footer}>
          <span><kbd className={styles.kbd}>↑↓</kbd> navegar</span>
          <span><kbd className={styles.kbd}>↵</kbd> executar</span>
          <span className={styles.brandTag}>COMMAND CENTER</span>
        </div>
      </div>
    </div>
  )
}

function Row({ cmd, active, onHover, onClick }) {
  return (
    <button
      className={`${styles.row} ${active ? styles.rowActive : ''}`}
      onMouseEnter={onHover}
      onClick={onClick}
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d={cmd.icon} />
      </svg>
      <span className={styles.rowLabel}>{cmd.label}</span>
      {cmd.hint && <span className={styles.rowHint}>{cmd.hint}</span>}
      <span className={styles.rowGo}>{cmd.kind === 'action' ? '▸' : '↵'}</span>
    </button>
  )
}
