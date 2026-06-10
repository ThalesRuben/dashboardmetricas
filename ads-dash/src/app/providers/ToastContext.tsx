import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { TIMEOUTS } from '@/shared/lib/config'
import styles from './ToastContext.module.css'

const ToastContext = createContext(null)

let nextId = 1

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const dismiss = useCallback((id) => {
    setToasts(t => t.filter(x => x.id !== id))
  }, [])

  const push = useCallback((opts) => {
    const id = nextId++
    const tone = opts.tone || 'info'
    const duration = opts.duration ?? (tone === 'error' ? TIMEOUTS.feedbackErrorMs : TIMEOUTS.feedbackMs)
    setToasts(t => [...t, { id, tone, message: opts.message, title: opts.title }])
    if (duration > 0) {
      setTimeout(() => dismiss(id), duration)
    }
    return id
  }, [dismiss])

  const value = {
    push,
    dismiss,
    success: (message, opts = {}) => push({ ...opts, tone: 'success', message }),
    error:   (message, opts = {}) => push({ ...opts, tone: 'error',   message }),
    info:    (message, opts = {}) => push({ ...opts, tone: 'info',    message }),
    warn:    (message, opts = {}) => push({ ...opts, tone: 'warning', message }),
  }

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className={styles.stack} role="status" aria-live="polite">
        {toasts.map(t => (
          <Toast key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

function Toast({ toast, onDismiss }) {
  const [exiting, setExiting] = useState(false)

  useEffect(() => {
    const id = setTimeout(() => {}, 0) // noop, just to keep React happy
    return () => clearTimeout(id)
  }, [])

  function handleDismiss() {
    setExiting(true)
    setTimeout(onDismiss, 180)
  }

  const icon = {
    success: '✓',
    error:   '✕',
    warning: '⚠',
    info:    'ℹ',
  }[toast.tone] || 'ℹ'

  return (
    <div className={`${styles.toast} ${styles[`tone_${toast.tone}`]} ${exiting ? styles.exiting : ''}`}>
      <span className={styles.icon}>{icon}</span>
      <div className={styles.body}>
        {toast.title && <div className={styles.title}>{toast.title}</div>}
        <div className={styles.message}>{toast.message}</div>
      </div>
      <button className={styles.close} onClick={handleDismiss} aria-label="Fechar">×</button>
    </div>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast deve ser usado dentro de <ToastProvider>')
  return ctx
}
