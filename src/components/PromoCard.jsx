import { Sparkles, ArrowRight } from 'lucide-react'

export default function PromoCard({ onOpenChat, compact = false }) {
  return (
    <div
      className={
        'relative overflow-hidden rounded-card bg-accent-glossy text-white shadow-glossy ' +
        (compact ? 'p-4' : 'p-5')
      }
    >
      <div className="pointer-events-none absolute -right-10 -top-16 h-48 w-48 rounded-full bg-white/25 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-16 -left-10 h-40 w-40 rounded-full bg-black/10 blur-2xl" />
      <div className="pointer-events-none absolute right-6 top-6 h-16 w-16 rounded-full bg-white/30 blur-md" />

      <div className="relative z-10">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/25 backdrop-blur-sm">
          <Sparkles size={16} />
        </div>
        <h3 className={'mt-3 font-extrabold leading-tight tracking-tight ' + (compact ? 'text-[15px]' : 'text-[18px]')}>
          Assistant IA disponible 24/7
        </h3>
        <p className="mt-1.5 max-w-[220px] text-[12.5px] leading-snug text-white/85">
          Résumés de coffres, préparation de réunions et relances suggérées, en un message.
        </p>
        <button
          type="button"
          onClick={onOpenChat}
          className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-white px-3.5 py-2 text-[12.5px] font-bold text-accent-700 transition-transform active:scale-[0.97]"
        >
          Essayer maintenant
          <ArrowRight size={14} />
        </button>
      </div>
    </div>
  )
}
