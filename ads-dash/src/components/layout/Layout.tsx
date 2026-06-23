import { useState, useEffect } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/app/providers/AuthContext'
import { useInstagramMetrics } from '@/features/organic/instagram/hooks/useInstagramMetrics'
import { detectHype, HYPE_LEVELS } from '@/features/organic/instagram/lib/hypeDetector'
import AiAssistant from '@/components/ai/AiAssistant'
import ErrorBoundary from '@/app/ErrorBoundary'
import { useToast } from '@/app/providers/ToastContext'
import CommandPalette from './CommandPalette'
import styles from './Layout.module.css'

const ITEMS = {
  dashboard:    { n: '01', to: '/',             label: 'Dashboard',     hint: 'MÉTRICAS', icon: 'M3 3h7v7H3zm0 9h7v7H3zm9-9h7v7h-7zm0 9h7v7h-7z' },
  metas:        { n: '15', to: '/metas',        label: 'Metas',         hint: 'KPI',      icon: 'M12 22a10 10 0 100-20 10 10 0 000 20zM12 18a6 6 0 100-12 6 6 0 000 12zM12 14a2 2 0 100-4 2 2 0 000 4z' },
  whatsapp:     { n: '07', to: '/whatsapp',     label: 'WhatsApp',      hint: 'CANAL',    icon: 'M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z' },
  reports:      { n: '03', to: '/reports',      label: 'Relatórios',    hint: 'EXPORT',   icon: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
  instagram:    { n: '04', to: '/instagram',    label: 'Instagram',     hint: 'REDE',     icon: 'M7 2h10a5 5 0 015 5v10a5 5 0 01-5 5H7a5 5 0 01-5-5V7a5 5 0 015-5zm5 5a5 5 0 100 10 5 5 0 000-10zm5.5-.5a1 1 0 100 2 1 1 0 000-2z' },
  tiktok:       { n: '05', to: '/tiktok',       label: 'TikTok',        hint: 'REDE',     icon: 'M16 8.5a5 5 0 005 5v-3a2 2 0 01-2-2h-3zM9 12a4 4 0 104 4V8h3V5h-6v11a1 1 0 11-1-1v-3z' },
  youtube:      { n: '06', to: '/youtube',      label: 'YouTube',       hint: 'REDE',     icon: 'M22 12s0-3.5-.5-5a3 3 0 00-2-2C17.5 4.5 12 4.5 12 4.5s-5.5 0-7.5.5a3 3 0 00-2 2C2 8.5 2 12 2 12s0 3.5.5 5a3 3 0 002 2c2 .5 7.5.5 7.5.5s5.5 0 7.5-.5a3 3 0 002-2c.5-1.5.5-5 .5-5zM10 15.5v-7l6 3.5-6 3.5z' },
  competitors:  { n: '08', to: '/competitors',  label: 'Concorrentes',  hint: 'INTEL',    icon: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2 M9 11a4 4 0 100-8 4 4 0 000 8 M23 21v-2a4 4 0 00-3-3.87 M16 3.13a4 4 0 010 7.75' },
  ambassadors:  { n: '09', to: '/ambassadors',  label: 'Embaixadores',  hint: 'MARCA',    icon: 'M12 15a7 7 0 100-14 7 7 0 000 14z M8.21 13.89L7 23l5-3 5 3-1.21-9.12' },
  seo:          { n: '10', to: '/seo',          label: 'SEO',           hint: 'ORGÂNICO', icon: 'M3 3v18h18 M7 14l4-4 3 3 6-7' },
  ia:           { n: '11', to: '/ia',           label: 'Central de IA', hint: 'IA',       icon: 'M9 3h6 M9 21h6 M3 9v6 M21 9v6 M7 7h10v10H7z M10 10h4v4h-4z M9 3v4 M15 3v4 M9 17v4 M15 17v4 M3 9h4 M3 15h4 M17 9h4 M17 15h4' },
  bible:        { n: '14', to: '/bible',        label: 'Bíblia do Mkt', hint: 'MARCA',    icon: 'M4 19.5A2.5 2.5 0 016.5 17H20 M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z' },
  integrations: { n: '02', to: '/integrations', label: 'Integrações',   hint: 'DADOS',    icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
  alerts:       { n: '12', to: '/alerts',       label: 'Metas e alertas', hint: 'MONITOR', icon: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9' },
  settings:     { n: '13', to: '/settings',     label: 'Configurações', hint: 'SISTEMA',  icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
}

const GROUPS = [
  { key: 'performance',  label: 'PERFORMANCE',  keys: ['dashboard', 'metas', 'whatsapp', 'reports'] },
  { key: 'redes',        label: 'REDES',        keys: ['instagram', 'tiktok', 'youtube'] },
  { key: 'inteligencia', label: 'INTELIGÊNCIA', keys: ['competitors', 'ambassadors', 'seo', 'ia', 'bible'] },
  { key: 'sistema',      label: 'SISTEMA',      keys: ['integrations', 'alerts', 'settings'] },
]

// lista plana — usada pelo CommandPalette
export const NAV = Object.values(ITEMS)

export default function Layout() {
  const { user, profile, signOut } = useAuth()
  const { data: ig } = useInstagramMetrics()
  const { topHype } = detectHype(ig?.posts, ig?.account)
  const hypeColor = topHype ? HYPE_LEVELS[topHype.level].color : null
  const navigate = useNavigate()
  const location = useLocation()
  const toast = useToast()

  const ACTIONS = [
    { kind: 'action', label: 'Atualizar tela',         hint: 'RELOAD',  icon: 'M21 12a9 9 0 11-9-9 M21 4v6h-6',
      action: () => window.location.assign(location.pathname) },
    { kind: 'action', label: 'Imprimir página atual',  hint: 'PRINT',   icon: 'M6 9V2h12v7 M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2 M6 14h12v8H6z',
      action: () => window.print() },
    { kind: 'action', label: 'Copiar link da tela',    hint: 'CLIPBOARD', icon: 'M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71 M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71',
      action: async () => {
        await navigator.clipboard?.writeText(window.location.href)
        toast.success('Link copiado.')
      } },
    { kind: 'action', label: 'Abrir Meta Ad Library',   hint: 'EXTERNAL', icon: 'M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6 M15 3h6v6 M10 14L21 3',
      action: () => window.open('https://www.facebook.com/ads/library/', '_blank', 'noopener') },
    { kind: 'action', label: 'Abrir Google Trends',     hint: 'EXTERNAL', icon: 'M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6 M15 3h6v6 M10 14L21 3',
      action: () => window.open('https://trends.google.com/trends/explore?geo=BR', '_blank', 'noopener') },
    { kind: 'action', label: 'Encerrar sessão',         hint: 'LOGOUT',   icon: 'M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1',
      action: async () => { await signOut(); navigate('/login') } },
  ]

  const COMMANDS = [...NAV, ...ACTIONS]

  const [collapsed, setCollapsed] = useState({})
  const [mobileOpen, setMobileOpen] = useState(false)

  // fecha o drawer mobile ao navegar
  useEffect(() => { setMobileOpen(false) }, [location.pathname])

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  const initials = (profile?.full_name || user?.email || 'U')
    .split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div className={styles.shell}>
      <button
        type="button"
        className={styles.hamburger}
        onClick={() => setMobileOpen(true)}
        aria-label="Abrir menu"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M3 6h18 M3 12h18 M3 18h18" />
        </svg>
      </button>

      {mobileOpen && (
        <div className={styles.scrim} onClick={() => setMobileOpen(false)} />
      )}

      <aside className={`${styles.sidebar} ${mobileOpen ? styles.sidebarOpen : ''}`}>
        <div className={styles.brand}>
          <div className={styles.brandMark} />
          <div className={styles.brandText}>
            <span className={styles.brandName}>The Blonde Concept</span>
            <span className={styles.brandTag}>COMMAND CENTER</span>
          </div>
        </div>

        <button
          type="button"
          className={styles.cmdHint}
          onClick={() => {
            const ev = new KeyboardEvent('keydown', { key: 'k', ctrlKey: true })
            window.dispatchEvent(ev)
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" />
          </svg>
          <span>Buscar ou executar</span>
          <kbd className={styles.kbd}>⌘K</kbd>
        </button>

        <nav className={styles.nav}>
          {GROUPS.map(g => {
            const isCollapsed = collapsed[g.key]
            return (
              <div key={g.key} className={styles.group}>
                <button
                  className={styles.groupLabel}
                  onClick={() => setCollapsed(c => ({ ...c, [g.key]: !c[g.key] }))}
                >
                  <span className={`${styles.chev} ${isCollapsed ? styles.chevCollapsed : ''}`}>▾</span>
                  {g.label}
                </button>
                {!isCollapsed && (
                  <div className={styles.groupItems}>
                    {g.keys.map(k => {
                      const it = ITEMS[k]
                      const showHype = it.to === '/instagram' && topHype
                      return (
                        <NavLink
                          key={it.to}
                          to={it.to}
                          end={it.to === '/'}
                          className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navActive : ''}`}
                        >
                          <span className={styles.navNum}>{it.n}</span>
                          <svg className={styles.navIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                            <path d={it.icon} />
                          </svg>
                          <span className={styles.navText}>{it.label}</span>
                          {showHype ? (
                            <span
                              className={styles.hypeDot}
                              style={{ '--hype-color': hypeColor } as React.CSSProperties}
                              title={`${HYPE_LEVELS[topHype.level].icon} ${HYPE_LEVELS[topHype.level].label}`}
                            />
                          ) : (
                            <span className={styles.navHint}>{it.hint}</span>
                          )}
                        </NavLink>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </nav>

        <div className={styles.footer}>
          <div className={styles.sysRow}>
            <span className={styles.sysDot} />
            <span>SISTEMA OPERANTE</span>
            <span className={styles.sysVer}>v1.0</span>
          </div>
          <div className={styles.userRow}>
            <div className={styles.avatar}>{initials}</div>
            <div className={styles.userInfo}>
              <span className={styles.userName}>{profile?.full_name || user?.email?.split('@')[0]}</span>
              <span className={styles.userRole}>{profile?.role || 'operador'}</span>
            </div>
            <button className={styles.logoutBtn} onClick={handleSignOut} title="Encerrar sessão">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
        </div>
      </aside>

      <main className={styles.main}>
        <div className={styles.content}>
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </div>
      </main>

      <CommandPalette commands={COMMANDS} />

      <ErrorBoundary>
        <AiAssistant />
      </ErrorBoundary>
    </div>
  )
}
