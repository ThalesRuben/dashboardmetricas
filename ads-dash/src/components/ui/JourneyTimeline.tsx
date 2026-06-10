import { useState } from 'react'
import styles from './JourneyTimeline.module.css'

// Jornada do cliente — junta os pontos de contato entre canais (anúncio →
// Instagram → WhatsApp → agendamento → venda). Hoje cada canal vive isolado;
// aqui a história fica unificada.
const JOURNEYS = [
  {
    id: 'j1', nome: 'Bianca Lima', status: 'venda', valor: 980,
    primeiro: '2026-05-10', ultimo: '2026-05-18',
    touches: [
      { dia: 'D-9',  canal: 'meta',    evento: 'Viu anúncio "Pacote noiva 2026"',         detalhe: 'Reach via campanha CTWA' },
      { dia: 'D-8',  canal: 'ig',      evento: 'Visitou perfil @theblondeconcept',         detalhe: '4 min navegando · viu Reels' },
      { dia: 'D-8',  canal: 'ig',      evento: 'Começou a seguir',                          detalhe: '+1 seguidor (orgânico atribuído)' },
      { dia: 'D-5',  canal: 'meta',    evento: 'Viu anúncio "Antes e depois mechas"',      detalhe: 'Retargeting' },
      { dia: 'D-2',  canal: 'wpp',     evento: 'Mandou mensagem',                           detalhe: '"Quanto custa o pacote noiva?"' },
      { dia: 'D-1',  canal: 'wpp',     evento: 'Agendou avaliação',                         detalhe: 'Qui 14h confirmado' },
      { dia: 'D-0',  canal: 'venda',   evento: 'Fechou — Pacote noiva',                     detalhe: 'R$ 980 · 1ª compra' },
    ],
  },
  {
    id: 'j2', nome: 'Marina Alves', status: 'lead', valor: 0,
    primeiro: '2026-05-17', ultimo: '2026-05-19',
    touches: [
      { dia: 'D-2',  canal: 'tiktok',  evento: 'Viu TikTok "POV: você descobriu o loiro perfeito"', detalhe: '142k views totais · ela curtiu' },
      { dia: 'D-1',  canal: 'ig',      evento: 'Visitou perfil',                            detalhe: 'Veio do TikTok' },
      { dia: 'D-1',  canal: 'meta',    evento: 'Viu anúncio "Mechas iluminadas"',           detalhe: 'Lookalike público IG' },
      { dia: 'D-0',  canal: 'wpp',     evento: 'Mandou mensagem',                           detalhe: '"Quer agendar mechas pro fim de semana"' },
    ],
  },
  {
    id: 'j3', nome: 'Júlia Ramos', status: 'agendado', valor: 0,
    primeiro: '2026-05-15', ultimo: '2026-05-19',
    touches: [
      { dia: 'D-4',  canal: 'google',  evento: 'Buscou "salão de beleza loiro"',            detalhe: 'Clicou no anúncio · pos. 4' },
      { dia: 'D-4',  canal: 'site',    evento: 'Visitou landing "Mechas iluminadas"',        detalhe: '2 min · saiu' },
      { dia: 'D-2',  canal: 'meta',    evento: 'Viu anúncio (retargeting)',                  detalhe: 'Cookie 2 dias' },
      { dia: 'D-0',  canal: 'wpp',     evento: 'Mandou mensagem + agendou',                  detalhe: 'Qui 15h' },
    ],
  },
  {
    id: 'j4', nome: 'Patrícia Gomes', status: 'aberta', valor: 0,
    primeiro: '2026-05-18', ultimo: '2026-05-19',
    touches: [
      { dia: 'D-1',  canal: 'ig',      evento: 'Comentou em post de antes e depois',         detalhe: '"Quanto custa?" — público' },
      { dia: 'D-0',  canal: 'wpp',     evento: 'Foi direcionada e mandou mensagem',          detalhe: '"Perguntou valor da progressiva"' },
    ],
  },
]

const CANAL = {
  meta:   { label: 'Meta Ads',  color: 'var(--color-meta)',    icon: '◆' },
  google: { label: 'Google',    color: 'var(--color-google)',  icon: 'G' },
  ig:     { label: 'Instagram', color: '#E1306C',              icon: '◉' },
  tiktok: { label: 'TikTok',    color: '#25F4EE',              icon: '♪' },
  wpp:    { label: 'WhatsApp',  color: '#25D366',              icon: '▶' },
  site:   { label: 'Site',      color: 'var(--text-muted)',    icon: '⌘' },
  venda:  { label: 'Venda',     color: 'var(--accent)',        icon: '$' },
}

const STATUS = {
  venda:    { label: 'VENDA',    tone: 'success' },
  agendado: { label: 'AGENDADO', tone: 'accent'  },
  lead:     { label: 'LEAD',     tone: 'amber'   },
  aberta:   { label: 'ABERTA',   tone: 'muted'   },
}

export default function JourneyTimeline() {
  const [selected, setSelected] = useState(JOURNEYS[0].id)
  const journey = JOURNEYS.find(j => j.id === selected) || JOURNEYS[0]

  return (
    <div className={styles.wrap}>
      <div className={styles.head}>
        <div>
          <h2 className={styles.title}>Jornada unificada</h2>
          <p className={styles.sub}>Cada cliente, todos os toques cronológicos entre canais — Meta · Google · Instagram · TikTok · WhatsApp.</p>
        </div>
        <span className={styles.demoTag}>DADOS DE DEMONSTRAÇÃO</span>
      </div>

      <div className={styles.list}>
        {JOURNEYS.map(j => {
          const st = STATUS[j.status]
          return (
            <button
              key={j.id}
              className={`${styles.listItem} ${selected === j.id ? styles.listItemActive : ''}`}
              onClick={() => setSelected(j.id)}
            >
              <div className={styles.listMain}>
                <span className={styles.listNome}>{j.nome}</span>
                <span className={styles.listTouches}>{j.touches.length} toques · {new Set(j.touches.map(t => t.canal)).size} canais</span>
              </div>
              <span className={`${styles.listStatus} ${styles['s_' + st.tone]}`}>{st.label}</span>
            </button>
          )
        })}
      </div>

      <div className={`${styles.detail}`}>
        <div className={styles.detailHead}>
          <div>
            <h3 className={styles.detailName}>{journey.nome}</h3>
            <span className={styles.detailMeta}>
              {journey.touches.length} toques · {new Set(journey.touches.map(t => t.canal)).size} canais
              {journey.valor > 0 && ` · R$ ${journey.valor.toLocaleString('pt-BR')}`}
            </span>
          </div>
          <span className={`${styles.detailStatus} ${styles['s_' + STATUS[journey.status].tone]}`}>
            {STATUS[journey.status].label}
          </span>
        </div>

        <ol className={styles.timeline}>
          {journey.touches.map((t, i) => {
            const c = CANAL[t.canal]
            const last = i === journey.touches.length - 1
            return (
              <li key={i} className={styles.touch}>
                <span className={styles.touchDot} style={{ background: c.color, boxShadow: `0 0 8px ${c.color}` }}>
                  {c.icon}
                </span>
                {!last && <span className={styles.touchLine} />}
                <div className={styles.touchBody}>
                  <div className={styles.touchTop}>
                    <span className={styles.touchCanal} style={{ color: c.color }}>{c.label}</span>
                    <span className={styles.touchDia}>{t.dia}</span>
                  </div>
                  <p className={styles.touchEvento}>{t.evento}</p>
                  <p className={styles.touchDetalhe}>{t.detalhe}</p>
                </div>
              </li>
            )
          })}
        </ol>
      </div>
    </div>
  )
}
