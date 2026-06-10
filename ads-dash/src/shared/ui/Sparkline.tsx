// Sparkline — mini gráfico inline (SVG puro, sem chart.js).
// Usado em KpiCards para dar tendência visual sem custo de espaço.
export default function Sparkline({
  serie = [],
  color = 'var(--accent)',
  width = 80,
  height = 22,
  fill = true,
}) {
  if (!serie || serie.length < 2) return <svg width={width} height={height} aria-hidden />
  const values = serie.map(s => (typeof s === 'number' ? s : s.value))
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const stepX = width / (values.length - 1)

  const points = values.map((v, i) => {
    const x = i * stepX
    const y = height - ((v - min) / span) * (height - 2) - 1
    return [x, y]
  })

  const pathLine = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const pathFill = `${pathLine} L${width},${height} L0,${height} Z`
  const last = points[points.length - 1]

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden>
      {fill && <path d={pathFill} fill={color} opacity="0.14" />}
      <path d={pathLine} fill="none" stroke={color} strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r="2" fill={color} />
    </svg>
  )
}
