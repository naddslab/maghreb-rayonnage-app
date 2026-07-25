import { useMemo, useState } from 'react'
import { Users, Wallet, Star } from 'lucide-react'
import Layout from '../components/Layout'
import StatCard from '../components/StatCard'
import ClientsTable from '../components/ClientsTable'
import PromoCard from '../components/PromoCard'
import { allClientsSorted, companies, formatCompactDH, prochaineEtapeOptions } from '../data/mockData'

const FILTERS = ['Tous', ...prochaineEtapeOptions]

export default function ClientsOverview() {
  const [activeFilter, setActiveFilter] = useState('Tous')
  const allClients = allClientsSorted()

  const filteredClients = useMemo(() => {
    if (activeFilter === 'Tous') return allClients
    return allClients.filter((c) => c.prochaineEtape === activeFilter)
  }, [activeFilter, allClients])

  const totalValeur = allClients.reduce((sum, c) => sum + c.valeur, 0)
  const highImportance = allClients.filter((c) => c.importance === 'XXX').length

  const sumSpark = (key) =>
    companies[0].stats[key].map((_, i) => companies.reduce((sum, c) => sum + c.stats[key][i], 0))
  const revenueSpark = companies[0].revenue.map((_, i) =>
    companies.reduce((sum, c) => sum + c.revenue[i].value, 0)
  )

  return (
    <Layout title="Aperçu des clients" subtitle="Tous les coffres · Maghreb Rayonnage Group">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <PromoCard compact />
        <StatCard
          label="Clients au total"
          value={allClients.length}
          trend={9}
          icon={Users}
          sparkline={sumSpark('clientsSpark')}
        />
        <StatCard
          label="Valeur du portefeuille"
          value={formatCompactDH(totalValeur)}
          trend={6}
          icon={Wallet}
          sparkline={revenueSpark.slice(-6)}
        />
        <StatCard
          label="Comptes stratégiques (XXX)"
          value={highImportance}
          trend={4}
          icon={Star}
          sparkline={sumSpark('reunionsSpark')}
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {FILTERS.map((filter) => (
          <button
            key={filter}
            type="button"
            onClick={() => setActiveFilter(filter)}
            className={
              'rounded-lg border px-3 py-1.5 text-[12px] font-bold transition-colors ' +
              (activeFilter === filter
                ? 'border-accent-500 bg-accent-500 text-white'
                : 'border-ink-200 bg-white text-ink-500 hover:border-accent-300 hover:text-accent-600')
            }
          >
            {filter}
          </button>
        ))}
      </div>

      <div className="mt-1">
        <ClientsTable
          clients={filteredClients}
          showCompanyName
          title="Tous les clients"
          subtitle="Triés par importance, toutes entités confondues"
        />
      </div>
    </Layout>
  )
}
