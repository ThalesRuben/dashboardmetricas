import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from '@/app/providers/AuthContext'
import { ThemeProvider } from '@/app/providers/ThemeContext'
import { MetricsProvider } from '@/app/providers/MetricsContext'
import { ToastProvider } from '@/app/providers/ToastContext'
import App from './App'
import '@/styles/global.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <MetricsProvider>
            <ToastProvider>
              <App />
            </ToastProvider>
          </MetricsProvider>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  </React.StrictMode>
)

// PWA — só registra em produção pra não conflitar com o HMR do Vite
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => { /* offline ou bloqueado */ })
  })
}
