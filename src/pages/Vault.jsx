import { useEffect, useMemo, useState } from 'react'
import { useParams, Link, Navigate } from 'react-router-dom'
import { Users, Calendar, Wallet, MapPin, Target, Star } from 'lucide-react'
import Layout from '../components/Layout'
import StatCard from '../components/StatCard'
import RevenueChart from '../components/RevenueChart'
import ClientsTable from '../components/ClientsTable'
import CircularGauge from '../components/CircularGauge'
import PromoCard from '../components/PromoCard'
import { companies, getCompany, formatDH, formatCompactDH } from '../data/mockData'
import {
  fetchAllClients,
  fetchMeetings,
  fetchVaultRevenueChart,
  fetchVaultMonthlyRevenue,
  fetchMonthlyGoal,
  getCurrentMoroccoMonth,
} from '../lib/clients'

// /api/vaults/:id/revenue/chart returns [{ month: 'YYYY-MM', label: 'Jan', revenue }, ...] —
// RevenueChart expects [{ month: <label to display>, value, isBest }].
function toRevenueChartSeries(apiData) {
  if (!Array.isArray(apiData) || apiData.length === 0) return []
  const values = apiData.map((d) => d.revenue)
  const bestIndex = values.indexOf(Math.max(...values))
  return apiData.map((d, i) => ({ month: d.label, value: d.revenue, isBest: i === bestIndex }))
}

// Derived as the month-over-month change between the two most recent months in the chart, same
// as on the main Dashboard — the API itself doesn't return a single "trend" figure.
function computeMonthOverMonthTrend(apiData) {
  if (!Array.isArray(apiData) || apiData.length < 2) return 0
  const current = apiData[apiData.length - 1].revenue
  const previous = apiData[apiData.length - 2].revenue
  if (previous === 0) return current > 0 ? 100 : 0
  return Math.round(((current - previous) / Math.abs(previous)) * 100)
}

const importanceOrder = { XXX: 3, XX: 2, X: 1 }

// A client counts as "signé" once their next step reads like a closed deal (contrat signé,
// signature reçue, etc.) — the API doesn't track a separate status field.
function isSignedClient(client) {
  return typeof client.nextStep === 'string' && /sign/i.test(client.nextStep)
}

// The clients API returns { id, name, company, contact, email, phone, location, nextStep, value,
// importance, vaultId, ... } — map that onto the field names ClientsTable expects.
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
  }
}

export default function Vault() {
  const { vaultId } = useParams()
  const company = getCompany(vaultId)

  const [clients, setClients] = useState([])
  const [reunionsTenues, setReunionsTenues] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [revenueChart, setRevenueChart] = useState([])
  const [monthlyTarget, setMonthlyTarget] = useState(0)
  const [monthlyActual, setMonthlyActual] = useState(0)
  const [statsError, setStatsError] = useState('')

  const currentMonth = useMemo(() => getCurrentMoroccoMonth(), [])

  useEffect(() => {
    if (!company) return
    let cancelled = false

    async function load() {
      setLoading(true)
      setError('')
      try {
        const allClients = await fetchAllClients()
        if (cancelled) return
        const vaultClients = allClients.filter((c) => c.vaultId === company.id)
        setClients(vaultClients)

        const meetingsByClient = await Promise.all(vaultClients.map((c) => fetchMeetings(c.id).catch(() => [])))
        if (cancelled) return
        const now = new Date()
        const held = meetingsByClient
          .flat()
          .filter((m) => m.meetingDate && new Date(m.meetingDate) <= now).length
        setReunionsTenues(held)
      } catch (err) {
        if (!cancelled) setError(err.message || 'Impossible de charger les clients de ce coffre.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    // The monthly goal (monthly_goals table) is shared across the whole group, not per vault —
    // there's no per-vault target yet, so every vault page shows the same company-wide objective
    // alongside its own vault-scoped revenue chart/actual.
    async function loadStats() {
      setStatsError('')
      try {
        const [chart, goal, actual] = await Promise.all([
          fetchVaultRevenueChart(company.id, 12),
          fetchMonthlyGoal(currentMonth),
          fetchVaultMonthlyRevenue(company.id, currentMonth),
        ])
        if (cancelled) return
        setRevenueChart(chart)
        setMonthlyTarget(goal?.targetValue || 0)
        setMonthlyActual(actual?.revenue || 0)
      } catch (err) {
        if (!cancelled) {
          setStatsError(err.message || "Impossible de charger le chiffre d'affaires et l'objectif du mois.")
        }
      }
    }

    load()
    loadStats()
    return () => {
      cancelled = true
    }
  }, [company, currentMonth])

  const rows = useMemo(
    () =>
      clients
        .map(mapClientToRow)
        .sort((a, b) => importanceOrder[b.importance] - importanceOrder[a.importance] || b.valeur - a.valeur),
    [clients]
  )

  if (!company) {
    return <Navigate to={`/vault/${companies[0].id}`} replace />
  }

  const clientsSignes = clients.filter(isSignedClient).length
  const chiffreAffaires = clients.reduce((sum, c) => sum + (c.value || 0), 0)
  const comptesStrategiques = clients.filter((c) => c.importance === 'XXX').length

  const chartSeries = useMemo(() => toRevenueChartSeries(revenueChart), [revenueChart])
  const chartTrend = useMemo(() => computeMonthOverMonthTrend(revenueChart), [revenueChart])
  const objectifPct = monthlyTarget > 0 ? Math.min(100, Math.round((monthlyActual / monthlyTarget) * 100)) : 0

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

      {loading ? (
        <div className="card p-8 text-center text-[13px] font-semibold text-ink-400">Chargement des clients…</div>
      ) : error ? (
        <div className="card p-8 text-center text-[13px] font-semibold text-rose-500">{error}</div>
      ) : (
        <>
          <div className="mt-2 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <PromoCard compact />
            <StatCard label="Clients signés" value={clientsSignes} trend={0} trendLabel="—" icon={Users} />
            <StatCard label="Réunions tenues" value={reunionsTenues} trend={0} trendLabel="—" icon={Calendar} />
            <StatCard label="Chiffre d'affaires" value={formatCompactDH(chiffreAffaires)} trend={0} trendLabel="—" icon={Wallet} />
          </div>

          <div className="mt-3 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Comptes stratégiques (XXX)"
              value={comptesStrategiques}
              trend={0}
              trendLabel="—"
              icon={Star}
            />
          </div>

          {statsError && (
            <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-[12.5px] font-semibold text-rose-600">
              {statsError}
            </div>
          )}

          <div className="mt-3 grid grid-cols-1 gap-3.5 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <RevenueChart
                title={`Croissance du CA \u00b7 ${company.name}`}
                data={chartSeries}
                trend={chartTrend}
              />
            </div>
            <div className="card flex flex-col items-center justify-center gap-1 p-6">
              <div className="flex w-full items-center justify-between">
                <h3 className="text-[12.5px] font-extrabold uppercase tracking-wide text-ink-400">Objectif mensuel</h3>
                <Target size={14} className="text-accent-500" />
              </div>
              <CircularGauge
                pct={objectifPct}
                label="Objectif atteint"
                sublabel={`${formatDH(monthlyActual)} / ${formatDH(monthlyTarget)}`}
              />
            </div>
          </div>

          <div className="mt-3">
            <ClientsTable
              clients={rows}
              title="Aperçu des clients"
              subtitle={`Clients de ${company.name}, triés par importance`}
            />
          </div>
        </>
      )}
    </Layout>
  )
}
