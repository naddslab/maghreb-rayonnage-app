import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Users, Calendar, Wallet, ChevronRight, ArrowUpRight, ArrowDownRight, Clock, Target, Star } from 'lucide-react'
import Layout from '../components/Layout'
import StatCard from '../components/StatCard'
import RevenueChart from '../components/RevenueChart'
import CircularGauge from '../components/CircularGauge'
import PromoCard from '../components/PromoCard'
import { companies, formatCompactDH, formatDH } from '../data/mockData'
import { fetchAllClients, fetchMeetings, fetchActivities } from '../lib/clients'

const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })

// A client counts as "signé" once their next step reads like a closed deal (contrat signé,
// signature reçue, etc.) rather than tracking a separate status field the API doesn't have.
function isSignedClient(client) {
  return typeof client.nextStep === 'string' && /sign/i.test(client.nextStep)
}

function formatMeetingDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function formatActivityTime(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

// Best-effort classification of an activity as good/bad news for the little colored dot — the
// API only stores a free-text activityType, so this is a heuristic, not a real status field.
function activityDotType(activityType) {
  const t = (activityType || '').toLowerCase()
  if (/(signature|signé|gagné|paiement|payé)/.test(t)) return 'up'
  if (/(refus|perdu|annulé|résilié)/.test(t)) return 'down'
  return 'neutral'
}

export default function Dashboard() {
  const main = companies[0]
  const [clients, setClients] = useState([])
  const [meetings, setMeetings] = useState([])
  const [activities, setActivities] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const fetchedClients = await fetchAllClients()
        if (cancelled) return
        setClients(fetchedClients)

        const [meetingsByClient, activitiesByClient] = await Promise.all([
          Promise.all(fetchedClients.map((c) => fetchMeetings(c.id).catch(() => []))),
          Promise.all(fetchedClients.map((c) => fetchActivities(c.id).catch(() => []))),
        ])
        if (cancelled) return

        setMeetings(
          fetchedClients.flatMap((c, i) => meetingsByClient[i].map((m) => ({ ...m, clientName: c.name })))
        )
        setActivities(
          fetchedClients.flatMap((c, i) => activitiesByClient[i].map((a) => ({ ...a, clientName: c.name })))
        )
      } catch (err) {
        if (!cancelled) setError(err.message || 'Impossible de charger les données du tableau de bord.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

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

          <div className="mt-3 grid grid-cols-1 gap-3.5 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <RevenueChart data={main.revenue} trend={main.stats.chiffreAffairesTrend} />
            </div>

            <div className="card flex flex-col items-center justify-center gap-1 p-6">
              <div className="flex w-full items-center justify-between">
                <h3 className="text-[12.5px] font-extrabold uppercase tracking-wide text-ink-400">Objectif mensuel</h3>
                <Target size={14} className="text-accent-500" />
              </div>
              <CircularGauge pct={main.stats.objectifPct} label="Objectif atteint" sublabel={`${formatDH(main.stats.objectifActuel)} / ${formatDH(main.stats.objectifCible)}`} />
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

                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                  {companies.map((company) => {
                    const isPositive = company.stats.chiffreAffairesTrend >= 0
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
                            {company.stats.chiffreAffairesTrend}%
                            <span className="ml-1 font-semibold text-ink-400">{formatCompactDH(company.stats.chiffreAffaires)}</span>
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
                          className={'shrink-0 text-[11.5px] font-bold ' + (type === 'up' ? 'text-emerald-500' : 'text-rose-500')}
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
