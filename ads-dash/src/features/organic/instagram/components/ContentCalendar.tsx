import { useMemo } from 'react'
import { useInstagramMetrics } from '@/features/organic/instagram/hooks/useInstagramMetrics'
import type { IgPost } from '@/app/providers/MetricsContext'
import styles from './ContentCalendar.module.css'

// Calendário editorial — leia os últimos posts publicados diretamente de
// `instagram_posts` (via useInstagramMetrics), com uma janela de -14 dias
// até hoje. O futuro fica com "slot vazio" — planejamento manual ainda
// não é suportado (feature futura).

const DOW = ['DOM','SEG','TER','QUA','QUI','SEX','SÁB']

interface TipoInfo { label: string; tone: 'magenta' | 'accent' | 'amber' | 'plain' }
const TIPO: Record<string, TipoInfo> = {
  reel:     { label: 'REEL',      tone: 'magenta' },
  carousel: { label: 'CARROSSEL', tone: 'accent'  },
  story:    { label: 'STORY',     tone: 'amber'   },
  post:     { label: 'POST',      tone: 'plain'   },
}

interface CalendarDay {
  date: Date
  key: string
  isToday: boolean
  isPast: boolean
  isFuture: boolean
}

interface DisplayPost {
  id: string
  date: string
  hora: string
  tipo: 'reel' | 'carousel' | 'story' | 'post'
  titulo: string
  engaj: string | null
  alcance: number
}

// -14 dias até +7 (mostra o histórico recente + espaço pra planejar)
function buildCalendar(): CalendarDay[] {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const days: CalendarDay[] = []
  for (let i = -14; i <= 7; i++) {
    const d = new Date(today)
    d.setDate(d.getDate() + i)
    days.push({
      date: d,
      key: d.toISOString().slice(0, 10),
      isToday: i === 0,
      isPast: i < 0,
      isFuture: i > 0,
    })
  }
  return days
}

function mapTipo(igTipo: string): 'reel' | 'carousel' | 'story' | 'post' {
  if (igTipo === 'REEL' || igTipo === 'VIDEO') return 'reel'
  if (igTipo === 'CAROUSEL' || igTipo === 'CAROUSEL_ALBUM') return 'carousel'
  if (igTipo === 'STORY') return 'story'
  return 'post'
}

function extractPosts(igPosts: IgPost[], days: CalendarDay[]): DisplayPost[] {
  const dayKeys = new Set(days.map(d => d.key))
  return igPosts
    .filter(p => {
      if (!p.publicado_em) return false
      const dateKey = new Date(p.publicado_em).toISOString().slice(0, 10)
      return dayKeys.has(dateKey)
    })
    .map(p => {
      const d = new Date(p.publicado_em)
      const dateKey = d.toISOString().slice(0, 10)
      const hora = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
      const caption = (p.caption || '').trim()
      return {
        id: p.id || (p as unknown as { ig_post_id?: string }).ig_post_id || dateKey + hora,
        date: dateKey,
        hora,
        tipo: mapTipo(p.tipo),
        titulo: caption ? caption.slice(0, 80) + (caption.length > 80 ? '…' : '') : '(sem legenda)',
        engaj: p.engajamento_taxa > 0 ? p.engajamento_taxa.toFixed(1) + '%' : null,
        alcance: p.alcance || 0,
      }
    })
    // Melhor engajamento primeiro dentro do mesmo dia
    .sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date)
      return (parseFloat(b.engaj || '0') - parseFloat(a.engaj || '0'))
    })
}

export default function ContentCalendar() {
  const { data, loading } = useInstagramMetrics()
  const igPosts = data?.posts || []

  const days = useMemo(buildCalendar, [])
  const posts = useMemo(() => extractPosts(igPosts, days), [igPosts, days])

  const counts = {
    publicados: posts.length,
    dias:       new Set(posts.map(p => p.date)).size,
    topEngaj:   posts.length > 0 ? Math.max(...posts.map(p => parseFloat(p.engaj || '0'))) : 0,
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.head}>
        <div>
          <h2 className={styles.title}>Calendário editorial</h2>
          <p className={styles.sub}>
            {loading
              ? 'Carregando posts sincronizados…'
              : `Últimas 3 semanas + janela de planejamento. Dado real de instagram_posts.`}
          </p>
        </div>
        <div className={styles.legend}>
          <span className={styles.legItem}><span className={`${styles.legDot} ${styles.stPub}`} />{counts.publicados} posts publicados</span>
          <span className={styles.legItem}>{counts.dias} dias com publicação</span>
          {counts.topEngaj > 0 && (
            <span className={styles.legItem}>melhor: {counts.topEngaj.toFixed(1)}%</span>
          )}
        </div>
      </div>

      <div className={styles.grid}>
        {days.map(d => {
          const dayPosts = posts.filter(p => p.date === d.key)
          return (
            <div
              key={d.key}
              className={`${styles.day} ${d.isToday ? styles.dayToday : ''} ${d.isPast ? styles.dayPast : ''}`}
            >
              <div className={styles.dayHead}>
                <span className={styles.dayDow}>{DOW[d.date.getDay()]}</span>
                <span className={styles.dayNum}>{String(d.date.getDate()).padStart(2, '0')}</span>
                {d.isToday && <span className={styles.todayTag}>HOJE</span>}
              </div>
              <div className={styles.dayBody}>
                {dayPosts.length === 0 && d.isPast && (
                  <span className={styles.emptyPast}>sem publicação</span>
                )}
                {dayPosts.length === 0 && (d.isToday || d.isFuture) && (
                  <span className={styles.emptyFuture}>—</span>
                )}
                {dayPosts.map(p => {
                  const t = TIPO[p.tipo] || TIPO.post
                  return (
                    <div key={p.id} className={`${styles.post} ${styles['t_' + t.tone]} ${styles.s_publicado}`}>
                      <div className={styles.postHead}>
                        <span className={styles.postTipo}>{t.label}</span>
                        <span className={styles.postHora}>{p.hora}</span>
                      </div>
                      <p className={styles.postTitulo}>{p.titulo}</p>
                      <div className={styles.postFoot}>
                        <span className={styles.stPub}>PUBL</span>
                        {p.engaj && <span className={styles.postEngaj}>engaj. {p.engaj}</span>}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
