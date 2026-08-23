import { useState } from 'react'
import { TrendingUp, TrendingDown, Sparkles } from 'lucide-react'
import { formatDH } from '../data/mockData'

const RANGE_MONTHS = [12, 6, 3]
const RANGE_LABELS = ['12M', '6M', '3M']

export default function RevenueChart({ title = 'Croissance du CA', data, trend }) {
  const [activeIndex, setActiveIndex] = useState(null)
  const [rangeIdx, setRangeIdx] = useState(0)

  const visibleData = data.slice(-RANGE_MONTHS[rangeIdx])
  const max = Math.max(...visibleData.map((d) => d.value), 0)
  const min = Math.min(...visibleData.map((d) => d.value), 0)
  const bestIndex = visibleData.findIndex((d) => d.isBest)
  const total = visibleData.reduce((sum, d) => sum + d.value, 0)

  // Use the parent-supplied trend for 12M (already accurately computed server-side).
  // For shorter ranges, derive from the visible slice by comparing the two halves.
  let displayTrend = trend
  if (rangeIdx > 0 && visibleData.length > 1) {
    const half = Math.floor(visibleData.length / 2)
    const firstHalf = visibleData.slice(0, half).reduce((s, d) => s + d.value, 0)
    const secondHalf = visibleData.slice(half).reduce((s, d) => s + d.value, 0)
    displayTrend = firstHalf === 0 ? 0 : Math.round(((secondHalf - firstHalf) / firstHalf) * 100)
  }
  const isPositiveTrend = displayTrend >= 0

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
              {displayTrend}%
            </span>
          </div>
          <p className="mt-0.5 text-[11.5px] text-ink-400">Sur les {RANGE_MONTHS[rangeIdx]} derniers mois</p>
        </div>

        <div className="flex gap-0.5 rounded-lg bg-ink-100 p-1">
          {RANGE_LABELS.map((label, i) => (
            <button
              key={label}
              className={
                'rounded-md px-2.5 py-1 text-[11px] font-bold transition-colors ' +
                (i === rangeIdx ? 'bg-white text-ink-800 shadow-xs' : 'text-ink-400 hover:text-ink-600')
              }
              type="button"
              onClick={() => {
                setRangeIdx(i)
                setActiveIndex(null)
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="relative mt-7 flex h-[180px] items-end gap-1.5 sm:h-[210px] sm:gap-2.5">
        {visibleData.map((d, i) => {
          const heightPct = 12 + ((d.value - min) / Math.max(max - min, 1)) * 80
          const prevValue = i === 0 ? d.value : visibleData[i - 1].value
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
