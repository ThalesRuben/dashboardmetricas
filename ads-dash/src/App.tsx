import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '@/app/providers/AuthContext'
import Layout from '@/components/layout/Layout'
import LoadingScreen from '@/app/LoadingScreen'
import LoginPage from '@/pages/LoginPage'

const DashboardPage      = lazy(() => import('@/pages/DashboardPage'))
const WhatsAppPage       = lazy(() => import('@/pages/WhatsAppPage'))
const InstagramPage      = lazy(() => import('@/pages/InstagramPage'))
const TikTokPage         = lazy(() => import('@/pages/TikTokPage'))
const YouTubePage        = lazy(() => import('@/pages/YouTubePage'))
const CompetitorsPage    = lazy(() => import('@/pages/CompetitorsPage'))
const AmbassadorsPage    = lazy(() => import('@/pages/AmbassadorsPage'))
const AiHubPage          = lazy(() => import('@/pages/AiHubPage'))
const SeoPage            = lazy(() => import('@/pages/SeoPage'))
const MarketingBiblePage = lazy(() => import('@/pages/MarketingBiblePage'))
const IntegrationPage    = lazy(() => import('@/pages/IntegrationPage'))
const ReportsPage        = lazy(() => import('@/pages/ReportsPage'))
const AlertsPage         = lazy(() => import('@/pages/AlertsPage'))
const SettingsPage       = lazy(() => import('@/pages/SettingsPage'))

function PrivateRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <LoadingScreen />
  if (!user) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  const { user, loading } = useAuth()

  if (loading) return <LoadingScreen />

  return (
    <Suspense fallback={<LoadingScreen />}>
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />

        <Route path="/" element={
          <PrivateRoute><Layout /></PrivateRoute>
        }>
          <Route index element={<DashboardPage />} />
          <Route path="whatsapp" element={<WhatsAppPage />} />
          <Route path="instagram" element={<InstagramPage />} />
          <Route path="tiktok" element={<TikTokPage />} />
          <Route path="youtube" element={<YouTubePage />} />
          <Route path="competitors" element={<CompetitorsPage />} />
          <Route path="ambassadors" element={<AmbassadorsPage />} />
          <Route path="ia" element={<AiHubPage />} />
          <Route path="seo" element={<SeoPage />} />
          <Route path="bible" element={<MarketingBiblePage />} />
          <Route path="integrations" element={<IntegrationPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="alerts" element={<AlertsPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}
