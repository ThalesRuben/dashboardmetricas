import { useGoals } from '@/features/ads/hooks/useGoals'
import { useMetrics } from '@/features/ads/hooks/useMetrics'
import { fmtNumber, fmtRoas, fmtPct } from '@/shared/lib/format'
import styles from './GoalTracker.module.css'

const TRACKED_KEYS = ['roas', 'ctr', 'mensagens', 'vendas']

const GOAL_META = {
  roas: {
    label: 'ROAS',
    pickValue: d => d.roas,
    fmt: v => fmtRoas(v),
    suffix: 'x',
    minMode: false, // valor maior é melhor
  },
  ctr: {
    label: 'CTR Meta',
    pickValue: d => d.ctrMeta,
    fmt: v => fmtPct(v, 2),
    suffix: '%',
    minMode: false,
  },
  mensagens: {
    label: 'Mensagens',
    pickValue: d => d.mensagens,
    fmt: v => fmtNumber(v),
    suffix: '',
    minMode: false,
  },
  vendas: {
    label: 'Vendas',
    pickValue: d => d.vendas,
    fmt: v => fmtNumber(v),
    suffix: '',
    minMode: false,
  },
}

function paceLabel(progress) {
  const today = new Date()
  const dayOfMonth = today.getDate()
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
  const expected = dayOfMonth / daysInMonth
  if (progress >= expected * 1.1) return { tone: 'success', text: 'Acima do ritmo' }
  if (progress >= expected * 0.9) return { tone: 'info',    text: 'No ritmo' }
  return { tone: 'warning', text: 'Atrasado' }
}

export default function GoalTracker() {
  const { goals, loading: goalsLoading } = useGoals()
  const { data: dataMes,    loading: loadingMes }    = useMetrics('mes')
  const { data: dataHoje,   loading: loadingHoje }   = useMetrics('hoje')

  if (goalsLoading || loadingMes || loadingHoje || !dataMes || !dataHoje) {
    return <div className={styles.loading}>Calculando metas...</div>
  }

  const tracked = TRACKED_KEYS
    .map(key => {
      const goal = goals.find(g => g.key === key && g.enabled)
      if (!goal) return null
      const meta = GOAL_META[key]
      if (!meta) return null

      // Para ROAS e CTR usamos o valor médio do mês.
      // Para mensagens e vendas, usamos o cumulativo do mês contra a meta diária × dias decorridos.
      const isAverage = key === 'roas' || key === 'ctr'
      const today = new Date()
      const dayOfMonth = today.getDate()
      const isCumulative = !isAverage

      const monthValue = meta.pickValue(dataMes)
      const todayValue = meta.pickValue(dataHoje)

      const target = isCumulative
        ? Number(goal.value) * dayOfMonth
        : Number(goal.value)

      const current = isAverage ? monthValue : monthValue
      const ratio = target > 0 ? Math.min(1.5, current / target) : 0
      const pct = Math.round(ratio * 100)
      const ok = ratio >= 1
      const pace = isCumulative ? paceLabel(current / (Number(goal.value) * 30)) : null

      return {
        key,
        label: meta.label,
        currentDisplay: meta.fmt(current),
        targetDisplay:  meta.fmt(Number(goal.value)) + (isCumulative ? '/dia' : ''),
        todayDisplay:   meta.fmt(todayValue),
        ratio,
        pct,
        ok,
        pace,
        isCumulative,
      }
    })
    .filter(Boolean)

  if (!tracked.length) {
    return (
      <div className={styles.card}>
        <div className={styles.empty}>
          Nenhuma meta ativa. Configure em <a href="/alerts" className={styles.link}>Alertas</a>.
        </div>
      </div>
    )
  }

  return (
    <div className={styles.card}>
      <div className={styles.head}>
        <div>
          <h3 className={styles.title}>🎯 Metas do mês</h3>
          <p className={styles.sub}>Progresso vs. meta configurada · ajuste em /alerts</p>
        </div>
      </div>

      <div className={styles.grid}>
        {tracked.map(t => (
          <div key={t.key} className={`${styles.item} ${t.ok ? styles.itemOk : ''}`}>
            <div className={styles.itemHead}>
              <span className={styles.itemLabel}>{t.label}</span>
              {t.pace && <span className={`${styles.pace} ${styles[`pace_${t.pace.tone}`]}`}>{t.pace.text}</span>}
            </div>

            <div className={styles.itemValues}>
              <span className={styles.itemCurrent}>{t.currentDisplay}</span>
              <span className={styles.itemSep}>/</span>
              <span className={styles.itemTarget}>{t.targetDisplay}</span>
            </div>

            <div className={styles.bar}>
              <div
                className={`${styles.barFill} ${t.ok ? styles.barFillOk : ''}`}
                style={{ width: `${Math.min(100, t.pct)}%` }}
              />
              {t.pct > 100 && (
                <div className={styles.barOver} style={{ width: `${Math.min(50, t.pct - 100)}%` }} />
              )}
            </div>

            <div className={styles.itemFoot}>
              <span className={styles.itemPct}>{t.pct}%</span>
              {t.isCumulative && (
                <span className={styles.itemToday}>+{t.todayDisplay} hoje</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
