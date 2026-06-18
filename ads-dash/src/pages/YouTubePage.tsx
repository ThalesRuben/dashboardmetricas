import { useYouTubeMetrics } from '@/features/organic/youtube'
import KpiCard from '@/shared/ui/KpiCard'
import SocialLineChart from '@/components/social/SocialLineChart'
import SocialVideoList from '@/components/social/SocialVideoList'
import OrganicAccountBar from '@/components/social/OrganicAccountBar'
import PageHeader from '@/components/ui/PageHeader'
import EmptyState from '@/components/ui/EmptyState'
import { fmtNumber, fmtCompact, fmtPct } from '@/shared/lib/format'
import styles from './SocialPage.module.css'

const YT_COLOR = '#FF0000'

function fmtDuration(seg) {
  const s = Number(seg) || 0
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${String(r).padStart(2, '0')}`
}

const VIDEO_METRICS = [
  { key: 'visualizacoes',  label: 'views',     icon: '▶',  fmt: fmtCompact },
  { key: 'curtidas',       label: 'curtidas',  icon: '👍', fmt: fmtCompact },
  { key: 'comentarios',    label: 'coment.',   icon: '💬', fmt: fmtNumber },
  { key: 'retencao_media', label: 'retenção',  icon: '⏱', fmt: v => fmtPct(v, 0) },
  { key: 'duracao_seg',    label: 'duração',   icon: '🎬', fmt: fmtDuration, sortable: false },
]

export default function YouTubePage() {
  const { data, loading, usingMock } = useYouTubeMetrics()

  if (loading || !data) {
    return <div className={styles.page}><div className={styles.loading}>Carregando métricas do YouTube...</div></div>
  }

  const c = data.channel
  const deltaUp = c.inscritos_delta_30d > 0

  const tooEarly = (c.inscritos || 0) < 500 || (c.total_videos || 0) < 10
  if (tooEarly) {
    return (
      <div className={styles.page}>
        <PageHeader section="youtube" title={`YouTube · ${c.channel_name}`} subtitle="Ainda construindo histórico" />
        <EmptyState
          icon="▷"
          title="Ainda coletando dados do YouTube"
          description="A análise precisa de pelo menos 10 vídeos publicados e 500 inscritos pra ser útil."
          progress={[
            { label: 'Vídeos publicados', current: c.total_videos || 0, target: 10 },
            { label: 'Inscritos',          current: c.inscritos || 0,   target: 500 },
          ]}
          partialData={[
            { label: 'visualizações/dia', value: fmtNumber(c.visualizacoes_dia || 0) },
            { label: 'engajamento',       value: fmtPct(c.engajamento_taxa || 0, 1) },
          ]}
        />
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <PageHeader
        section="youtube"
        title="YouTube orgânico"
        subtitle="Últimos 30 dias"
      />

      <OrganicAccountBar
        connectorKey="youtube"
        platformLabel="YouTube"
        sectionColor={YT_COLOR}
        knownAccounts={[c.channel_name, 'The Blonde Concept']}
        usingMock={usingMock}
        metaOverride={usingMock ? 'YouTube Data API v3 (OAuth) — puxa inscritos, visualizações e retenção automaticamente' : undefined}
        icon={
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
          </svg>
        }
      />

      <section className={styles.kpiGrid}>
        <KpiCard label="Inscritos"          value={fmtNumber(c.inscritos)}          delta={`${deltaUp?'+':''}${fmtNumber(c.inscritos_delta_30d)} em 30d`} up={deltaUp} />
        <KpiCard label="Visualizações/dia"  value={fmtNumber(c.visualizacoes_dia)}  delta="+9% vs ontem" up />
        <KpiCard label="Horas assistidas"   value={fmtCompact(c.horas_assistidas)}  delta="+18% em 30d" up />
        <KpiCard label="Engajamento"        value={fmtPct(c.engajamento_taxa, 1)}   delta="+0.3pp" up />
        <KpiCard label="Vídeos publicados"  value={fmtNumber(c.total_videos)}       neutral />
      </section>

      <section className={styles.chartsGrid}>
        <div className={styles.chartCard}>
          <h3 className={styles.chartTitle}>Crescimento de inscritos</h3>
          <SocialLineChart serie={c.serie_inscritos} color="#FF0000" />
        </div>
        <div className={styles.chartCard}>
          <h3 className={styles.chartTitle}>Visualizações por semana</h3>
          <SocialLineChart serie={c.serie_views} color="#CC0000" type="bar" />
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Top vídeos dos últimos 30 dias</h2>
        <SocialVideoList
          videos={data.videos}
          titleField="titulo"
          metrics={VIDEO_METRICS}
          accent={YT_COLOR}
        />
      </section>
    </div>
  )
}
