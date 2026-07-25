// Mock data for Maghreb Rayonnage Dashboard — UI/design pass only, no backend.

export const currentUser = {
  name: 'Rachid Bal Ali',
  role: 'Directeur commercial',
  email: 'rachid.balali@maghreb-rayonnage.ma',
  initials: 'RB',
}

export const defaultSystemPrompt = `Tu es l'assistant IA de Rachid, qui dirige trois entreprises de rayonnage industriel au Maroc. Tu l'aides à suivre ses clients, ses rendez-vous, et ses priorités commerciales. Réponds toujours en français, de manière naturelle et concise, sans formatage stylisé. Utilise une conversation simple et directe. Raisonnez à partir des principes fondamentaux : décomposez chaque problème en ses éléments essentiels avant de répondre. Privilégiez la précision et l'objectivité à la politesse. Apportez des réponses directes et substantielles, sans préambule, sans reformulation de ma question ni remplissage inutile. Luttez contre vos propres biais : ne cherchez pas à me plaire, n'abusez pas des nuances pour éviter les conflits et ne flattez pas. Si je me trompe ou si mon raisonnement est erroné, dites-le clairement. Si une position est défendable mais minoritaire ou inconfortable, exposez-la tout de même. Je privilégie la rigueur intellectuelle à l'agrément : concentrez-vous sur ce qui est vrai et utile, et non sur ce qui est confortable. Remettez en question mes hypothèses lorsque cela se justifie. Si une question est mal formulée ou repose sur une prémisse erronée, rectifiez cette prémisse avant de répondre plutôt que de répondre à côté du sujet. Pour tout problème concret, concluez par des mesures spécifiques et applicables : quoi faire, dans quel ordre et comment mesurer le succès. Évitez les conseils génériques. Lorsque vous énoncez quelque chose d'incertain, indiquez votre degré de confiance ainsi que les éléments susceptibles de le modifier. N'utilisez jamais la structure rhétorique « ce n'est pas X, c'est Y » ou « X n'est pas X, mais Y ». Évitez de définir les choses par contraste ; énoncez-les directement.`

export const defaultKnowledgeBase = `Maghreb Rayonnage — groupe spécialisé dans la conception, la fabrication et l'installation de systèmes de rayonnage industriel, mezzanines et solutions de stockage au Maroc.

Coffres actifs : Maghreb Rayonnage (siège, Casablanca), AZ Rayonnage (Tanger), Top Rayonnage (Marrakech).

Délai moyen de fabrication : 4 à 6 semaines. Garantie structures métalliques : 5 ans.
Grille tarifaire indicative : rayonnage à palettes à partir de 850 DH/mètre linéaire, mezzanines sur devis selon charge et surface.
Politique commerciale : remise de 5% au-delà de 300 000 DH, paiement 30% à la commande / 70% à la livraison.`

// ---------- Revenue helpers ----------

const MONTHS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']

function buildRevenue(values) {
  const bestIndex = values.indexOf(Math.max(...values))
  return values.map((value, i) => ({
    month: MONTHS[i],
    value,
    isBest: i === bestIndex,
  }))
}

// ---------- Companies (Vaults) ----------

