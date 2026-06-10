import { generateInsights, generateInstagramInsights, generateCompetitorInsights } from '@/lib/aiInsights'
import { useGoals } from '@/features/ads/hooks/useGoals'
import styles from './InsightsPanel.module.css'

const TONE_CLASS = {
  success: styles.toneSuccess,
  warning: styles.toneWarning,
  danger:  styles.toneDanger,
  info:    styles.toneInfo,
}
const TONE_ICON = {
  success: '✓',
  warning: '⚠',
  danger:  '⛔',
  info:    'ℹ',
}

export default function InsightsPanel({ data = null, ig = null, you = null, rivals = null, content = null, source = 'ads' }) {
  const { goals } = useGoals()

  let insights
  let subLabel
  if (source === 'instagram') {
    insights = generateInstagramInsights(ig)
    subLabel = 'Instagram orgânico'
  } else if (source === 'competitors') {
    insights = generateCompetitorInsights(you, rivals, content)
    subLabel = 'Análise competitiva'
  } else {
    insights = generateInsights(data, goals)
    subLabel = 'Análise automática'
  }

  return (
    <div className={styles.card}>
      <div className={styles.head}>
        <div className={styles.headLeft}>
          <div className={styles.aiIcon}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M12 2v4M5 8h14a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2v-8a2 2 0 012-2z"/><circle cx="9" cy="13" r="1"/><circle cx="15" cy="13" r="1"/></svg>
          </div>
          <div>
            <h3 className={styles.title}>Insights da IA</h3>
            <p className={styles.sub}>{subLabel} · {insights.length} recomendações</p>
          </div>
        </div>
        <span className={styles.badge}>BETA</span>
      </div>

      <div className={styles.list}>
        {insights.map((ins, i) => (
          <div key={i} className={`${styles.item} ${TONE_CLASS[ins.tone]}`}>
            <span className={styles.icon}>{TONE_ICON[ins.tone]}</span>
            <div className={styles.body}>
              <div className={styles.itemTitle}>{ins.title}</div>
              <div className={styles.itemText}>{ins.body}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
