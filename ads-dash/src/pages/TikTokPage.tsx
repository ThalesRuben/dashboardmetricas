import { useTikTokMetrics } from '@/features/organic/tiktok'
import KpiCard from '@/shared/ui/KpiCard'
import SocialLineChart from '@/components/social/SocialLineChart'
import SocialVideoList from '@/components/social/SocialVideoList'
import PageHeader from '@/components/ui/PageHeader'
import EmptyState from '@/components/ui/EmptyState'
import { fmtNumber, fmtCompact, fmtPct } from '@/shared/lib/format'
import styles from './SocialPage.module.css'

const TIKTOK_COLOR = '#000000'

const VIDEO_METRICS = [
  { key: 'visualizacoes',     label: 'views',   icon: '▶', fmt: fmtCompact },
  { key: 'curtidas',          label: 'curtidas',icon: '♥', fmt: fmtCompact },
  { key: 'comentarios',       label: 'coment.', icon: '💬', fmt: fmtNumber },
  { key: 'compartilhamentos', label: 'compart.',icon: '↗', fmt: fmtNumber },
  { key: 'engajamento_taxa',  label: 'engaj.',  icon: '⚡', fmt: v => fmtPct(v, 1) },
]

export default function TikTokPage() {
  const { data, loading, usingMock } = useTikTokMetrics()

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
        title={`TikTok · ${a.username}`}
        subtitle="Últimos 30 dias"
      />

      {usingMock && (
        <div className={styles.mockBanner}>
          ⓘ Dados de demonstração. O TikTok não tem API pública de insights orgânicos por padrão —
          os números podem ser inseridos manualmente ou via TikTok Business API (requer aprovação).
        </div>
      )}

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
    </div>
  )
}