export const companies = [
  {
    id: 'maghreb-rayonnage',
    name: 'Maghreb Rayonnage',
    sector: 'Rayonnage industriel & mezzanines',
    initials: 'MR',
    color: '#E67E22',
    city: 'Casablanca',
    stats: {
      clientsSignes: 0,
      clientsSignesTrend: 0,
      clientsSpark: [0, 0, 0, 0, 0, 0],
      reunionsTenues: 0,
      reunionsTenuesTrend: 0,
      reunionsSpark: [0, 0, 0, 0, 0, 0],
      chiffreAffaires: 0,
      chiffreAffairesTrend: 0,
      objectifPct: 0,
      objectifCible: 0,
      objectifActuel: 0,
    },
    revenue: buildRevenue([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
  },
  {
    id: 'az-rayonnage',
    name: 'AZ Rayonnage',
    sector: 'Rayonnage industriel & agencement d\u2019entrepôts',
    initials: 'AZ',
    color: '#2E86AB',
    city: 'Tanger',
    stats: {
      clientsSignes: 0,
      clientsSignesTrend: 0,
      clientsSpark: [0, 0, 0, 0, 0, 0],
      reunionsTenues: 0,
      reunionsTenuesTrend: 0,
      reunionsSpark: [0, 0, 0, 0, 0, 0],
      chiffreAffaires: 0,
      chiffreAffairesTrend: 0,
      objectifPct: 0,
      objectifCible: 0,
      objectifActuel: 0,
    },
    revenue: buildRevenue([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
  },
  {
    id: 'top-rayonnage',
    name: 'Top Rayonnage',
    sector: 'Rayonnage industriel & solutions de stockage',
    initials: 'TR',
    color: '#2FA88A',
    city: 'Marrakech',
    stats: {
      clientsSignes: 0,
      clientsSignesTrend: 0,
      clientsSpark: [0, 0, 0, 0, 0, 0],
      reunionsTenues: 0,
      reunionsTenuesTrend: 0,
      reunionsSpark: [0, 0, 0, 0, 0, 0],
      chiffreAffaires: 0,
      chiffreAffairesTrend: 0,
      objectifPct: 0,
      objectifCible: 0,
      objectifActuel: 0,
    },
    revenue: buildRevenue([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
  },
]

export function getCompany(id) {
  return companies.find((c) => c.id === id)
}

// ---------- Clients ----------
// importance: 'XXX' (haute), 'XX' (moyenne), 'X' (faible)
// prochaineEtape: prochaine action commerciale à mener avec ce client

const importanceOrder = { XXX: 3, XX: 2, X: 1 }

function buildSparkline(id, base, trendUp) {
  const points = []
  for (let i = 0; i < 6; i++) {
    const noise = Math.abs(Math.sin((id + 1) * (i + 2) * 12.9898)) % 1
    const drift = trendUp ? i * base * 0.05 : -i * base * 0.035
    const v = base * 0.62 + drift + noise * base * 0.22
    points.push(Math.max(Math.round(v), Math.round(base * 0.15)))
  }
  points.push(base)
  return points
}

const rawClients = []

export const clients = rawClients.map((c) => {
  const trendUp = !(c.prochaineEtape === 'Relancer' || c.id % 4 === 0)
  return { ...c, sparkline: buildSparkline(c.id, c.valeur, trendUp), trendUp }
})

export function clientsForCompany(companyId) {
  return clients
    .filter((c) => c.companyId === companyId)
    .slice()
    .sort((a, b) => importanceOrder[b.importance] - importanceOrder[a.importance] || b.valeur - a.valeur)
}

export function allClientsSorted() {
  return clients
    .slice()
    .sort((a, b) => importanceOrder[b.importance] - importanceOrder[a.importance] || b.valeur - a.valeur)
}

export const prochaineEtapeOptions = [
  'Envoyer un devis',
  'Planifier une visite',
  'Négocier le prix',
  'Attente signature',
  'Renouvellement à discuter',
  'Relancer',
]

export const prochaineEtapeStyles = {
  'Envoyer un devis': 'bg-sky-50 text-sky-600',
  'Planifier une visite': 'bg-violet-50 text-violet-600',
  'Négocier le prix': 'bg-amber-50 text-amber-700',
  'Attente signature': 'bg-accent-50 text-accent-600',
  'Renouvellement à discuter': 'bg-emerald-50 text-emerald-600',
  Relancer: 'bg-rose-50 text-rose-500',
}

// ---------- Meetings / activity (dashboard extras) ----------

export const upcomingMeetings = []

export const recentActivity = []

// ---------- Formatting helpers ----------

export function formatDH(value) {
  const rounded = Math.round(value)
  const formatted = rounded.toLocaleString('fr-FR').replace(/,/g, ' ')
  return `${formatted} DH`
}

export function formatCompactDH(value) {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M DH`
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(0)}K DH`
  }
  return `${value} DH`
}
