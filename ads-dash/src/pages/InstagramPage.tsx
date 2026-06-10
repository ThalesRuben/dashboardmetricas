import { useMemo, useState } from 'react'
import { useInstagramMetrics } from '@/features/organic/instagram/hooks/useInstagramMetrics'
import { useToast } from '@/app/providers/ToastContext'
import { detectHype, HYPE_LEVELS } from '@/features/organic/instagram/lib/hypeDetector'
import { fmtNumber, fmtPct } from '@/shared/lib/format'
import PageHeader from '@/components/ui/PageHeader'
import Tabs from '@/components/ui/Tabs'
import KpiCard from '@/shared/ui/KpiCard'
import ContentCard from '@/components/ui/ContentCard'
import IgGrowthChart from '@/features/organic/instagram/components/IgGrowthChart'
import IgEngagementChart from '@/features/organic/instagram/components/IgEngagementChart'
import IgReachChart from '@/features/organic/instagram/components/IgReachChart'
import IgTimeline from '@/features/organic/instagram/components/IgTimeline'
import ChannelEngines from '@/features/organic/instagram/components/ChannelEngines'
import ContentCalendar from '@/features/organic/instagram/components/ContentCalendar'
import InsightsPanel from '@/components/ui/InsightsPanel'
import styles from './InstagramPage.module.css'

const TABS = [
  { id: 'visao',      label: 'Visão geral'         },
  { id: 'conteudo',   label: 'Conteúdo'            },
  { id: 'calendario', label: 'Calendário'          },
  { id: 'timeline',   label: 'Timeline'            },
]

const TIPO_MAP = { REEL: 'reel', VIDEO: 'reel', IMAGE: 'image', CAROUSEL: 'carousel', STORY: 'story' }
const HYPE_MAP = {
  blazing: { level: 'viral',  multiplier: '🚀 Viralizando' },
  hot:     { level: 'hot',    multiplier: '🔥 No hype' },
  warm:    { level: 'rising', multiplier: '📈 Subindo' },
}

const SORTS = [
  { id: 'recent',   label: 'Mais recentes' },
  { id: 'engaj',    label: 'Maior engajamento' },
  { id: 'reach',    label: 'Maior alcance' },
  { id: 'plays',    label: 'Mais visualizações' },
]

