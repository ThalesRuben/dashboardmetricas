import { useState, useMemo } from 'react'
import { detectHype, HYPE_LEVELS } from '@/features/organic/instagram/lib/hypeDetector'
import styles from './IgTimeline.module.css'

const TYPE_LABEL = {
  IMAGE: 'Imagem', VIDEO: 'Vídeo', CAROUSEL_ALBUM: 'Carrossel', REEL: 'Reel', STORY: 'Story',
}
const TYPE_COLOR = {
  IMAGE:           '#F58529',
  VIDEO:           '#515BD4',
  CAROUSEL_ALBUM:  '#F77737',
  REEL:            '#8134AF',
  STORY:           '#DD2A7B',
}

const fmt = n => Number(n || 0).toLocaleString('pt-BR')

export default function IgTimeline({ posts, account }) {
  const [filter, setFilter] = useState('all')

  const hypeMap = useMemo(() => {
    const { hypePosts } = detectHype(posts, account)
    return new Map(hypePosts.map(h => [h.post.id, h]))
  }, [posts, account])

  const grouped = useMemo(() => {
    const filtered = posts.filter(p => filter === 'all' || p.tipo === filter)
    const sorted = [...filtered].sort((a, b) => new Date(b.publicado_em).getTime() - new Date(a.publicado_em).getTime())
    const map = new Map()
    for (const p of sorted) {
      const d = new Date(p.publicado_em)
      const dayKey = d.toISOString().slice(0, 10)
      if (!map.has(dayKey)) map.set(dayKey, [])
      map.get(dayKey).push(p)
    }
    return Array.from(map.entries())
  }, [posts, filter])

  return (
    <div className={styles.wrap}>
      <div className={styles.toolbar}>
        <div className={styles.tabs}>
          {['all','REEL','IMAGE','CAROUSEL_ALBUM','STORY'].map(k => (
            <button
              key={k}
              className={`${styles.tab} ${filter === k ? styles.tabActive : ''}`}
              onClick={() => setFilter(k)}
            >
              {k === 'all' ? 'Todos' : TYPE_LABEL[k]}
            </button>
          ))}
        </div>
        <div className={styles.summary}>
          {grouped.reduce((s, [, items]) => s + items.length, 0)} publicação(ões)
        </div>
      </div>

      {grouped.length === 0 ? (
        <div className={styles.empty}>Nenhum conteúdo nesse filtro.</div>
      ) : (
        <div className={styles.timeline}>
          {grouped.map(([dayKey, items]) => (
            <div key={dayKey} className={styles.dayGroup}>
              <div className={styles.dayHeader}>
                <div className={styles.dayDot} />
                <div>
                  <div className={styles.dayTitle}>{formatDay(dayKey)}</div>
                  <div className={styles.daySub}>{items.length} publicação(ões) neste dia</div>
                </div>
              </div>

              <div className={styles.dayItems}>
                {items.map(p => {
                  const hype = hypeMap.get(p.id) as { level: string } | undefined
                  const conf = hype ? HYPE_LEVELS[hype.level as keyof typeof HYPE_LEVELS] : null
                  return (
                  <div
                    key={p.id}
                    className={`${styles.item} ${hype ? styles.itemHype : ''}`}
                    style={hype && conf ? ({ '--hype-color': conf.color } as React.CSSProperties) : undefined}
                  >
                    <div className={styles.itemTime}>
                      {new Date(p.publicado_em).toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' })}
                    </div>
                    <div
                      className={styles.itemBadge}
                      style={{ background: TYPE_COLOR[p.tipo] }}
                    >
                      {TYPE_LABEL[p.tipo]}
                    </div>
                    <div className={styles.itemBody}>
                      <div className={styles.captionRow}>
                        {hype && (
                          <span className={styles.hypeChip} style={{ background: conf.color }}>
                            {conf.icon} {conf.label.toUpperCase()}
                          </span>
                        )}
                        <p className={styles.itemCaption}>{p.caption || 'Sem legenda'}</p>
                      </div>
                      <div className={styles.itemMetrics}>
                        <span>♥ {fmt(p.curtidas)}</span>
                        <span>💬 {fmt(p.comentarios)}</span>
                        <span>🔖 {fmt(p.salvamentos)}</span>
                        <span>↗ {fmt(p.compartilhamentos)}</span>
                        <span>👁 {fmt(p.alcance)}</span>
                        {p.tipo === 'REEL' && <span>▶ {fmt(p.plays)}</span>}
                        <span className={engClass(p.engajamento_taxa)}>{p.engajamento_taxa}% engaj.</span>
                      </div>
                    </div>
                  </div>
                )})}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function engClass(rate) {
  if (rate >= 6) return styles.engHi
  if (rate >= 3) return styles.engMid
  return styles.engLo
}

function formatDay(iso) {
  const d = new Date(iso + 'T12:00:00')
  const today = new Date()
  const yesterday = new Date(); yesterday.setDate(today.getDate() - 1)
  const diffDays = Math.round((today.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))
  const datePart = d.toLocaleDateString('pt-BR', { weekday:'long', day:'2-digit', month:'long' })
  if (diffDays === 0) return 'Hoje · ' + datePart
  if (diffDays === 1) return 'Ontem · ' + datePart
  return datePart.charAt(0).toUpperCase() + datePart.slice(1)
}
