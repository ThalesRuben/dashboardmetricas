import { Line } from 'react-chartjs-2'
import { useChartTheme } from '@/shared/lib/chartTheme'

export default function CtrChart({ data }) {
  const t = useChartTheme()
  return (
    <div style={{ position:'relative', height:200 }}>
      <Line
        data={{
          labels: data.labels,
          datasets: [
            { label:'Meta',   data:data.meta,   borderColor:t.metaSolid,   tension:0.4, pointRadius:3, borderDash:[] },
            { label:'Google', data:data.google, borderColor:t.googleSolid, tension:0.4, pointRadius:3, borderDash:[5,3] },
          ]
        }}
        options={{
          responsive:true, maintainAspectRatio:false,
          plugins:{ legend:{ display:false }, tooltip:{ backgroundColor:t.tooltipBg, titleColor:t.tooltipFg, bodyColor:t.tooltipFg } },
          scales:{
            y:{ ticks:{ callback:(v: string | number) => Number(v).toFixed(1)+'%', font:{size:11}, color:t.tick }, grid:{ color:t.grid } },
            x:{ ticks:{ font:{size:10}, color:t.tick }, grid:{ display:false } }
          }
        }}
      />
    </div>
  )
}