export default function InstagramPage() {
  const { data, loading, usingMock, triggerSync } = useInstagramMetrics()
  const [syncing, setSyncing] = useState(false)
  const [tab, setTab] = useState('visao')
  const [filter, setFilter] = useState('all')
  const [sort, setSort] = useState('recent')
  const toast = useToast()

  // hooks/cálculos sempre rodam — tratam undefined com fallback
  const { topHype, hypePosts } = detectHype(data?.posts, data?.account) as { topHype: { level: string; multiplier?: string } | null; hypePosts: Array<{ post: { id?: string; ig_post_id?: string }; level: string }> }
  const hypeByPostId = useMemo(
    () => new Map<string, { level: string; multiplier?: string }>(hypePosts.map(h => [h.post.id || h.post.ig_post_id || '', h as unknown as { level: string; multiplier?: string }])),
    [hypePosts]
  )
  const filteredPosts = useMemo(() => {
    let list = [...(data?.posts || [])]
    if (filter === 'reels') list = list.filter(p => p.tipo === 'REEL')
    if (filter === 'image') list = list.filter(p => p.tipo === 'IMAGE' || p.tipo === 'CAROUSEL')
    if (filter === 'viral') list = list.filter(p => hypeByPostId.has(p.id || p.ig_post_id))
    if (sort === 'recent') list.sort((x, y) => new Date(y.publicado_em).getTime() - new Date(x.publicado_em).getTime())
    if (sort === 'engaj')  list.sort((x, y) => (y.engajamento_taxa || 0) - (x.engajamento_taxa || 0))
    if (sort === 'reach')  list.sort((x, y) => (y.alcance || 0) - (x.alcance || 0))
    if (sort === 'plays')  list.sort((x, y) => (y.plays || 0) - (x.plays || 0))
    return list
  }, [data?.posts, filter, sort, hypeByPostId])

  if (loading || !data) {
    return <div className={styles.page}><div className={styles.loading}>Carregando métricas do Instagram...</div></div>
  }

  const a = data.account

  async function handleSync() {
    setSyncing(true)
    const res = await triggerSync()
    setSyncing(false)
    if (res.ok) toast.success(res.msg, { title: 'Sincronizado' })
    else        toast.error(res.msg, { title: 'Falha na sincronização' })
  }

  return (
    <div className={styles.page}>
      <PageHeader
        section="instagram"
        title={`Instagram orgânico · ${a.username}`}
        subtitle={topHype ? `${HYPE_LEVELS[topHype.level].label} agora — ${hypePosts.length} post${hypePosts.length>1?'s':''} acima da média` : null}
        actions={
          <button className="btn" onClick={handleSync} disabled={syncing}>
            {syncing ? 'Sincronizando...' : '↻ Sincronizar'}
          </button>
        }
      />

      <Tabs items={TABS} activeId={tab} onChange={setTab} accentColor="var(--section-instagram)" />

      {tab === 'visao' && (
        <>
          {usingMock && <Banner>Dados de demonstração. Conecte a conta em <strong>Integrações → Instagram</strong>.</Banner>}

          <section className={styles.kpis}>
            <KpiCard
              label="Seguidores"
              value={fmtNumber(a.seguidores)}
              delta={a.seguidores_delta_30d ? `+${fmtNumber(a.seguidores_delta_30d)} em 30d` : null}
              up={a.seguidores_delta_30d > 0}
              accentColor="var(--section-instagram)"
              serie={(a.serie_seguidores || []).map(s => s.value)}
            />
            <KpiCard
              label="Alcance (dia)"
              value={fmtNumber(a.alcance_dia)}
              delta="+12% vs ontem"
              up
              serie={(a.serie_alcance || []).map(s => s.value)}
            />
            <KpiCard
              label="Engajamento"
              value={`${a.engajamento_taxa}%`}
              delta="+0.4pp"
              up
              serie={(a.serie_engajamento || []).map(s => s.value)}
            />
            <KpiCard
              label="Visitas ao perfil"
              value={fmtNumber(a.visitas_perfil)}
              delta="+22 vs ontem"
              up
            />
          </section>

          <section className={styles.section}>
            <ChannelEngines />
          </section>

          <section className={styles.section}>
            <InsightsPanel ig={data} source="instagram" />
          </section>

          <section className={styles.chartsGrid}>
            <ChartTile title="Crescimento de seguidores"><IgGrowthChart serie={a.serie_seguidores} /></ChartTile>
            <ChartTile title="Engajamento semanal"><IgEngagementChart serie={a.serie_engajamento} /></ChartTile>
            <ChartTile title="Alcance por dia da semana" full><IgReachChart serie={a.serie_alcance} /></ChartTile>
          </section>
        </>
      )}

      {tab === 'conteudo' && (
        <>
          <div className={styles.libraryBar}>
            <FilterChips
              items={[
                { id: 'all',   label: 'Todos' },
                { id: 'reels', label: 'Reels' },
                { id: 'image', label: 'Foto/Carrossel' },
                { id: 'viral', label: '🚀 Em alta',  highlight: true },
              ]}
              active={filter}
              onChange={setFilter}
            />
            <select className={styles.sort} value={sort} onChange={e => setSort(e.target.value)}>
              {SORTS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>

          {filteredPosts.length === 0 ? (
            <p className={styles.emptyMsg}>Nenhum post com esse filtro.</p>
          ) : (
            <div className={styles.grid}>
              {filteredPosts.map(p => {
                const id = p.id || p.ig_post_id
                const hyped = hypeByPostId.get(id)
                const mediaType = TIPO_MAP[p.tipo] || 'reel'
                return (
                  <ContentCard
                    key={id}
                    mediaType={mediaType}
                    thumbnailUrl={p.thumbnail_url || undefined}
                    caption={p.caption}
                    hypeBadge={hyped ? HYPE_MAP[hyped.level] : undefined}
                    viralBorder={hyped?.level === 'blazing'}
                    publishedAt={p.publicado_em ? new Date(p.publicado_em).toLocaleDateString('pt-BR') : undefined}
                    metrics={[
                      { label: 'engajamento', value: fmtPct(p.engajamento_taxa || 0, 1), highlight: hyped?.level === 'blazing' },
                      { label: p.tipo === 'REEL' ? 'plays' : 'alcance', value: fmtNumber(p.plays || p.alcance || 0) },
                    ]}
                    action={hyped?.level === 'blazing' ? { label: '▸ Amplificar esse post', onClick: () => toast.info('Em breve: criar campanha a partir do post.') } : undefined}
                  />
                )
              })}
            </div>
          )}
        </>
      )}

      {tab === 'calendario' && <ContentCalendar />}

      {tab === 'timeline' && (
        <section className={styles.section}>
          <IgTimeline posts={data.posts} account={data.account} />
        </section>
      )}
    </div>
  )
}

function Banner({ children }) {
  return <div className={styles.banner}>ⓘ {children}</div>
}

function ChartTile({ title, children, full = false }) {
  return (
    <div className={`${styles.chartTile} ${full ? styles.chartFull : ''}`}>
      <h3 className={styles.chartTitle}>{title}</h3>
      {children}
    </div>
  )
}

function FilterChips({ items, active, onChange }) {
  return (
    <div className={styles.chips}>
      {items.map(it => (
        <button
          key={it.id}
          className={`${styles.chip} ${active === it.id ? styles.chipActive : ''} ${it.highlight ? styles.chipHighlight : ''}`}
          onClick={() => onChange(it.id)}
        >
          {it.label}
        </button>
      ))}
    </div>
  )
}
