import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Users, Calendar, Wallet, ChevronRight, ArrowUpRight, ArrowDownRight, Clock, Target, Star } from 'lucide-react'
import Layout from '../components/Layout'
import StatCard from '../components/StatCard'
import RevenueChart from '../components/RevenueChart'
import CircularGauge from '../components/CircularGauge'
import PromoCard from '../components/PromoCard'
import { companies, formatCompactDH, formatDH } from '../data/mockData'
import {
  fetchAllClients,
  fetchAllMeetings,
  fetchAllActivities,
  fetchRevenueChart,
  fetchMonthlyRevenue,
  fetchMonthlyGoal,
  getCurrentMoroccoMonth,
  fetchVaultRevenueChart,
} from '../lib/clients'

// A client counts as "signé" only when next_step confirms the deal is CLOSED.
// The old /sign/i was too broad: "à signer", "envoyer pour signature" also contain "sign"
// but mean the deal is still pending. The refined logic:
//   1. Explicitly rejects infinitive contexts (à signer, pour signer, faire signer).
//   2. Matches the French past participle "signé"/"signée" via sign[eé]e? but NOT the
//      infinitive "signer" (ends in 'r') — the negative lookahead (?!r) handles both the
//      accented form (é) and the unaccented fallback (e) without over-matching.
function isSignedClient(client) {
  if (typeof client.nextStep !== 'string') return false
  const s = client.nextStep.toLowerCase()
  if (/\bà signer\b/.test(s) || /\bpour signer\b/.test(s) || /\bfaire signer\b/.test(s)) return false
  return /sign[eé]e?(?!r)/.test(s)
}

function formatMeetingDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function formatActivityTime(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

// Maps an activity_type to a colored-dot category.
// Primary path: exact match against the controlled enum emitted by the extraction prompt.
// Fallback regex: handles old free-form values already in the database so historical rows
// still render correctly even after the prompt was tightened.
function activityDotType(activityType) {
  switch (activityType) {
    case 'contrat_signé':
    case 'contract_signed':
    case 'paiement_reçu':
    case 'devis_accepté':
      return 'up'
    case 'devis_refusé':
    case 'deal_perdu':
    case 'contrat_annulé':
      return 'down'
    case 'devis_envoyé':
    case 'relance':
    case 'nouveau_lead':
    case 'réunion_tenue':
    case 'autre':
      return 'neutral'
    default: {
      const t = (activityType || '').toLowerCase()
      if (/(signature|signé|gagné|paiement|payé)/.test(t)) return 'up'
      if (/(refus|perdu|annulé|résilié)/.test(t)) return 'down'
      return 'neutral'
    }
  }
}

// /api/revenue/chart returns [{ month: 'YYYY-MM', label: 'Jan', revenue }, ...] — RevenueChart
// expects [{ month: <label to display>, value, isBest }], with isBest marking the highest month.
function toRevenueChartSeries(apiData) {
  if (!Array.isArray(apiData) || apiData.length === 0) return []
  const values = apiData.map((d) => d.revenue)
  const bestIndex = values.indexOf(Math.max(...values))
  return apiData.map((d, i) => ({ month: d.label, value: d.revenue, isBest: i === bestIndex }))
}

// No single "trend" figure comes back from the API, so it's derived here as the month-over-month
// change between the two most recent months in the chart — consistent with what the badge next
// to the chart is meant to convey ("is this month up or down from last month").
function computeMonthOverMonthTrend(apiData) {
  if (!Array.isArray(apiData) || apiData.length < 2) return 0
  const current = apiData[apiData.length - 1].revenue
  const previous = apiData[apiData.length - 2].revenue
  if (previous === 0) return current > 0 ? 100 : 0
  return Math.round(((current - previous) / Math.abs(previous)) * 100)
}

export default function Dashboard() {
  const [clients, setClients] = useState([])
  const [meetings, setMeetings] = useState([])
  const [activities, setActivities] = useState([])
  const [revenueChart, setRevenueChart] = useState([])
  const [monthlyTarget, setMonthlyTarget] = useState(0)
  const [monthlyActual, setMonthlyActual] = useState(0)
  const [vaultStats, setVaultStats] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [statsError, setStatsError] = useState('')
  const [today, setToday] = useState(() =>
    new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
  )

  // Refresh the displayed date at the next midnight so the subtitle never shows yesterday's date
  // when the tab is left open overnight.
  useEffect(() => {
    const d = new Date()
    const msUntilMidnight = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1) - d
    const t = setTimeout(
      () => setToday(new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })),
      msUntilMidnight
    )
    return () => clearTimeout(t)
  }, [today])

  const currentMonth = useMemo(() => getCurrentMoroccoMonth(), [])

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const [fetchedClients, allMeetings, allActivities] = await Promise.all([
          fetchAllClients(),
          fetchAllMeetings(),
          fetchAllActivities(),
        ])
        if (cancelled) return
        setClients(fetchedClients)
        setMeetings(allMeetings)
        setActivities(allActivities)
      } catch (err) {
        if (!cancelled) setError(err.message || 'Impossible de charger les données du tableau de bord.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    // Kept independent from the clients/meetings/activities load above: a failure here (or there)
    async function loadStats() {
      try {
        const [chart, goal, actual] = await Promise.all([
          fetchRevenueChart(12),
          fetchMonthlyGoal(currentMonth),
          fetchMonthlyRevenue(currentMonth),
        ])
        if (cancelled) return
        setRevenueChart(chart)
        setMonthlyTarget(goal?.targetValue || 0)
        setMonthlyActual(actual?.revenue || 0)
    
        const vaultIds = companies.map((c) => c.id)
        const vaultCharts = await Promise.all(vaultIds.map((id) => fetchVaultRevenueChart(id, 2).catch(() => [])))
        if (cancelled) return
        const stats = {}
        vaultIds.forEach((id, i) => {
          const vc = vaultCharts[i]
          stats[id] = {
            revenue: vc.length > 0 ? vc[vc.length - 1].revenue : 0,
            trend: computeMonthOverMonthTrend(vc),
          }
        })
        setVaultStats(stats)
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
  }, [currentMonth])

  // Lower-priority: `now` is used only for past/future meeting comparisons, not displayed text.
  // It is intentionally pinned to component-mount time so the meeting lists don't re-sort during
  // a session. A midnight-crossing refresh is not needed here.
  const now = useMemo(() => new Date(), [])

  const clientsSignes = clients.filter(isSignedClient).length
  const chiffreAffaires = clients.reduce((sum, c) => sum + (c.value || 0), 0)
  const comptesStrategiques = clients.filter((c) => c.importance === 'XXX').length

  const reunionsTenues = meetings.filter((m) => m.meetingDate && new Date(m.meetingDate) <= now).length

  const upcomingMeetings = useMemo(
    () =>
      meetings
        .filter((m) => m.meetingDate && new Date(m.meetingDate) > now)
        .sort((a, b) => new Date(a.meetingDate) - new Date(b.meetingDate))
        .slice(0, 5),
    [meetings, now]
  )

  const recentActivity = useMemo(
    () =>
      activities
        .slice()
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 6),
    [activities]
  )

  const chartSeries = useMemo(() => toRevenueChartSeries(revenueChart), [revenueChart])
  const chartTrend = useMemo(() => computeMonthOverMonthTrend(revenueChart), [revenueChart])
  const objectifPct = monthlyTarget > 0 ? Math.min(100, Math.round((monthlyActual / monthlyTarget) * 100)) : 0

  return (
    <Layout
      title="Tableau de bord"
      subtitle={`Vue d\u2019ensemble de tous vos coffres \u00b7 ${today}`}
    >
      <div>
        <h2 className="text-[19px] font-extrabold leading-tight tracking-tight text-ink-900 sm:text-[21px]">Bonjour, Rachid 👋</h2>
        <p className="mt-0.5 text-[13px] text-ink-500">
          Voici un résumé de votre activité commerciale sur l’ensemble du groupe.
        </p>
      </div>

      {loading ? (
        <div className="card p-8 text-center text-[13px] font-semibold text-ink-400">Chargement du tableau de bord…</div>
      ) : error ? (
        <div className="card p-8 text-center text-[13px] font-semibold text-rose-500">{error}</div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <PromoCard />
            <StatCard label="Clients signés" value={clientsSignes} trend={0} trendLabel="—" icon={Users} />
            <StatCard label="Réunions tenues" value={reunionsTenues} trend={0} trendLabel="—" icon={Calendar} />
            <StatCard label="Total portefeuille" value={formatCompactDH(chiffreAffaires)} trend={0} trendLabel="—" icon={Wallet} />
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
              <RevenueChart data={chartSeries} trend={chartTrend} />
            </div>

            <div className="card flex flex-col items-center justify-center gap-1 p-6">
              <div className="flex w-full items-center justify-between">
                <h3 className="text-[12.5px] font-extrabold uppercase tracking-wide text-ink-400">Objectif mensuel</h3>
                <Target size={14} className="text-accent-500" />
              </div>
              <CircularGauge pct={objectifPct} label="Objectif atteint" sublabel={`${formatDH(monthlyActual)} / ${formatDH(monthlyTarget)}`} />
            </div>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3.5 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <div className="card p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-[13px] font-bold text-ink-500">Vos coffres</h3>
                  <Link to="/clients" className="flex items-center gap-1 text-[11.5px] font-bold text-accent-600 hover:text-accent-700">
                    Voir tous les clients
                    <ChevronRight size={13} />
                  </Link>
                </div>
                <div className="flex flex-col gap-2">
                  {companies.map((company) => {
                    const vs = vaultStats[company.id]
                    const trend = vs?.trend ?? 0
                    const revenue = vs?.revenue ?? 0
                    const isPositive = trend >= 0
                    return (
                      <Link
                        key={company.id}
                        to={`/vault/${company.id}`}
                        className="card-hover flex items-center gap-2.5 rounded-lg border border-ink-200 p-3"
                      >
                        <div
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[12px] font-bold text-white"
                          style={{ background: company.color }}
                        >
                          {company.initials}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[12.5px] font-bold text-ink-800">{company.name}</p>
                          <span
                            className={
                              'flex items-center gap-0.5 text-[11px] font-bold ' +
                              (isPositive ? 'text-emerald-500' : 'text-rose-500')
                            }
                          >
                            {isPositive ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
                            {isPositive ? '+' : ''}
                            {trend}%
                            <span className="ml-1 font-semibold text-ink-400">{formatCompactDH(revenue)}</span>
                          </span>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              </div>
            </div>

            <div className="card flex flex-col gap-3 p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-[13px] font-bold text-ink-500">Réunions à venir</h3>
                <Clock size={14} className="text-ink-400" />
              </div>
              <div className="flex flex-col gap-2">
                {upcomingMeetings.length === 0 ? (
                  <p className="py-2 text-center text-[12px] text-ink-400">Aucune réunion à venir.</p>
                ) : (
                  upcomingMeetings.map((meeting) => (
                    <div key={meeting.id} className="flex items-start gap-2.5 rounded-lg border border-ink-100 bg-ink-50/60 p-2.5">
                      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-ink-100 text-ink-500">
                        <Calendar size={13} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12px] font-bold text-ink-800">{meeting.meetingType || 'Réunion'}</p>
                        <p className="truncate text-[11px] text-ink-500">{meeting.clientName}</p>
                        <p className="mt-0.5 text-[10.5px] font-bold text-ink-700">{formatMeetingDate(meeting.meetingDate)}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="card mt-2 p-4">
            <h3 className="text-[13px] font-bold text-ink-500">Activité récente</h3>
            <div className="mt-2.5 flex flex-col divide-y divide-ink-100">
              {recentActivity.length === 0 ? (
                <p className="py-2 text-center text-[12px] text-ink-400">Aucune activité récente.</p>
              ) : (
                recentActivity.map((activity) => {
                  const type = activityDotType(activity.activityType)
                  return (
                    <div key={activity.id} className="flex items-center gap-3 py-2 first:pt-1">
                      <div
                        className={
                          'h-1.5 w-1.5 shrink-0 rounded-full ' +
                          (type === 'up' ? 'bg-emerald-500' : type === 'down' ? 'bg-rose-500' : 'bg-ink-300')
                        }
                      />
                      <p className="min-w-0 flex-1 truncate text-[12.5px] text-ink-700">
                        {activity.description || activity.activityType} — {activity.clientName}
                      </p>
                      <span className="shrink-0 text-[11px] text-ink-400">{formatActivityTime(activity.createdAt)}</span>
                      {activity.amount != null && (
                        <span
                          className={'shrink-0 text-[11.5px] font-bold ' + (type === 'up' ? 'text-emerald-500' : type === 'down' ? 'text-rose-500' : 'text-ink-500')}
                        >
                          {formatDH(activity.amount)}
                        </span>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </>
      )}
    </Layout>
  )
}
