import { useEffect, useRef, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Users, Building2, Settings, LogOut, ChevronRight, Bot } from 'lucide-react'
import { companies, currentUser } from '../data/mockData'

function IconLink({ to, icon: Icon, label, end }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        'group relative flex h-11 w-11 items-center justify-center rounded-xl transition-colors duration-150 ' +
        (isActive ? 'bg-accent-50 text-accent-600' : 'text-ink-400 hover:bg-ink-100 hover:text-ink-700')
      }
    >
      <Icon size={19} strokeWidth={2.1} />
      <Tooltip>{label}</Tooltip>
    </NavLink>
  )
}

function Tooltip({ children }) {
  return (
    <span className="pointer-events-none absolute left-full top-1/2 z-40 ml-3 -translate-y-1/2 whitespace-nowrap rounded-md bg-ink-900 px-2.5 py-1.5 text-[11.5px] font-semibold text-white opacity-0 shadow-softLg transition-opacity duration-100 group-hover:opacity-100">
      {children}
    </span>
  )
}

export default function Sidebar() {
  const [vaultsOpen, setVaultsOpen] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const flyoutRef = useRef(null)
  const isVaultActive = location.pathname.startsWith('/vault')

  useEffect(() => {
    setVaultsOpen(false)
  }, [location.pathname])

  useEffect(() => {
    function handleOutside(e) {
      if (flyoutRef.current && !flyoutRef.current.contains(e.target)) {
        setVaultsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [])

  return (
    <aside className="hidden h-screen w-[72px] flex-col items-center border-r border-ink-200 bg-white py-5 lg:flex">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-500 text-[13px] font-extrabold text-white">
        MR
      </div>

      <nav className="mt-8 flex flex-1 flex-col items-center gap-2">
        <IconLink to="/dashboard" icon={LayoutDashboard} label="Dashboard" end />
        <IconLink to="/clients" icon={Users} label="Aperçu des clients" />
        <IconLink to="/assistant" icon={Bot} label="Assistant IA" />

        <div ref={flyoutRef} className="relative">
          <button
            type="button"
            onClick={() => setVaultsOpen((v) => !v)}
            className={
              'group relative flex h-11 w-11 items-center justify-center rounded-xl transition-colors duration-150 ' +
              (isVaultActive || vaultsOpen
                ? 'bg-accent-50 text-accent-600'
                : 'text-ink-400 hover:bg-ink-100 hover:text-ink-700')
            }
          >
            <Building2 size={19} strokeWidth={2.1} />
            {!vaultsOpen && <Tooltip>Coffres</Tooltip>}
          </button>

          {vaultsOpen && (
            <div className="absolute left-full top-0 z-40 ml-3 w-56 rounded-xl border border-ink-200 bg-white p-1.5 shadow-softLg">
              <p className="px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wider text-ink-400">Coffres</p>
              {companies.map((company) => (
                <NavLink
                  key={company.id}
                  to={`/vault/${company.id}`}
                  onClick={() => setVaultsOpen(false)}
                  className={({ isActive }) =>
                    'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-semibold transition-colors ' +
                    (isActive ? 'bg-accent-50 text-accent-600' : 'text-ink-600 hover:bg-ink-100')
                  }
                >
                  <span
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[10px] font-bold text-white"
                    style={{ background: company.color }}
                  >
                    {company.initials}
                  </span>
                  <span className="truncate">{company.name}</span>
                  <ChevronRight size={13} className="ml-auto shrink-0 text-ink-300" />
                </NavLink>
              ))}
            </div>
          )}
        </div>

        <IconLink to="/settings" icon={Settings} label="Réglages" />
      </nav>

      <div className="group relative flex flex-col items-center gap-2">
        <button
          type="button"
          onClick={() => navigate('/login')}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-100 text-[12px] font-bold text-accent-600 transition-transform hover:scale-105"
        >
          {currentUser.initials}
        </button>
        <span className="pointer-events-none absolute bottom-0 left-full z-40 ml-3 whitespace-nowrap rounded-md bg-ink-900 px-2.5 py-1.5 text-[11.5px] font-semibold text-white opacity-0 shadow-softLg transition-opacity duration-100 group-hover:opacity-100">
          <span className="flex items-center gap-1.5">
            {currentUser.name}
            <LogOut size={12} />
          </span>
        </span>
      </div>
    </aside>
  )
}
