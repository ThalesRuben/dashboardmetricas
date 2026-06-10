import { useState, useMemo } from 'react'
import { detectHype, HYPE_LEVELS } from '@/features/organic/instagram/lib/hypeDetector'
import styles from './IgTopPosts.module.css'

const TYPE_LABEL = {
  IMAGE:           'Imagem',
  VIDEO:           'Vídeo',
  CAROUSEL_ALBUM:  'Carrossel',
  REEL:            'Reel',
  STORY:           'Story',
}
const TYPE_CLASS = {
  IMAGE: styles.tagImg,
  VIDEO: styles.tagVid,
  CAROUSEL_ALBUM: styles.tagCar,
  REEL: styles.tagReel,
  STORY: styles.tagStory,
}

const SORT_OPTIONS = [
  { key: 'engajamento_taxa', label: 'Engajamento' },
  { key: 'curtidas',         label: 'Curtidas' },
  { key: 'comentarios',      label: 'Comentários' },
  { key: 'salvamentos',      label: 'Salvamentos' },
  { key: 'alcance',          label: 'Alcance' },
]

const FILTER_OPTIONS = [
  { key: 'all',  label: 'Todos' },
  { key: 'REEL', label: 'Reels' },
  { key: 'IMAGE',label: 'Imagens' },
  { key: 'CAROUSEL_ALBUM', label: 'Carrosséis' },
  { key: 'STORY',label: 'Stories' },
]

const fmt = n => Number(n || 0).toLocaleString('pt-BR')

export default function IgTopPosts({ posts, account }) {
  const [sortKey, setSortKey] = useState('engajamento_taxa')
  const [filter, setFilter]   = useState('all')

  const hypeMap = useMemo(() => {
    const { hypePosts } = detectHype(posts, account)
    return new Map(hypePosts.map(h => [h.post.id, h]))
  }, [posts, account])

  const list = posts
    .filter(p => filter === 'all' ? true : p.tipo === filter)
    .sort((a, b) => (b[sortKey] || 0) - (a[sortKey] || 0))

  return (
    <div className={styles.wrap}>
      <div className={styles.toolbar}>
        <div className={styles.tabs}>
          {FILTER_OPTIONS.map(f => (
            <button
              key={f.key}
              className={`${styles.tab} ${filter === f.key ? styles.tabActive : ''}`}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className={styles.sortRow}>
          <span className={styles.sortLabel}>Ordenar por:</span>
          <select className={styles.sortSelect} value={sortKey} onChange={e => setSortKey(e.target.value)}>
            {SORT_OPTIONS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </div>
      </div>

      {list.length === 0 ? (
        <div className={styles.empty}>Nenhum post no filtro atual.</div>
      ) : (
        <div className={styles.grid}>
          {list.slice(0, 9).map(p => {
            const hype = hypeMap.get(p.id) as { level: string } | undefined
            const conf = hype ? HYPE_LEVELS[hype.level as keyof typeof HYPE_LEVELS] : null
            return (
            <div
              key={p.id}
              className={`${styles.card} ${hype ? styles.cardHype : ''}`}
              style={hype && conf ? ({ '--hype-color': conf.color } as React.CSSProperties) : undefined}
            >
              <div className={styles.thumb}>
                {p.thumbnail_url
                  ? <img src={p.thumbnail_url} alt="" />
                  : <PlaceholderThumb tipo={p.tipo} />}
                <span className={`${styles.tag} ${TYPE_CLASS[p.tipo]}`}>{TYPE_LABEL[p.tipo]}</span>
                {hype && (
                  <span className={styles.hypeBadge} title={conf.label}>
                    <span className={styles.hypePulse} style={{ background: conf.color }} />
                    {conf.icon} {conf.label}
                  </span>
                )}
              </div>
              <div className={styles.body}>
                <p className={styles.caption}>{p.caption || 'Sem legenda'}</p>
                <div className={styles.date}>{formatDate(p.publicado_em)}</div>
                <div className={styles.metrics}>
                  <Metric icon="♥" value={fmt(p.curtidas)}    label="curtidas" />
                  <Metric icon="💬" value={fmt(p.comentarios)} label="coment."  />
                  <Metric icon="🔖" value={fmt(p.salvamentos)} label="salvos"   />
                  <Metric icon="↗" value={fmt(p.compartilhamentos)} label="comp." />
                </div>
                <div className={styles.metricsRow2}>
                  <span className={styles.alcance}>Alcance: <strong>{fmt(p.alcance)}</strong></span>
                  {p.tipo === 'REEL' && <span className={styles.alcance}>Plays: <strong>{fmt(p.plays)}</strong></span>}
                  <span className={`${styles.engaj} ${engajClass(p.engajamento_taxa)}`}>{p.engajamento_taxa}%</span>
                </div>
              </div>
            </div>
          )})}
        </div>
      )}
    </div>
  )
}

function Metric({ icon, value, label }) {
  return (
    <div className={styles.metric}>
      <div className={styles.metricVal}><span className={styles.metricIcon}>{icon}</span> {value}</div>
      <div className={styles.metricLbl}>{label}</div>
    </div>
  )
}

function PlaceholderThumb({ tipo }) {
  const colors = {
    IMAGE:           ['#F58529','#DD2A7B'],
    REEL:            ['#8134AF','#515BD4'],
    VIDEO:           ['#515BD4','#185FA5'],
    CAROUSEL_ALBUM:  ['#F77737','#FCAF45'],
    STORY:           ['#DD2A7B','#8134AF'],
  }
  const [a, b] = colors[tipo] || ['#888','#444']
  return (
    <div style={{
      width: '100%', height: '100%',
      background: `linear-gradient(135deg, ${a}, ${b})`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: 'rgba(255,255,255,0.85)', fontSize: 32,
    }}>
      {tipo === 'REEL' ? '▶' : tipo === 'STORY' ? '◇' : '◐'}
    </div>
  )
}

function engajClass(rate) {
  if (rate >= 6) return styles.engajHi
  if (rate >= 3) return styles.engajMid
  return styles.engajLo
}

function formatDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('pt-BR', { day:'2-digit', month:'short' }) +
         ' · ' + d.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' })
}
