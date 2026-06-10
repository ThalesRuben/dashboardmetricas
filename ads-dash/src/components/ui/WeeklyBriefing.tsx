import { buildBriefing } from '@/lib/narrativeBriefing'
import styles from './WeeklyBriefing.module.css'

// Resumo narrativo da semana — o que aconteceu em 1 parágrafo.
// Substitui "olhar pra 8 KPIs e tentar entender".
export default function WeeklyBriefing({ summary, prev, ig }) {
  const b = buildBriefing(summary, prev, ig)

  return (
    <div className={`${styles.card} cc-frame`}>
      <div className={styles.head}>
        <span className={styles.tag}>RESUMO · ÚLTIMOS {summary?.days || 7} DIAS</span>
        <span className={styles.live}><span className={styles.dot} />NARRATIVA AUTOMÁTICA</span>
      </div>
      <p className={styles.paragrafo}>{b.paragrafo}</p>
      {b.destaques.length > 0 && (
        <div className={styles.destaques}>
          {b.destaques.map(d => (
            <span key={d.key} className={`${styles.destaque} ${styles['t_' + d.tone]}`}>
              {d.tone === 'up' ? '▲' : '▼'} {d.label} {d.delta >= 0 ? '+' : ''}{d.delta}%
            </span>
          ))}
        </div>
      )}
      {b.proximaAcao && (
        <div className={styles.acao}>
          <span className={styles.acaoLabel}>PRÓXIMA AÇÃO</span>
          <p className={styles.acaoTxt}>{b.proximaAcao}</p>
        </div>
      )}
    </div>
  )
}
