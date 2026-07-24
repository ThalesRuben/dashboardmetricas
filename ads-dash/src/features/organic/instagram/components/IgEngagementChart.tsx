import { Line } from 'react-chartjs-2'
import { Chart, CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip } from 'chart.js'
import { useChartTheme } from '@/shared/lib/chartTheme'
Chart.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip)

export default function IgEngagementChart({ serie }) {
  const t = useChartTheme()
  return (
    <div style={{ position:'relative', height:200 }}>
      <Line
        data={{
          labels: serie.map(s => s.date),
          datasets: [{
            label: 'Engajamento %',
            data: serie.map(s => s.value),
            borderColor: '#7F77DD',
            backgroundColor: 'rgba(127,119,221,0.10)',
            tension: 0.4,
            pointRadius: 4,
            fill: true,
          }],
        }}
        options={{
          responsive:true, maintainAspectRatio:false,
          plugins:{ legend:{ display:false }, tooltip:{ backgroundColor:t.tooltipBg, titleColor:t.tooltipFg, bodyColor:t.tooltipFg } },
          scales:{
            y:{ beginAtZero:true, ticks:{ font:{ size:11 }, color:t.tick, callback:(v: string | number) => Number(v).toFixed(1) + '%' }, grid:{ color:t.grid } },
            x:{ ticks:{ font:{ size:11 }, color:t.tick }, grid:{ display:false } },
          },
        }}
      />
    </div>
  )
}
