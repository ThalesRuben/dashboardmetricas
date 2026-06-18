import { useState } from 'react'
import { useTikTokMetrics } from '@/features/organic/tiktok'
import { generateTikTokInsights } from '@/lib/aiInsights'
import KpiCard from '@/shared/ui/KpiCard'
import SocialLineChart from '@/components/social/SocialLineChart'
import SocialVideoList from '@/components/social/SocialVideoList'
import OrganicAccountBar from '@/components/social/OrganicAccountBar'
import OrganicAiInsights from '@/components/social/OrganicAiInsights'
import PageHeader from '@/components/ui/PageHeader'
import EmptyState from '@/components/ui/EmptyState'
import Tabs from '@/components/ui/Tabs'
import { fmtNumber, fmtCompact, fmtPct } from '@/shared/lib/format'
import styles from './SocialPage.module.css'

const TIKTOK_COLOR = '#000000'
const TIKTOK_ACCENT = '#FE2C55'

const TABS = [
  { id: 'visao', label: 'Visão geral' },
  { id: 'ia',    label: 'IA Insights' },
]

const VIDEO_METRICS = [
  { key: 'visualizacoes',     label: 'views',   icon: '▶', fmt: fmtCompact },
  { key: 'curtidas',          label: 'curtidas',icon: '♥', fmt: fmtCompact },
  { key: 'comentarios',       label: 'coment.', icon: '💬', fmt: fmtNumber },
  { key: 'compartilhamentos', label: 'compart.',icon: '↗', fmt: fmtNumber },
  { key: 'engajamento_taxa',  label: 'engaj.',  icon: '⚡', fmt: v => fmtPct(v, 1) },
]

export default function TikTokPage() {
  const { data, loading, usingMock } = useTikTokMetrics()
  const [tab, setTab] = useState('visao')

  if (loading || !data) {
    return <div className={styles.page}><div className={styles.loading}>Carregando métricas do TikTok...</div></div>
  }

  const a = data.account
  const deltaUp = a.seguidores_delta_30d > 0

  // threshold — abaixo desses números, a UI fica vazia e dá sensação de quebrado
  const tooEarly = (a.seguidores || 0) < 500 || (a.total_videos || 0) < 10
  if (tooEarly) {
    return (
      <div className={styles.page}>
        <PageHeader section="tiktok" title={`TikTok · ${a.username}`} subtitle="Ainda construindo histórico" />
        <EmptyState
          icon="♪"
          title="Ainda coletando dados do TikTok"
          description="A análise precisa de pelo menos 10 vídeos publicados e 500 seguidores pra gerar insight útil."
          progress={[
            { label: 'Vídeos publicados', current: a.total_videos || 0, target: 10 },
            { label: 'Seguidores',         current: a.seguidores || 0,  target: 500 },
          ]}
          partialData={[
            { label: 'visualizações/dia', value: fmtNumber(a.visualizacoes_dia || 0) },
            { label: 'engajamento',       value: fmtPct(a.engajamento_taxa || 0, 1) },
          ]}
        />
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <PageHeader
        section="tiktok"
        title="TikTok orgânico"
        subtitle="Últimos 30 dias"
      />

      <OrganicAccountBar
        connectorKey="tiktok"
        platformLabel="TikTok"
        sectionColor={TIKTOK_ACCENT}
        knownAccounts={[a.username, '@theblondeconcept']}
        usingMock={usingMock}
        metaOverride={usingMock ? 'TikTok orgânico não tem API pública — inserção manual ou TikTok Business API (requer aprovação)' : undefined}
        icon={
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5.8 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1.84-.1z" />
          </svg>
        }
      />

      <Tabs items={TABS} activeId={tab} onChange={setTab} accentColor={TIKTOK_ACCENT} />

      {tab === 'visao' && (
        <>
          <section className={styles.kpiGrid}>
            <KpiCard label="Seguidores"        value={fmtNumber(a.seguidores)}      delta={`${deltaUp?'+':''}${fmtNumber(a.seguidores_delta_30d)} em 30d`} up={deltaUp} />
            <KpiCard label="Curtidas totais"   value={fmtCompact(a.curtidas_total)} delta="+8.4k em 30d" up />
            <KpiCard label="Visualizações/dia" value={fmtNumber(a.visualizacoes_dia)} delta="+14% vs ontem" up />
            <KpiCard label="Engajamento"       value={fmtPct(a.engajamento_taxa, 1)} delta="+0.6pp" up />
            <KpiCard label="Vídeos publicados" value={fmtNumber(a.total_videos)}    neutral />
          </section>

          <section className={styles.chartsGrid}>
            <div className={styles.chartCard}>
              <h3 className={styles.chartTitle}>Crescimento de seguidores</h3>
              <SocialLineChart serie={a.serie_seguidores} color="#25F4EE" />
            </div>
            <div className={styles.chartCard}>
              <h3 className={styles.chartTitle}>Visualizações por dia</h3>
              <SocialLineChart serie={a.serie_views} color="#FE2C55" type="bar" />
            </div>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Top vídeos dos últimos 30 dias</h2>
            <SocialVideoList
              videos={data.videos}
              titleField="caption"
              metrics={VIDEO_METRICS}
              accent={TIKTOK_COLOR}
            />
          </section>
        </>
      )}

      {tab === 'ia' && (
        <section className={styles.section}>
          <OrganicAiInsights
            data={data}
            payloadKey="tt"
            functionName="gemini-tiktok-insights"
            localFallback={() => generateTikTokInsights(data)}
            sectionColor={TIKTOK_ACCENT}
            emptyHint="Clique em Gerar insights pra a IA analisar a conta de TikTok inteira."
          />
        </section>
      )}
    </div>
  )
}
