import { useState, useEffect } from 'react'
import { HYPE_LEVELS } from '@/features/organic/instagram/lib/hypeDetector'
import styles from './HypeBanner.module.css'

const fmt = n => Number(n || 0).toLocaleString('pt-BR')

const TYPE_LABEL = {
  IMAGE: 'Imagem', VIDEO: 'Vídeo', CAROUSEL_ALBUM: 'Carrossel', REEL: 'Reel', STORY: 'Story',
}

export default function HypeBanner({ topHype, totalHype, compact = false }) {
  const [elapsed, setElapsed] = useState('')

  useEffect(() => {
    if (!topHype) return
    const update = () => setElapsed(timeAgo(topHype.post.publicado_em))
    update()
    const id = setInterval(update, 60000)
    return () => clearInterval(id)
  }, [topHype?.post?.id])

  if (!topHype) return null

  const conf = HYPE_LEVELS[topHype.level]
  const p = topHype.post

  if (compact) {
    return (
      <div className={`${styles.compact} ${styles[`level_${topHype.level}`]}`}>
        <span className={styles.pulse} />
        <span className={styles.compactIcon}>{conf.icon}</span>
        <div className={styles.compactBody}>
          <strong>{conf.label}!</strong> {TYPE_LABEL[p.tipo]} de {elapsed} — {p.engajamento_taxa}% engaj.
        </div>
      </div>
    )
  }

  return (
    <div
      className={`${styles.banner} ${styles[`level_${topHype.level}`]}`}
      style={{ '--accent': conf.color } as React.CSSProperties}
    >
      <div className={styles.glow} />
      <div className={styles.head}>
        <div className={styles.titleRow}>
          <span className={styles.pulseLg} />
          <span className={styles.icon}>{conf.icon}</span>
          <div>
            <h3 className={styles.title}>{conf.label.toUpperCase()}!</h3>
            <p className={styles.sub}>
              Você tem {totalHype > 1 ? `${totalHype} conteúdos no hype agora — esse é o mais quente:` : 'um conteúdo bombando agora:'}
            </p>
          </div>
        </div>
        <span className={styles.elapsed}>publicado {elapsed}</span>
      </div>

      <div className={styles.content}>
        <div className={styles.thumb}>
          {p.thumbnail_url
            ? <img src={p.thumbnail_url} alt="" />
            : <div className={styles.thumbPlaceholder}>{conf.icon}</div>}
          <span className={styles.typeBadge}>{TYPE_LABEL[p.tipo]}</span>
        </div>

        <div className={styles.body}>
          <p className={styles.caption}>{p.caption}</p>

          <div className={styles.statsRow}>
            <Stat label="Alcance"      value={fmt(p.alcance)}      hot />
            <Stat label="Engajamento"  value={`${p.engajamento_taxa}%`} hot />
            {p.tipo === 'REEL' && <Stat label="Plays" value={fmt(p.plays)} hot />}
            <Stat label="Curtidas"     value={fmt(p.curtidas)} />
            <Stat label="Comentários"  value={fmt(p.comentarios)} />
            <Stat label="Salvos"       value={fmt(p.salvamentos)} />
            <Stat label="Compart."     value={fmt(p.compartilhamentos)} />
          </div>

          <div className={styles.reasons}>
            <div className={styles.reasonsLabel}>Por que está no hype:</div>
            <ul className={styles.reasonsList}>
              {topHype.reasons.map((r, i) => (
                <li key={r.key || i}>{r.label}</li>
              ))}
            </ul>
          </div>

          <div className={styles.cta}>
            💡 <strong>Aproveita o momento:</strong> {ctaForLevel(topHype.level, p.tipo)}
          </div>
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value, hot = false }) {
  return (
    <div className={`${styles.stat} ${hot ? styles.statHot : ''}`}>
      <div className={styles.statValue}>{value}</div>
      <div className={styles.statLabel}>{label}</div>
    </div>
  )
}

function timeAgo(iso) {
  if (!iso) return ''
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60)        return 'agora há pouco'
  if (diff < 3600)      return `há ${Math.floor(diff/60)} min`
  if (diff < 86400)     return `há ${Math.floor(diff/3600)} h`
  return `há ${Math.floor(diff/86400)} d`
}

function ctaForLevel(level, tipo) {
  const isReel = tipo === 'REEL'
  if (level === 'blazing') {
    return isReel
      ? 'Sobe nos stories agora pra capturar essa audiência. Considera impulsionar o Reel — alcance orgânico vai cair em 48h.'
      : 'Compartilha nos stories e responde TODOS os comentários nas próximas 2h. Algoritmo está te entregando — não desperdiça.'
  }
  if (level === 'hot') {
    return isReel
      ? 'Responde aos comentários rapidamente e prepara um Reel de continuação no mesmo formato pra publicar em até 48h.'
      : 'Engaja nos comentários e republique no formato de Reel se ainda não tem. Esse tema tá ressoando.'
  }
  return 'Mantém o monitoramento. Se continuar subindo nas próximas 6h, sobe nos stories pra acelerar.'
}
