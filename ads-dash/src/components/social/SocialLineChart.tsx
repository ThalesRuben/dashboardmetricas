import { Line, Bar } from 'react-chartjs-2'
import { Chart, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Filler, Tooltip } from 'chart.js'
import { useChartTheme } from '@/shared/lib/chartTheme'
Chart.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Filler, Tooltip)

// Gráfico genérico para crescimento / volume de redes sociais.
// type: 'line' | 'bar'
export default function SocialLineChart({ serie, color = '#185FA5', type = 'line', height = 200 }) {
  const t = useChartTheme()
  const labels = serie.map(s => s.date)
  const values = serie.map(s => s.value)

  const dataset = {
    label: 'Valor',
    data: values,
    borderColor: color,
    backgroundColor: type === 'bar' ? color : `${color}1f`,
    tension: 0.35,
    pointRadius: 3,
    fill: type === 'line',
    borderRadius: type === 'bar' ? 4 : undefined,
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { backgroundColor: t.tooltipBg, titleColor: t.tooltipFg, bodyColor: t.tooltipFg },
    },
    scales: {
      y: { ticks: { font: { size: 11 }, color: t.tick, callback: v => v.toLocaleString('pt-BR') }, grid: { color: t.grid } },
      x: { ticks: { font: { size: 11 }, color: t.tick }, grid: { display: false } },
    },
  }

  const ChartComp = type === 'bar' ? Bar : Line

  return (
    <div style={{ position: 'relative', height }}>
      <ChartComp data={{ labels, datasets: [dataset] }} options={options} />
    </div>
  )
}
