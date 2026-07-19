import { useState } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { LayoutDashboard, Users, Building2, Settings, Bot, X } from 'lucide-react'
import { companies } from '../data/mockData'

function TabLink({ to, icon: Icon, label, end }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        'flex flex-1 flex-col items-center gap-1 rounded-2xl py-1.5 text-[11px] font-medium transition-colors ' +
        (isActive ? 'text-accent-500' : 'text-ink-400')
      }
    >
      {({ isActive }) => (
        <>
          <span
            className={
              'flex h-8 w-8 items-center justify-center rounded-xl transition-colors ' +
              (isActive ? 'bg-accent-50' : '')
            }
          >
            <Icon size={19} strokeWidth={isActive ? 2.4 : 2} />
          </span>
          {label}
        </>
      )}
    </NavLink>
  )
}

export default function MobileNav() {
  const [vaultSheetOpen, setVaultSheetOpen] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const isVaultActive = location.pathname.startsWith('/vault')

  return (
    <>
      {vaultSheetOpen && (
        <div
          className="fixed inset-0 z-40 bg-ink-900/30 backdrop-blur-sm lg:hidden"
          onClick={() => setVaultSheetOpen(false)}
        >
          <div
            className="absolute bottom-0 left-0 right-0 rounded-t-2xl border-t border-ink-200 bg-white p-4 pb-8 shadow-softLg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-ink-200" />
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-[14px] font-extrabold text-ink-900">Vos coffres</h3>
              <button
                type="button"
                onClick={() => setVaultSheetOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-ink-100 text-ink-500"
              >
                <X size={16} />
              </button>
            </div>
            <div className="flex flex-col gap-2">
              {companies.map((company) => (
                <button
                  key={company.id}
                  type="button"
                  onClick={() => {
                    setVaultSheetOpen(false)
                    navigate(`/vault/${company.id}`)
                  }}
                  className="flex items-center gap-3 rounded-xl border border-ink-200 bg-white p-3 text-left active:scale-[0.98]"
                >
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[12px] font-bold text-white"
                    style={{ background: company.color }}
                  >
                    {company.initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-bold text-ink-800">{company.name}</p>
                    <p className="truncate text-[11px] text-ink-400">{company.sector}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <nav className="fixed bottom-0 left-0 right-0 z-30 flex items-center gap-1 border-t border-ink-200 bg-white/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-lg lg:hidden">
        <TabLink to="/dashboard" icon={LayoutDashboard} label="Accueil" end />
        <TabLink to="/clients" icon={Users} label="Clients" />
        <TabLink to="/assistant" icon={Bot} label="Assistant" />
        <button
          type="button"
          onClick={() => setVaultSheetOpen(true)}
          className={
            'flex flex-1 flex-col items-center gap-1 rounded-2xl py-1.5 text-[11px] font-medium transition-colors ' +
            (isVaultActive ? 'text-accent-500' : 'text-ink-400')
          }
        >
          <span className={'flex h-8 w-8 items-center justify-center rounded-xl ' + (isVaultActive ? 'bg-accent-50' : '')}>
            <Building2 size={19} strokeWidth={isVaultActive ? 2.4 : 2} />
          </span>
          Coffres
        </button>
        <TabLink to="/settings" icon={Settings} label="Réglages" />
      </nav>
    </>
  )
}
