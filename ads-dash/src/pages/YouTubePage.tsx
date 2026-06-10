import { useYouTubeMetrics } from '@/features/organic/youtube'
import KpiCard from '@/shared/ui/KpiCard'
import SocialLineChart from '@/components/social/SocialLineChart'
import SocialVideoList from '@/components/social/SocialVideoList'
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
        title={`YouTube · ${c.channel_name}`}
        subtitle="Últimos 30 dias"
      />

      {usingMock && (
        <div className={styles.mockBanner}>
          ⓘ Dados de demonstração. Conecte o canal via <strong>YouTube Data API v3</strong> (OAuth) para
          puxar inscritos, visualizações e retenção automaticamente.
        </div>
      )}

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
