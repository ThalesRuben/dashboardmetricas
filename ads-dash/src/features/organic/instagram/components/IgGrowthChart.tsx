import { Line } from 'react-chartjs-2'
import { Chart, CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip } from 'chart.js'
import { useChartTheme } from '@/shared/lib/chartTheme'
Chart.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip)

export default function IgGrowthChart({ serie }) {
  const t = useChartTheme()
  return (
    <div style={{ position:'relative', height:200 }}>
      <Line
        data={{
          labels: serie.map(s => s.date),
          datasets: [{
            label: 'Seguidores',
            data: serie.map(s => s.value),
            borderColor: '#E1306C',
            backgroundColor: 'rgba(225,48,108,0.10)',
            tension: 0.35,
            pointRadius: 3,
            fill: true,
          }],
        }}
        options={{
          responsive:true, maintainAspectRatio:false,
          plugins:{ legend:{ display:false }, tooltip:{ backgroundColor:t.tooltipBg, titleColor:t.tooltipFg, bodyColor:t.tooltipFg } },
          scales:{
            y:{ ticks:{ font:{ size:11 }, color:t.tick, callback:v => v.toLocaleString('pt-BR') }, grid:{ color:t.grid } },
            x:{ ticks:{ font:{ size:10 }, color:t.tick }, grid:{ display:false } },
          },
        }}
      />
    </div>
  )
}
