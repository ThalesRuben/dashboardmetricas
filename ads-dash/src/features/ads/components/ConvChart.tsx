import { Line } from 'react-chartjs-2'
import { Chart, CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip } from 'chart.js'
import { useChartTheme } from '@/shared/lib/chartTheme'
Chart.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip)

export default function ConvChart({ data }) {
  const t = useChartTheme()
  return (
    <div style={{ position:'relative', height:200 }}>
      <Line
        data={{
          labels: data.labels,
          datasets: [
            { label:'Mensagens',    data:data.mensagens,    borderColor:t.convMsg,    backgroundColor:'rgba(127,119,221,0.08)', tension:0.4, pointRadius:3, fill:true },
            { label:'Agendamentos', data:data.agendamentos, borderColor:t.convAgend,  backgroundColor:'rgba(29,158,117,0.08)',  tension:0.4, pointRadius:3, fill:true },
            { label:'Vendas',       data:data.vendas,       borderColor:t.convVendas, backgroundColor:'rgba(216,90,48,0.08)',   tension:0.4, pointRadius:3, fill:true },
          ]
        }}
        options={{
          responsive:true, maintainAspectRatio:false,
          plugins:{ legend:{ display:false }, tooltip:{ backgroundColor:t.tooltipBg, titleColor:t.tooltipFg, bodyColor:t.tooltipFg } },
          scales:{
            y:{ beginAtZero:true, ticks:{ font:{size:11}, color:t.tick }, grid:{ color:t.grid } },
            x:{ ticks:{ font:{size:10}, color:t.tick }, grid:{ display:false } }
          }
        }}
      />
    </div>
  )
}
