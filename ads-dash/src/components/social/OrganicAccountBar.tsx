import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import styles from './OrganicAccountBar.module.css'

const STORAGE_KEY = 'ads-dash:connections'

interface ConnectionEntry {
  conta: string
  em: number
}

export interface OrganicAccountBarProps {
  /** chave usada em `localStorage["ads-dash:connections"][connectorKey]` */
  connectorKey: 'instagram' | 'tiktok' | 'youtube'
  /** label exibido no botão "Conectar X" */
  platformLabel: string
  /** cor de destaque (CSS var) — ex: `var(--section-tiktok)` */
  sectionColor: string
  /** ícone SVG (path d=...) ou ReactNode customizado */
  icon: ReactNode
  /** lista de contas conhecidas — preenche o selector quando há >1 */
  knownAccounts?: string[]
  /** true quando o app está rodando em mock — mostra tag DEMO */
  usingMock: boolean
  /** opcional — se passado, mostra botão "↻ Sincronizar"; sem isso, omite */
  syncing?: boolean
  onSync?: () => void
  /** mensagem custom abaixo do handle (sobrescreve o default) */
  metaOverride?: string
}

function loadConnection(key: string): ConnectionEntry | null {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    return raw?.[key] || null
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

export default function OrganicAccountBar({
  connectorKey,
  platformLabel,
  sectionColor,
  icon,
  knownAccounts = [],
  usingMock,
  syncing = false,
  onSync,
  metaOverride,
}: OrganicAccountBarProps) {
  const [conn, setConn] = useState<ConnectionEntry | null>(() => loadConnection(connectorKey))
  const [accounts, setAccounts] = useState<string[]>([])
  const [selected, setSelected] = useState<string>('')

  useEffect(() => {
    function refresh() {
      const c = loadConnection(connectorKey)
      setConn(c)
      const list = c?.conta
        ? Array.from(new Set([c.conta, ...knownAccounts]))
        : knownAccounts
      setAccounts(list)
      setSelected(prev => prev || c?.conta || list[0] || '')
    }
    refresh()
    window.addEventListener('storage', refresh)
    return () => window.removeEventListener('storage', refresh)
  }, [connectorKey, knownAccounts])

  const connected = !!conn
  const lastSync = formatLastSync(conn?.em ?? null)
  const styleVar = { '--bar-accent': sectionColor } as CSSProperties

  const meta = metaOverride
    ? metaOverride
    : connected
      ? `conectado · última sync ${lastSync}`
      : 'não conectado — dados de demonstração'

  return (
    <div className={`${styles.bar} ${connected ? styles.barOn : ''}`} style={styleVar}>
      <div className={styles.left}>
        <div className={styles.avatar}>{icon}</div>
        <div className={styles.info}>
          <div className={styles.account}>
            <span className={`${styles.dot} ${!connected ? styles.dotOff : ''}`} />
            {accounts.length > 1 ? (
              <select
                className={styles.selector}
                value={selected}
                onChange={e => setSelected(e.target.value)}
                aria-label={`Selecionar conta ${platformLabel}`}
              >
                {accounts.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            ) : (
              <span className={styles.handle}>{selected || 'Nenhuma conta'}</span>
            )}
            {usingMock && <span className={styles.mockTag}>DEMO</span>}
          </div>
          <span className={styles.meta}>{meta}</span>
        </div>
      </div>

      <div className={styles.actions}>
        {connected && onSync ? (
          <button className={styles.btn} onClick={onSync} disabled={syncing}>
            {syncing ? 'Sincronizando...' : '↻ Sincronizar'}
          </button>
        ) : !connected ? (
          <Link to="/integrations" className={`${styles.btn} ${styles.btnPrimary}`}>
            Conectar {platformLabel}
          </Link>
        ) : null}
      </div>
    </div>
  )
}
