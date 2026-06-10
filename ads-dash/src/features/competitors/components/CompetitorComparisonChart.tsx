import { Line } from 'react-chartjs-2'
import { Chart, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend } from 'chart.js'
import { useChartTheme } from '@/shared/lib/chartTheme'
Chart.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend)

interface SeriePoint { date: string; value: number }
interface Serie {
  label: string
  cor: string
  points: SeriePoint[]
  highlight?: boolean
}

interface CompetitorComparisonChartProps {
  series: Serie[]
  metricLabel?: string
}

export default function CompetitorComparisonChart({ series, metricLabel = 'Seguidores' }: CompetitorComparisonChartProps) {
  const t = useChartTheme()

  // unifica os labels de data de todas as séries
  const allDates = [...new Set(series.flatMap(s => s.points.map(p => p.date)))]

  const datasets = series.map(s => ({
    label: s.label,
    data: allDates.map(d => s.points.find(p => p.date === d)?.value ?? null),
    borderColor: s.cor,
    backgroundColor: s.cor,
    tension: 0.35,
    pointRadius: 3,
    borderWidth: s.highlight ? 3 : 2,
    borderDash: s.highlight ? [] : [],
    spanGaps: true,
  }))

  return (
    <div style={{ position: 'relative', height: 260 }}>
      <Line
        data={{ labels: allDates, datasets }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: {
              display: true,
              position: 'bottom',
              labels: { font: { size: 11 }, color: t.tick, usePointStyle: true, pointStyle: 'circle', boxWidth: 6 },
            },
            tooltip: { backgroundColor: t.tooltipBg, titleColor: t.tooltipFg, bodyColor: t.tooltipFg },
          },
          scales: {
            y: {
              ticks: { font: { size: 11 }, color: t.tick, callback: (v: string | number) => Number(v).toLocaleString('pt-BR') },
              grid: { color: t.grid },
              title: { display: true, text: metricLabel, color: t.tick, font: { size: 10 } },
            },
            x: { ticks: { font: { size: 11 }, color: t.tick }, grid: { display: false } },
          },
        }}
      />
    </div>
  )
}
