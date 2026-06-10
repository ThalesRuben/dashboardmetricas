import { createContext, useContext, useEffect } from 'react'

// Command Center é um tema único, escuro. O contexto continua existindo
// para manter compatibilidade com componentes que leem `theme`.
const ThemeContext = createContext(null)

export function ThemeProvider({ children }) {
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'dark')
  }, [])

  const value = { theme: 'dark', toggleTheme: () => {}, setTheme: () => {} }
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export const useTheme = () => useContext(ThemeContext)
