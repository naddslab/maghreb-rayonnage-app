import { Phone, MapPin, Mail, Building2, User, Target, Wallet, Flame } from 'lucide-react'
import { prochaineEtapeStyles, formatDH, getCompany } from '../data/mockData'
import Sparkline from './Sparkline'

const importanceStyle = {
  XXX: 'text-[14px] font-black text-ink-900',
  XX: 'text-[13px] font-bold text-ink-600',
  X: 'text-[12px] font-semibold text-ink-400',
}

function ImportanceTag({ level }) {
  return <span className={`${importanceStyle[level]} tracking-wide`}>{level}</span>
}

function EtapeBadge({ etape }) {
  return <span className={`badge whitespace-nowrap ${prochaineEtapeStyles[etape] ?? 'bg-ink-100 text-ink-500'}`}>{etape}</span>
}

function Th({ icon: Icon, align = 'left', children }) {
  return (
    <th className={`px-3 py-2.5 first:px-4 last:px-4 ${align === 'right' ? 'text-right' : 'text-left'}`}>
      <span className={`flex items-center gap-1.5 ${align === 'right' ? 'justify-end' : ''}`}>
        {Icon && <Icon size={12} strokeWidth={2.5} className="text-ink-400" />}
        {children}
      </span>
    </th>
  )
}

export default function ClientsTable({ clients, showCompanyName = false, title = 'Aperçu des clients', subtitle }) {
  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-200 p-4">
        <div>
          <h3 className="text-[13.5px] font-bold text-ink-800">{title}</h3>
          {subtitle && <p className="mt-0.5 text-[11.5px] text-ink-400">{subtitle}</p>}
        </div>
        <span className="badge bg-ink-100 text-ink-500">{clients.length} clients</span>
      </div>

      {/* Desktop / tablet table */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[1020px] border-collapse text-left">
          <thead>
            <tr className="border-b border-ink-200 bg-ink-50 text-[10.5px] font-extrabold uppercase tracking-wide text-ink-500">
              <Th icon={Building2}>Nom de l'entreprise</Th>
              <Th icon={User}>Nom du client</Th>
              <Th icon={Mail}>Email</Th>
              <Th icon={Phone}>Téléphone</Th>
              <Th icon={MapPin}>Localisation</Th>
              <Th icon={Target}>P. Étape</Th>
              <Th icon={Wallet}>Valeur</Th>
              <Th icon={Flame} align="right">Importance</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {clients.map((c) => (
              <tr key={c.id} className="text-[12px] text-ink-700 transition-colors hover:bg-ink-50/70">
                <td className="px-4 py-2 font-bold text-ink-800">
                  {c.nomEntreprise}
                  {showCompanyName && (
                    <div className="mt-0.5 text-[10.5px] font-medium text-ink-400">
                      via {getCompany(c.companyId)?.name || 'coffre non assigné'}
                    </div>
                  )}
                </td>
                <td className="px-3 py-2">
                  <div className="font-semibold text-ink-800">{c.nomClient}</div>
                  <div className="text-[10.5px] text-ink-400">{c.poste}</div>
                </td>
                <td className="px-3 py-2 text-ink-500">
                  <span className="flex items-center gap-1.5">
                    <Mail size={11.5} className="shrink-0 text-ink-300" />
                    <span className="truncate">{c.email}</span>
                  </span>
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-ink-500">{c.telephone}</td>
                <td className="px-3 py-2 text-ink-500">{c.localisation}</td>
                <td className="px-3 py-2">
                  <EtapeBadge etape={c.prochaineEtape} />
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-ink-800 whitespace-nowrap">{formatDH(c.valeur)}</span>
                    {c.sparkline && <Sparkline data={c.sparkline} positive={c.trendUp} width={52} height={20} strokeWidth={1.5} />}
                  </div>
                </td>
                <td className="px-4 py-2 text-right">
                  <ImportanceTag level={c.importance} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile card list */}
      <div className="flex flex-col gap-2.5 p-3 md:hidden">
        {clients.map((c) => (
          <div key={c.id} className="rounded-xl border border-ink-200 p-3">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[13px] font-extrabold text-ink-800">{c.nomEntreprise}</p>
                <p className="text-[12px] font-semibold text-ink-600">{c.nomClient}</p>
                <p className="text-[10.5px] text-ink-400">{c.poste}</p>
                {showCompanyName && (
                  <p className="mt-0.5 text-[10.5px] text-ink-400">via {getCompany(c.companyId)?.name || 'coffre non assigné'}</p>
                )}
              </div>
              <ImportanceTag level={c.importance} />
            </div>

            <div className="mt-2.5 flex flex-col gap-1 text-[11.5px] text-ink-500">
              <span className="flex items-center gap-1.5">
                <Mail size={12} className="shrink-0 text-ink-300" />
                <span className="truncate">{c.email}</span>
              </span>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <span className="flex items-center gap-1.5">
                  <Phone size={12} className="text-ink-300" />
                  {c.telephone}
                </span>
                <span className="flex items-center gap-1.5">
                  <MapPin size={12} className="text-ink-300" />
                  {c.localisation}
                </span>
              </div>
            </div>

            <div className="mt-2.5 flex items-center justify-between">
              <EtapeBadge etape={c.prochaineEtape} />
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-extrabold text-ink-800">{formatDH(c.valeur)}</span>
                {c.sparkline && <Sparkline data={c.sparkline} positive={c.trendUp} width={44} height={18} strokeWidth={1.5} />}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
