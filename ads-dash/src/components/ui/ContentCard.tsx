import type { ReactNode } from 'react'
import styles from './ContentCard.module.css'

type HypeLevel = 'viral' | 'hot' | 'rising' | 'down'
type MediaType = 'reel' | 'tiktok' | 'carousel' | 'image' | 'story' | 'youtube'

interface HypeBadge { level: HypeLevel; multiplier?: string }
interface Author { initials: string; handle: string }
interface Metric { label: string; value: string; highlight?: boolean }
interface Action { label: string; onClick: () => void }

interface ContentCardProps {
  mediaType?: MediaType
  thumbnailUrl?: string
  caption?: ReactNode
  hypeBadge?: HypeBadge
  author?: Author
  metrics?: Metric[]
  tags?: string[]
  publishedAt?: ReactNode
  action?: Action
  viralBorder?: boolean
}

const HYPE: Record<HypeLevel, { bg: string; color: string; icon: string; label: string }> = {
  viral:  { bg: '#412402', color: 'var(--accent-amber)',  icon: '🚀', label: 'VIRAL' },
  hot:    { bg: '#2a2018', color: 'var(--accent-amber)',  icon: '🔥', label: 'HOT' },
  rising: { bg: 'var(--bg-elevated)', color: 'var(--text-subtle)', icon: '📈', label: 'SUBINDO' },
  down:   { bg: 'rgba(240,149,149,0.15)', color: 'var(--accent-red)', icon: '↓', label: 'CAIU' },
}

const MEDIA_LABEL: Record<MediaType, string> = {
  reel:     '▶ Reel',
  tiktok:   '♪ TikTok',
  carousel: '◫ Carrossel',
  image:    '◉ Imagem',
  story:    '◐ Story',
  youtube:  '▷ YouTube',
}

const MEDIA_GRADIENT: Record<MediaType, string> = {
  reel:     'linear-gradient(135deg, #d4537e 0%, #7f77dd 100%)',
  tiktok:   'linear-gradient(135deg, #25F4EE 0%, #FE2C55 100%)',
  carousel: 'linear-gradient(135deg, #5dcaa5 0%, #85b7eb 100%)',
  image:    'linear-gradient(135deg, #85b7eb 0%, #7f77dd 100%)',
  story:    'linear-gradient(135deg, #ef9f27 0%, #d4537e 100%)',
  youtube:  'linear-gradient(135deg, #FF0000 0%, #2a3344 100%)',
}

export default function ContentCard({
  mediaType = 'reel',
  thumbnailUrl,
  caption,
  hypeBadge,
  author,
  metrics = [],
  tags = [],
  publishedAt,
  action,
  viralBorder,
}: ContentCardProps) {
  const hype = hypeBadge ? HYPE[hypeBadge.level] : null

  return (
    <article className={`${styles.card} ${viralBorder ? styles.viralBorder : ''}`}>
      <div className={styles.preview}
           style={{ background: thumbnailUrl ? `url(${thumbnailUrl}) center/cover` : MEDIA_GRADIENT[mediaType] || MEDIA_GRADIENT.reel }}
      >
        <span className={styles.mediaBadge}>{MEDIA_LABEL[mediaType] || MEDIA_LABEL.reel}</span>
        {hype && hypeBadge && (
          <span className={styles.hypeBadge} style={{ background: hype.bg, color: hype.color }}>
            {hype.icon} {hypeBadge.multiplier || hype.label}
          </span>
        )}
        {caption && (
          <div className={styles.captionOverlay}>
            <p className={styles.caption}>{caption}</p>
          </div>
        )}
      </div>

      <div className={styles.body}>
        {(author || publishedAt) && (
          <div className={styles.meta}>
            {author && (
              <span className={styles.author}>
                <span className={styles.avatar}>{author.initials}</span>
                {author.handle}
              </span>
            )}
            {publishedAt && <span className={styles.date}>{publishedAt}</span>}
          </div>
        )}

        {metrics.length > 0 && (
          <div className={styles.metrics}>
            {metrics.slice(0, 2).map((m, i) => (
              <div key={i} className={styles.metric}>
                <span className={`${styles.metricValue} ${m.highlight ? styles.metricHighlight : ''}`}>
                  {m.value}
                </span>
                <span className={styles.metricLabel}>{m.label}</span>
              </div>
            ))}
          </div>
        )}

        {tags.length > 0 && (
          <div className={styles.tags}>
            {tags.map((t, i) => (
              <span key={i} className={styles.tag}>{t}</span>
            ))}
          </div>
        )}
      </div>

      {action && (
        <button className={styles.action} onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </article>
  )
}
