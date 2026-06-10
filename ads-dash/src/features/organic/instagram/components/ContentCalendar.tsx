import { useMemo } from 'react'
import styles from './ContentCalendar.module.css'

// Calendário editorial — planejamento de conteúdo por dia (publicado +
// agendado + sugerido). Inspirado em Hootsuite/Buffer/Later.
// Os "sugeridos" são slots vazios em dias/horários de melhor performance.

const DOW = ['DOM','SEG','TER','QUA','QUI','SEX','SÁB']

const TIPO = {
  reel:     { label: 'REEL',     tone: 'magenta' },
  carousel: { label: 'CARROSSEL', tone: 'accent' },
  story:    { label: 'STORY',     tone: 'amber'   },
  post:     { label: 'POST',      tone: 'plain'   },
}

// gera o calendário a partir de hoje: 5 dias pra trás + 9 dias pra frente
function buildCalendar() {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const days = []
  for (let i = -5; i <= 9; i++) {
    const d = new Date(today)
    d.setDate(d.getDate() + i)
    days.push({
      date: d,
      key: d.toISOString().slice(0, 10),
      isToday: i === 0,
      isPast: i < 0,
    })
  }
  return days
}

// mock de posts — alguns publicados (no passado), alguns agendados (futuro),
// alguns slots sugeridos pela DNA (terça/sexta 19h, melhores horários).
function buildPosts(days) {
  const today = days.find(d => d.isToday).date
  const dateAt = offset => {
    const d = new Date(today); d.setDate(d.getDate() + offset); return d.toISOString().slice(0, 10)
  }
  return [
    // publicados
    { id: 'p1', date: dateAt(-4), hora: '12:30', tipo: 'reel',     titulo: 'POV: você descobriu o loiro perfeito',  status: 'publicado', engaj: '14.2%' },
    { id: 'p2', date: dateAt(-3), hora: '19:15', tipo: 'carousel', titulo: 'Antes e depois — mechas iluminadas',     status: 'publicado', engaj: '9.8%' },
    { id: 'p3', date: dateAt(-1), hora: '11:00', tipo: 'story',    titulo: 'Bastidor agenda lotada',                 status: 'publicado', engaj: '6.1%' },
    { id: 'p4', date: dateAt(-1), hora: '20:00', tipo: 'reel',     titulo: 'Transformação em 60 segundos',           status: 'publicado', engaj: '11.5%' },
    // agendados
    { id: 's1', date: dateAt(1),  hora: '19:00', tipo: 'reel',     titulo: 'Cliente reagindo ao resultado 🥹',       status: 'agendado',  engaj: null },
    { id: 's2', date: dateAt(3),  hora: '12:00', tipo: 'carousel', titulo: 'Tabela de preços pacote noiva',           status: 'agendado',  engaj: null },
    { id: 's3', date: dateAt(5),  hora: '19:00', tipo: 'reel',     titulo: '3 erros na descoloração caseira',         status: 'agendado',  engaj: null },
    // sugeridos (slots vazios em horários top)
    { id: 'g1', date: dateAt(2),  hora: '19:00', tipo: 'reel',     titulo: 'Slot top — gancho "resultado primeiro"',   status: 'sugerido',  engaj: null },
    { id: 'g2', date: dateAt(7),  hora: '19:00', tipo: 'reel',     titulo: 'Slot top — fórmula "antes e depois"',     status: 'sugerido',  engaj: null },
    { id: 'g3', date: dateAt(8),  hora: '12:00', tipo: 'carousel', titulo: 'Slot médio — dica educativa',              status: 'sugerido',  engaj: null },
  ]
}

const STATUS_LABEL = {
  publicado: { label: 'PUBL', tone: styles => styles.stPub },
  agendado:  { label: 'AGEND', tone: styles => styles.stSch },
  sugerido:  { label: 'SLOT', tone: styles => styles.stSug },
}

export default function ContentCalendar() {
  const days = useMemo(buildCalendar, [])
  const posts = useMemo(() => buildPosts(days), [days])

  const counts = {
    publicados: posts.filter(p => p.status === 'publicado').length,
    agendados:  posts.filter(p => p.status === 'agendado').length,
    sugeridos:  posts.filter(p => p.status === 'sugerido').length,
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.head}>
        <div>
          <h2 className={styles.title}>Calendário editorial</h2>
          <p className={styles.sub}>Publicado · agendado · slots sugeridos pela DNA do conteúdo vencedor.</p>
        </div>
        <div className={styles.legend}>
          <span className={styles.legItem}><span className={`${styles.legDot} ${styles.stPub}`} />{counts.publicados} publicados</span>
          <span className={styles.legItem}><span className={`${styles.legDot} ${styles.stSch}`} />{counts.agendados} agendados</span>
          <span className={styles.legItem}><span className={`${styles.legDot} ${styles.stSug}`} />{counts.sugeridos} sugeridos</span>
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
                {dayPosts.length === 0 && !d.isPast && (
                  <button className={styles.empty}>+ slot vazio</button>
                )}
                {dayPosts.map(p => {
                  const t = TIPO[p.tipo] || TIPO.post
                  const s = STATUS_LABEL[p.status]
                  return (
                    <div key={p.id} className={`${styles.post} ${styles['t_' + t.tone]} ${styles['s_' + p.status]}`}>
                      <div className={styles.postHead}>
                        <span className={styles.postTipo}>{t.label}</span>
                        <span className={styles.postHora}>{p.hora}</span>
                      </div>
                      <p className={styles.postTitulo}>{p.titulo}</p>
                      <div className={styles.postFoot}>
                        <span className={s.tone(styles)}>{s.label}</span>
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
