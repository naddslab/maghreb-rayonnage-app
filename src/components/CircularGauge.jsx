export default function CircularGauge({ pct, size = 184, strokeWidth = 14, label, sublabel }) {
  const clamped = Math.max(0, Math.min(100, pct))
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - clamped / 100)
  const gradientId = 'gauge-gradient'

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#F0954A" />
              <stop offset="100%" stopColor="#CC6B1A" />
            </linearGradient>
          </defs>
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#EEEEEA" strokeWidth={strokeWidth} />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 0.6s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[40px] font-black leading-none tracking-tight text-ink-900">{clamped}%</span>
        </div>
      </div>
      {label && <p className="mt-3 text-[13.5px] font-bold text-ink-800">{label}</p>}
      {sublabel && <p className="text-[11.5px] font-semibold text-ink-400">{sublabel}</p>}
    </div>
  )
}
