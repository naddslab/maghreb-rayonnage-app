import { Link } from 'react-router-dom'
import { Sparkles } from 'lucide-react'
import { currentUser } from '../data/mockData'

export default function TopBar({ title, subtitle, hideAssistantButton = false }) {
  return (
    <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-ink-200 bg-ink-50/90 px-4 py-3.5 backdrop-blur-lg sm:px-6 lg:px-7 lg:py-4">
      <div className="min-w-0">
        <h1 className="truncate text-[17px] font-extrabold leading-tight tracking-tight text-ink-900 sm:text-[19px]">{title}</h1>
        {subtitle && <p className="mt-0.5 truncate text-[11.5px] text-ink-400 sm:text-[12px]">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-2">
        {!hideAssistantButton && (
          <Link
            to="/assistant"
            className="hidden items-center gap-1.5 rounded-xl bg-ink-900 px-3.5 py-2 text-[12.5px] font-bold text-white transition-transform active:scale-[0.98] sm:flex"
          >
            <Sparkles size={13} className="text-accent-400" />
            Assistant IA
          </Link>
        )}

        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-100 text-[12px] font-bold text-accent-600 lg:hidden">
          {currentUser.initials}
        </div>
      </div>
    </header>
  )
}
