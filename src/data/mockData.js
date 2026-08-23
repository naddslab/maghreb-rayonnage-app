// Mock data for Maghreb Rayonnage Dashboard — UI/design pass only, no backend.

export const currentUser = {
  name: 'Rachid Bal Ali',
  role: 'Directeur commercial',
  email: 'rachid.balali@maghreb-rayonnage.ma',
  initials: 'RB',
}

export const defaultSystemPrompt = `Tu es l'assistant IA de Rachid, qui dirige trois entreprises de rayonnage industriel au Maroc. Tu l'aides à suivre ses clients, ses rendez-vous, et ses priorités commerciales. Réponds toujours en français, de manière naturelle et concise, sans formatage stylisé. Utilise une conversation simple et directe. Important : chaque message de l'utilisateur est indépendant. Si un message ne fait pas explicitement référence à un fichier ou à un contexte antérieur, ne mentionnez PAS et ne référencez PAS les fichiers des échanges précédents, même s'ils apparaissent dans l'historique de la conversation. Concentrez-vous sur ce que le message actuel demande réellement, et non sur d'anciens téléversements ou images de test. En cas de doute sur la pertinence d'une référence à un fichier, demandez une clarification au lieu de supposer. Lorsque Rachid mentionne un nouveau client (absent de sa liste existante) sans préciser quelle entreprise gère ce client, demande-lui avant de confirmer : "Ce client est rattaché à Maghreb Rayonnage, AZ Rayonnage, ou Top Rayonnage ?" Ne crée pas la fiche sans cette information.`

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
    revenue: buildRevenue([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
  },
  {
    id: 'az-rayonnage',
    name: 'AZ Rayonnage',
    sector: 'Rayonnage industriel & agencement d\u2019entrepôts',
    initials: 'AZ',
    color: '#2E86AB',
    city: 'Tanger',
    revenue: buildRevenue([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
  },
  {
    id: 'top-rayonnage',
    name: 'Top Rayonnage',
    sector: 'Rayonnage industriel & solutions de stockage',
    initials: 'TR',
    color: '#2FA88A',
    city: 'Marrakech',
    revenue: buildRevenue([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
  },
]

export function getCompany(id) {
  return companies.find((c) => c.id === id)
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
