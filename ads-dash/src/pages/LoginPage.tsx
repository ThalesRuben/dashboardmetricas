import { useState } from 'react'
import { useAuth } from '@/app/providers/AuthContext'
import styles from './LoginPage.module.css'

const MAX_ATTEMPTS = 3
const LOCK_SECONDS = 30

export default function LoginPage() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [attempts, setAttempts] = useState(0)
  const [lockedUntil, setLockedUntil] = useState(null)
  const [countdown, setCountdown] = useState(0)

  const isLocked = lockedUntil && Date.now() < lockedUntil

  async function handleLogin(e) {
    e.preventDefault()
    if (isLocked) return
    setError('')
    setLoading(true)

    const { error } = await signIn(email, password)
    setLoading(false)

    if (error) {
      const newAttempts = attempts + 1
      setAttempts(newAttempts)

      if (newAttempts >= MAX_ATTEMPTS) {
        const until = Date.now() + LOCK_SECONDS * 1000
        setLockedUntil(until)
        setCountdown(LOCK_SECONDS)
        const timer = setInterval(() => {
          setCountdown(prev => {
            if (prev <= 1) { clearInterval(timer); setLockedUntil(null); setAttempts(0); return 0 }
            return prev - 1
          })
        }, 1000)
      } else {
        setError(`E-mail ou senha incorretos. ${MAX_ATTEMPTS - newAttempts} tentativa(s) restante(s).`)
      }
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.brand}>
          <div className={styles.brandIcon}>
            <svg width="18" height="18" viewBox="0 0 20 20" fill="#E6F1FB">
              <path d="M10 2a8 8 0 100 16A8 8 0 0010 2zm0 3a2 2 0 110 4 2 2 0 010-4zm0 9c-2.2 0-4.1-1.1-5.3-2.8.7-1.4 2.1-2.2 5.3-2.2s4.6.8 5.3 2.2C14.1 12.9 12.2 14 10 14z"/>
            </svg>
          </div>
          <div>
            <div className={styles.brandName}>The Blonde Concept</div>
            <div className={styles.brandSub}>Backoffice de marketing</div>
          </div>
        </div>

        <h1 className={styles.title}>Entrar</h1>
        <p className={styles.desc}>Acesso restrito à equipe autorizada</p>

        {isLocked ? (
          <div className={styles.lockBox}>
            <div className={styles.lockIcon}>
              <svg width="22" height="22" viewBox="0 0 20 20" fill="#A32D2D">
                <path d="M14 8V6A4 4 0 006 6v2H5a1 1 0 00-1 1v8a1 1 0 001 1h10a1 1 0 001-1V9a1 1 0 00-1-1h-1zm-4 6a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm2-6H8V6a2 2 0 114 0v2z"/>
              </svg>
            </div>
            <p className={styles.lockTitle}>Acesso bloqueado</p>
            <p className={styles.lockDesc}>Muitas tentativas. Aguarde para continuar.</p>
            <div className={styles.countdown}>00:{String(countdown).padStart(2, '0')}</div>
          </div>
        ) : (
          <form onSubmit={handleLogin} className={styles.form}>
            {attempts > 0 && attempts < MAX_ATTEMPTS && (
              <div className={styles.warnBox}>
                {MAX_ATTEMPTS - attempts} tentativa(s) restante(s) antes do bloqueio.
              </div>
            )}

            <div className={styles.field}>
              <label>E-mail</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
                autoComplete="email"
              />
            </div>

            <div className={styles.field}>
              <label>Senha</label>
              <div className={styles.pwWrap}>
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                />
                <button type="button" className={styles.pwToggle} onClick={() => setShowPw(s => !s)}>
                  {showPw ? 'ocultar' : 'mostrar'}
                </button>
              </div>
              {error && <p className={styles.errMsg}>{error}</p>}
            </div>

            <button type="submit" className={styles.btnLogin} disabled={loading}>
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
