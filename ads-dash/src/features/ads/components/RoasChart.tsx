import { Bar } from 'react-chartjs-2'
import { Chart, CategoryScale, LinearScale, BarElement, Tooltip, Legend } from 'chart.js'
import { useChartTheme } from '@/shared/lib/chartTheme'
Chart.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend)

export default function RoasChart({ data }) {
  const t = useChartTheme()
  return (
    <div style={{ position:'relative', height:200 }}>
      <Bar
        data={{
          labels: data.labels,
          datasets: [
            { label:'Hoje',  data:data.hoje,  backgroundColor:[t.metaSolid, t.googleSolid], borderRadius:4 },
            { label:'Ontem', data:data.ontem, backgroundColor:[t.metaFaded, t.googleFaded], borderRadius:4 },
          ]
        }}
        options={{
          responsive:true, maintainAspectRatio:false,
          plugins:{ legend:{ display:false }, tooltip:{ backgroundColor:t.tooltipBg, titleColor:t.tooltipFg, bodyColor:t.tooltipFg } },
          scales:{
            y:{ beginAtZero:true, ticks:{ callback:v=>v+'x', font:{size:11}, color:t.tick }, grid:{ color:t.grid } },
            x:{ ticks:{ font:{size:11}, color:t.tick }, grid:{ display:false } }
          }
        }}
      />
    </div>
  )
}
