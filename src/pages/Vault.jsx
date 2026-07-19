import { useParams, Link, Navigate } from 'react-router-dom'
import { Users, Calendar, Wallet, MapPin, Target } from 'lucide-react'
import Layout from '../components/Layout'
import StatCard from '../components/StatCard'
import RevenueChart from '../components/RevenueChart'
import ClientsTable from '../components/ClientsTable'
import CircularGauge from '../components/CircularGauge'
import PromoCard from '../components/PromoCard'
import { companies, getCompany, clientsForCompany, formatDH, formatCompactDH } from '../data/mockData'

export default function Vault() {
  const { vaultId } = useParams()
  const company = getCompany(vaultId)

  if (!company) {
    return <Navigate to={`/vault/${companies[0].id}`} replace />
  }

  const clients = clientsForCompany(company.id)

  return (
    <Layout title={company.name} subtitle={company.sector}>
      <div className="flex flex-wrap gap-2">
        {companies.map((c) => (
          <Link
            key={c.id}
            to={`/vault/${c.id}`}
            className={
              'flex items-center gap-2 rounded-lg border px-3 py-1.5 text-[12px] font-bold transition-colors ' +
              (c.id === company.id
                ? 'border-accent-500 bg-accent-500 text-white'
                : 'border-ink-200 bg-white text-ink-500 hover:border-accent-300 hover:text-accent-600')
            }
          >
            <span
              className="flex h-4 w-4 items-center justify-center rounded-full text-[8px] font-bold text-white"
              style={{ background: c.id === company.id ? 'rgba(255,255,255,0.3)' : c.color }}
            >
              {c.initials}
            </span>
            {c.name}
          </Link>
        ))}
      </div>

      <div className="card flex flex-wrap items-center gap-4 p-4">
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-[15px] font-extrabold text-white"
          style={{ background: company.color }}
        >
          {company.initials}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-[16px] font-extrabold leading-tight tracking-tight text-ink-900">{company.name}</h2>
          <p className="text-[12px] text-ink-500">{company.sector}</p>
        </div>
        <div className="flex items-center gap-1.5 rounded-lg border border-ink-200 px-3 py-1.5 text-[12px] font-semibold text-ink-500">
          <MapPin size={13} className="text-ink-400" />
          {company.city}
        </div>
      </div>

      <div className="mt-2 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <PromoCard compact onOpenChat={() => window.dispatchEvent(new Event('open-chat'))} />
        <StatCard
          label="Clients signés"
          value={company.stats.clientsSignes}
          trend={company.stats.clientsSignesTrend}
          icon={Users}
          sparkline={company.stats.clientsSpark}
        />
        <StatCard
          label="Réunions tenues"
          value={company.stats.reunionsTenues}
          trend={company.stats.reunionsTenuesTrend}
          trendLabel={`${company.stats.reunionsTenuesTrend >= 0 ? '+' : ''}${company.stats.reunionsTenuesTrend}`}
          icon={Calendar}
          sparkline={company.stats.reunionsSpark}
        />
        <StatCard
          label="Chiffre d'affaires"
          value={formatCompactDH(company.stats.chiffreAffaires)}
          trend={company.stats.chiffreAffairesTrend}
          icon={Wallet}
          sparkline={company.revenue.slice(-6).map((d) => d.value)}
        />
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3.5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RevenueChart
            title={`Croissance du CA \u00b7 ${company.name}`}
            data={company.revenue}
            trend={company.stats.chiffreAffairesTrend}
          />
        </div>
        <div className="card flex flex-col items-center justify-center gap-1 p-6">
          <div className="flex w-full items-center justify-between">
            <h3 className="text-[12.5px] font-extrabold uppercase tracking-wide text-ink-400">Objectif mensuel</h3>
            <Target size={14} className="text-accent-500" />
          </div>
          <CircularGauge
            pct={company.stats.objectifPct}
            label="Objectif atteint"
            sublabel={`${formatDH(company.stats.objectifActuel)} / ${formatDH(company.stats.objectifCible)}`}
          />
        </div>
      </div>

      <div className="mt-3">
        <ClientsTable
          clients={clients}
          title="Aperçu des clients"
          subtitle={`Clients de ${company.name}, triés par importance`}
        />
      </div>
    </Layout>
  )
}
