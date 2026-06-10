import { Bar } from 'react-chartjs-2'
import { useChartTheme } from '@/shared/lib/chartTheme'

export default function IgReachChart({ serie }) {
  const t = useChartTheme()
  return (
    <div style={{ position:'relative', height:200 }}>
      <Bar
        data={{
          labels: serie.map(s => s.date),
          datasets: [{
            label: 'Alcance',
            data: serie.map(s => s.value),
            backgroundColor: '#F58529',
            borderRadius: 4,
          }],
        }}
        options={{
          responsive:true, maintainAspectRatio:false,
          plugins:{ legend:{ display:false }, tooltip:{ backgroundColor:t.tooltipBg, titleColor:t.tooltipFg, bodyColor:t.tooltipFg } },
          scales:{
            y:{ beginAtZero:true, ticks:{ font:{ size:11 }, color:t.tick, callback:v => v.toLocaleString('pt-BR') }, grid:{ color:t.grid } },
            x:{ ticks:{ font:{ size:11 }, color:t.tick }, grid:{ display:false } },
          },
        }}
      />
    </div>
  )
}
