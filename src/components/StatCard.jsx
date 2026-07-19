import { ArrowUpRight, ArrowDownRight } from 'lucide-react'
import Sparkline from './Sparkline'

export default function StatCard({ label, value, trend, trendLabel, icon: Icon, sparkline }) {
  const isPositive = trend >= 0
  const trendText = trendLabel ?? `${isPositive ? '+' : ''}${trend}%`

  return (
    <div className="card flex flex-col p-5 sm:p-6">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11.5px] font-bold uppercase tracking-wide text-ink-400">{label}</span>
        {Icon && (
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-ink-100 text-ink-500">
            <Icon size={14} strokeWidth={2.25} />
          </div>
        )}
      </div>

      <div className="mt-3 text-[46px] font-black leading-none tracking-tight text-ink-900 sm:text-[52px]">
        {value}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <span
          className={
            'badge shrink-0 ' + (isPositive ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-500')
          }
        >
          {isPositive ? <ArrowUpRight size={12} strokeWidth={2.5} /> : <ArrowDownRight size={12} strokeWidth={2.5} />}
          {trendText}
        </span>
        {sparkline && (
          <div className="min-w-0 flex-1">
            <Sparkline data={sparkline} positive={isPositive} width={110} height={30} />
          </div>
        )}
      </div>
    </div>
  )
}
