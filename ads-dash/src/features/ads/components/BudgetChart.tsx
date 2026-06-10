import { Doughnut } from 'react-chartjs-2'
import { Chart, ArcElement, Tooltip } from 'chart.js'
import { useChartTheme } from '@/shared/lib/chartTheme'
import { fmtBRL } from '@/shared/lib/format'
import styles from './BudgetChart.module.css'
Chart.register(ArcElement, Tooltip)

export default function BudgetChart({ data }) {
  const t = useChartTheme()
  const total = data.meta + data.google
  const metaPct = Math.round((data.meta / total) * 100)
  const googlePct = 100 - metaPct

  return (
    <div className={styles.wrap}>
      <div className={styles.donut}>
        <Doughnut
          data={{
            labels: ['Meta Ads', 'Google Ads'],
            datasets: [{ data: [data.meta, data.google], backgroundColor: [t.metaSolid, t.googleSolid], borderWidth: 0 }],
          }}
          options={{
            cutout: '65%',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: { backgroundColor: t.tooltipBg, titleColor: t.tooltipFg, bodyColor: t.tooltipFg },
            },
          }}
        />
      </div>
      <div className={styles.legend}>
        <LegendItem color={t.metaSolid}   name="Meta Ads"   value={fmtBRL(data.meta)}   pct={metaPct} />
        <LegendItem color={t.googleSolid} name="Google Ads" value={fmtBRL(data.google)} pct={googlePct} />
      </div>
    </div>
  )
}

function LegendItem({ color, name, value, pct }) {
  return (
    <div className={styles.legendItem}>
      <div className={styles.legendHead}>
        <span className={styles.dot} style={{ background: color }} />
        <span className={styles.legendName}>{name}</span>
      </div>
      <div className={styles.legendValue}>{value}</div>
      <div className={styles.legendPct}>{pct}% do total</div>
    </div>
  )
}
