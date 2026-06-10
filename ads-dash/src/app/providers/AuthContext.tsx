import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '@/shared/lib/supabase'

const AuthContext = createContext(null)

// Login estático (sem Supabase). Funciona SEMPRE em desenvolvimento, e em
// produção SOMENTE quando VITE_ALLOW_STATIC_LOGIN === 'true'. Bom pra MVP
// privado publicado na Vercel sem configurar Supabase.
// ATENÇÃO: e-mail e senha vão no bundle do front (qualquer um pode ler no JS).
// Use uma senha dedicada — não reaproveite senha importante.
const STATIC_LOGIN_ENABLED =
  import.meta.env.DEV || import.meta.env.VITE_ALLOW_STATIC_LOGIN === 'true'

const DEV_LOGIN = (STATIC_LOGIN_ENABLED && import.meta.env.VITE_DEV_LOGIN_EMAIL)
  ? {
      email: import.meta.env.VITE_DEV_LOGIN_EMAIL,
      password: import.meta.env.VITE_DEV_LOGIN_PASSWORD || '',
      user: {
        id: 'static-user',
        email: import.meta.env.VITE_DEV_LOGIN_EMAIL,
      },
      profile: {
        id: 'static-user',
        full_name: import.meta.env.VITE_DEV_LOGIN_NAME || 'Equipe',
        role: 'admin',
      },
    }
  : null

const DEV_STORAGE_KEY = 'ads-dash:dev-session'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const devSession = localStorage.getItem(DEV_STORAGE_KEY)
    if (devSession === '1' && DEV_LOGIN) {
      setUser(DEV_LOGIN.user)
      setProfile(DEV_LOGIN.profile)
      setLoading(false)
      return
    }
    if (devSession === '1' && !DEV_LOGIN) {
      // sessão dev ficou no storage mas o build é prod — limpa
      localStorage.removeItem(DEV_STORAGE_KEY)
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else { setProfile(null); setLoading(false) }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function fetchProfile(userId) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    setProfile(data)
    setLoading(false)
  }

  async function signIn(email, password) {
    if (DEV_LOGIN && email === DEV_LOGIN.email && password === DEV_LOGIN.password) {
      localStorage.setItem(DEV_STORAGE_KEY, '1')
      setUser(DEV_LOGIN.user)
      setProfile(DEV_LOGIN.profile)
      return { data: { user: DEV_LOGIN.user }, error: null }
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    return { data, error }
  }

  async function signOut() {
    if (localStorage.getItem(DEV_STORAGE_KEY) === '1') {
      localStorage.removeItem(DEV_STORAGE_KEY)
      setUser(null)
      setProfile(null)
      return
    }
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
