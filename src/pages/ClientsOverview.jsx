import { useEffect, useMemo, useState } from 'react'
import { Users, Wallet, Star } from 'lucide-react'
import Layout from '../components/Layout'
import StatCard from '../components/StatCard'
import ClientsTable from '../components/ClientsTable'
import PromoCard from '../components/PromoCard'
import { formatCompactDH, prochaineEtapeOptions } from '../data/mockData'
import { fetchAllClients } from '../lib/clients'

const FILTERS = ['Tous', ...prochaineEtapeOptions]

const importanceOrder = { XXX: 3, XX: 2, X: 1 }

// The clients API returns { id, name, company, contact, email, phone, location, nextStep, value,
// importance, ... } — map that onto the field names ClientsTable/EtapeBadge/ImportanceTag expect.
function mapClientToRow(c) {
  return {
    id: c.id,
    nomEntreprise: c.company || '—',
    nomClient: c.name,
    poste: c.contact || '',
    email: c.email || '—',
    telephone: c.phone || '—',
    localisation: c.location || '—',
    prochaineEtape: c.nextStep || 'À qualifier',
    valeur: c.value || 0,
    importance: c.importance || 'X',
    companyId: c.vaultId,
  }
}

export default function ClientsOverview() {
  const [activeFilter, setActiveFilter] = useState('Tous')
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    fetchAllClients()
      .then((data) => {
        if (cancelled) return
        setClients(data)
      })
      .catch((err) => {
        if (cancelled) return
        setError(err.message || 'Impossible de charger les clients.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const allClients = useMemo(() => {
    return clients
      .map(mapClientToRow)
      .sort((a, b) => importanceOrder[b.importance] - importanceOrder[a.importance] || b.valeur - a.valeur)
  }, [clients])

  const filteredClients = useMemo(() => {
    if (activeFilter === 'Tous') return allClients
    return allClients.filter((c) => c.prochaineEtape === activeFilter)
  }, [activeFilter, allClients])

  const totalValeur = allClients.reduce((sum, c) => sum + c.valeur, 0)
  const highImportance = allClients.filter((c) => c.importance === 'XXX').length

  return (
    <Layout title="Aperçu des clients" subtitle="Tous les coffres · Maghreb Rayonnage Group">
      {loading ? (
        <div className="card p-8 text-center text-[13px] font-semibold text-ink-400">Chargement des clients…</div>
      ) : error ? (
        <div className="card p-8 text-center text-[13px] font-semibold text-rose-500">{error}</div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <PromoCard compact />
            <StatCard label="Clients au total" value={allClients.length} trend={0} trendLabel="—" icon={Users} />
            <StatCard
              label="Valeur du portefeuille"
              value={formatCompactDH(totalValeur)}
              trend={0}
              trendLabel="—"
              icon={Wallet}
            />
            <StatCard
              label="Comptes stratégiques (XXX)"
              value={highImportance}
              trend={0}
              trendLabel="—"
              icon={Star}
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
        </>
      )}
    </Layout>
  )
}
