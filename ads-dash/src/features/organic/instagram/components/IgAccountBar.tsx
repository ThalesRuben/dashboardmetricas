import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import styles from './IgAccountBar.module.css'

const STORAGE_KEY = 'ads-dash:connections'

interface ConnectionEntry {
  conta: string
  em: number
}

interface IgAccountBarProps {
  usingMock: boolean
  syncing: boolean
  onSync: () => void
}

function loadInstagramConnection(): ConnectionEntry | null {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    return raw?.instagram || null
  } catch {
    return null
  }
}

function formatLastSync(ts: number | null): string {
  if (!ts) return 'nunca sincronizado'
  const diff = Date.now() - ts
  const min = Math.floor(diff / 60_000)
  if (min < 1) return 'agora há pouco'
  if (min < 60) return `há ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `há ${h}h`
  const d = Math.floor(h / 24)
  return `há ${d}d`
}

export default function IgAccountBar({ usingMock, syncing, onSync }: IgAccountBarProps) {
  const [conn, setConn] = useState<ConnectionEntry | null>(loadInstagramConnection)
  const [accounts, setAccounts] = useState<string[]>([])
  const [selected, setSelected] = useState<string>('')

  // sync com mudanças no localStorage (caso o user conecte/desconecte em outra aba)
  useEffect(() => {
    function refresh() {
      const c = loadInstagramConnection()
      setConn(c)
      // base pra multi-conta: hoje vem 1 do connector + as conhecidas do projeto
      const known = ['@theblondeconcept', '@salao.bella']
      const list = c?.conta ? Array.from(new Set([c.conta, ...known])) : known
      setAccounts(list)
      setSelected(prev => prev || c?.conta || list[0])
    }
    refresh()
    window.addEventListener('storage', refresh)
    return () => window.removeEventListener('storage', refresh)
  }, [])

  const connected = !!conn
  const lastSync = formatLastSync(conn?.em ?? null)

  return (
    <div className={`${styles.bar} ${connected ? styles.barOn : styles.barOff}`}>
      <div className={styles.left}>
        <div className={styles.avatar}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="2" width="20" height="20" rx="5" />
            <circle cx="12" cy="12" r="4" />
            <circle cx="17.5" cy="6.5" r="1" fill="currentColor" />
          </svg>
        </div>
        <div className={styles.info}>
          <div className={styles.account}>
            <span className={`${styles.dot} ${!connected ? styles.dotOff : ''}`} />
            {accounts.length > 1 ? (
              <select
                className={styles.selector}
                value={selected}
                onChange={e => setSelected(e.target.value)}
                aria-label="Selecionar conta"
              >
                {accounts.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            ) : (
              <span className={styles.handle}>{selected || 'Nenhuma conta'}</span>
            )}
            {usingMock && <span className={styles.mockTag}>DEMO</span>}
          </div>
          <span className={styles.meta}>
            {connected
              ? `conectado · última sync ${lastSync}`
              : 'não conectado — dados de demonstração'}
          </span>
        </div>
      </div>

      <div className={styles.actions}>
        {connected ? (
          <button className={styles.btn} onClick={onSync} disabled={syncing}>
            {syncing ? 'Sincronizando...' : '↻ Sincronizar'}
          </button>
        ) : (
          <Link to="/integrations" className={`${styles.btn} ${styles.btnPrimary}`}>
            Conectar Instagram
          </Link>
        )}
      </div>
    </div>
  )
}
