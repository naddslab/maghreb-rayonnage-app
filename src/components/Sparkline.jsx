export default function Sparkline({ data, positive = true, width = 100, height = 32, strokeWidth = 2, fill = true }) {
  if (!data || data.length < 2) return null

  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = Math.max(max - min, 1)
  const stepX = width / (data.length - 1)
  const pad = strokeWidth

  const points = data.map((v, i) => {
    const x = i * stepX
    const y = pad + (1 - (v - min) / range) * (height - pad * 2)
    return [x, y]
  })

  const linePath = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const areaPath = `${linePath} L${points[points.length - 1][0].toFixed(1)},${height} L0,${height} Z`

  const colorClass = positive ? '#16A34A' : '#E1503C'
  const gradientId = `spark-${positive ? 'up' : 'down'}-${Math.round(data[0])}-${Math.round(data[data.length - 1])}`

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible" preserveAspectRatio="none">
      {fill && (
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={colorClass} stopOpacity="0.18" />
            <stop offset="100%" stopColor={colorClass} stopOpacity="0" />
          </linearGradient>
        </defs>
      )}
      {fill && <path d={areaPath} fill={`url(#${gradientId})`} stroke="none" />}
      <path d={linePath} fill="none" stroke={colorClass} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={points[points.length - 1][0]} cy={points[points.length - 1][1]} r={strokeWidth + 0.5} fill={colorClass} />
    </svg>
  )
}
