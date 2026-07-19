import { useState } from 'react'
import { TrendingUp, TrendingDown, Sparkles } from 'lucide-react'
import { formatDH } from '../data/mockData'

export default function RevenueChart({ title = 'Croissance du CA', data, trend }) {
  const [activeIndex, setActiveIndex] = useState(null)

  const max = Math.max(...data.map((d) => d.value))
  const min = Math.min(...data.map((d) => d.value))
  const bestIndex = data.findIndex((d) => d.isBest)
  const total = data.reduce((sum, d) => sum + d.value, 0)
  const isPositiveTrend = trend >= 0

  return (
    <div className="card p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-[13.5px] font-extrabold uppercase tracking-wide text-ink-400">{title}</h3>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-[30px] font-black leading-none tracking-tight text-ink-900">{formatDH(total)}</span>
            <span
              className={
                'badge ' + (isPositiveTrend ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-500')
              }
            >
              {isPositiveTrend ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {isPositiveTrend ? '+' : ''}
              {trend}%
            </span>
          </div>
          <p className="mt-0.5 text-[11.5px] text-ink-400">Sur les 12 derniers mois</p>
        </div>

        <div className="flex gap-0.5 rounded-lg bg-ink-100 p-1">
          {['12M', '6M', '3M'].map((label, i) => (
            <button
              key={label}
              className={
                'rounded-md px-2.5 py-1 text-[11px] font-bold transition-colors ' +
                (i === 0 ? 'bg-white text-ink-800 shadow-xs' : 'text-ink-400 hover:text-ink-600')
              }
              type="button"
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="relative mt-7 flex h-[180px] items-end gap-1.5 sm:h-[210px] sm:gap-2.5">
        {data.map((d, i) => {
          const heightPct = 12 + ((d.value - min) / Math.max(max - min, 1)) * 80
          const prevValue = i === 0 ? d.value : data[i - 1].value
          const isUp = d.value >= prevValue
          const isActive = activeIndex === i
          const isBest = i === bestIndex

          return (
            <div
              key={d.month}
              className="group relative flex h-full flex-1 flex-col items-center justify-end"
              onMouseEnter={() => setActiveIndex(i)}
              onMouseLeave={() => setActiveIndex(null)}
            >
              {isBest && (
                <div className="pointer-events-none absolute -top-2 left-1/2 z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap">
                  <div className="flex items-center gap-1 rounded-md bg-ink-900 px-2 py-1 text-[10px] font-bold text-white shadow-lg">
                    <Sparkles size={10} className="text-accent-300" />
                    Meilleur mois
                  </div>
                  <div className="mt-0.5 text-center text-[11px] font-bold text-ink-800">{formatDH(d.value)}</div>
                  <div className="mx-auto mt-0.5 h-1.5 w-1.5 rotate-45 bg-ink-900" />
                </div>
              )}

              {isActive && !isBest && (
                <div className="pointer-events-none absolute -top-1 left-1/2 z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md bg-ink-800 px-2 py-1 text-[10.5px] font-bold text-white shadow-lg">
                  {formatDH(d.value)}
                </div>
              )}

              <div
                className={
                  'w-full rounded-t-[3px] transition-all duration-200 ' +
                  (isBest
                    ? 'bg-accent-gradient'
                    : isUp
                      ? 'bg-ink-300 group-hover:bg-ink-500'
                      : 'bg-rose-200 group-hover:bg-rose-300')
                }
                style={{ height: `${heightPct}%` }}
              />

              <span className="mt-2 text-[10.5px] font-semibold text-ink-400">{d.month}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
