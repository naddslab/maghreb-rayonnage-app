// Mock data for Maghreb Rayonnage Dashboard — UI/design pass only, no backend.

export const currentUser = {
  name: 'Rachid Bal Ali',
  role: 'Directeur commercial',
  email: 'rachid.balali@maghreb-rayonnage.ma',
  initials: 'RB',
}

export const defaultSystemPrompt = `Tu es l'assistant IA de Rachid, qui dirige trois entreprises de rayonnage industriel au Maroc : Maghreb Rayonnage, AZ Rayonnage, et Top Rayonnage. Tu l'aides à suivre ses clients, ses rendez-vous, et ses priorités commerciales. Réponds toujours en français, de manière concise et professionnelle.`

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
      clientsSignes: 24,
      clientsSignesTrend: 12,
      clientsSpark: [16, 18, 19, 21, 22, 24],
      reunionsTenues: 9,
      reunionsTenuesTrend: 3,
      reunionsSpark: [5, 7, 6, 8, 8, 9],
      chiffreAffaires: 1229000,
      chiffreAffairesTrend: -4,
      objectifPct: 83,
      objectifCible: 130000,
      objectifActuel: 108000,
    },
    revenue: buildRevenue([78000, 82000, 91000, 95000, 88000, 102000, 110000, 105000, 138000, 120000, 112000, 108000]),
  },
  {
    id: 'az-rayonnage',
    name: 'AZ Rayonnage',
    sector: 'Rayonnage industriel & agencement d\u2019entrepôts',
    initials: 'AZ',
    color: '#2E86AB',
    city: 'Tanger',
    stats: {
      clientsSignes: 17,
      clientsSignesTrend: 8,
      clientsSpark: [11, 12, 13, 14, 16, 17],
      reunionsTenues: 6,
      reunionsTenuesTrend: -1,
      reunionsSpark: [8, 7, 8, 6, 7, 6],
      chiffreAffaires: 842000,
      chiffreAffairesTrend: 9,
      objectifPct: 96,
      objectifCible: 95000,
      objectifActuel: 91000,
    },
    revenue: buildRevenue([52000, 55000, 58000, 61000, 65000, 70000, 76000, 79000, 74000, 81000, 88000, 91000]),
  },
  {
    id: 'top-rayonnage',
    name: 'Top Rayonnage',
    sector: 'Rayonnage industriel & solutions de stockage',
    initials: 'TR',
    color: '#2FA88A',
    city: 'Marrakech',
    stats: {
      clientsSignes: 14,
      clientsSignesTrend: 5,
      clientsSpark: [9, 10, 10, 12, 13, 14],
      reunionsTenues: 5,
      reunionsTenuesTrend: 1,
      reunionsSpark: [4, 4, 5, 4, 5, 5],
      chiffreAffaires: 482000,
      chiffreAffairesTrend: 6,
      objectifPct: 82,
      objectifCible: 55000,
      objectifActuel: 45000,
    },
    revenue: buildRevenue([30000, 32000, 35000, 33000, 37000, 40000, 43000, 51000, 46000, 42000, 48000, 45000]),
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

const rawClients = [
  // Maghreb Rayonnage
  { id: 1, companyId: 'maghreb-rayonnage', nomEntreprise: 'Marjane Holding', nomClient: 'Karim Benali', poste: 'Directeur des achats', email: 'karim.benali@marjaneholding.ma', telephone: '+212 6 61 22 34 56', localisation: 'Casablanca', prochaineEtape: 'Attente signature', valeur: 420000, importance: 'XXX' },
  { id: 2, companyId: 'maghreb-rayonnage', nomEntreprise: 'OCP Group', nomClient: 'Fatima Zahra Amrani', poste: 'Responsable logistique', email: 'fatimazahra.amrani@ocpgroup.ma', telephone: '+212 6 63 45 78 12', localisation: 'Khouribga', prochaineEtape: 'Négocier le prix', valeur: 385000, importance: 'XXX' },
  { id: 3, companyId: 'maghreb-rayonnage', nomEntreprise: 'Label Vie Group', nomClient: 'Omar Chraibi', poste: 'Directeur commercial', email: 'omar.chraibi@labelvie.ma', telephone: '+212 6 64 90 11 23', localisation: 'Casablanca', prochaineEtape: 'Envoyer un devis', valeur: 265000, importance: 'XXX' },
  { id: 4, companyId: 'maghreb-rayonnage', nomEntreprise: 'Renault Tanger Med', nomClient: 'Hamza Fassi Fihri', poste: 'Responsable infrastructure', email: 'hamza.fassifihri@renault-tangermed.ma', telephone: '+212 6 70 33 21 88', localisation: 'Tanger', prochaineEtape: 'Planifier une visite', valeur: 198000, importance: 'XX' },
  { id: 5, companyId: 'maghreb-rayonnage', nomEntreprise: 'Aswak Assalam', nomClient: 'Nadia Bennani', poste: 'Responsable achats', email: 'nadia.bennani@aswakassalam.ma', telephone: '+212 6 66 12 90 44', localisation: 'Marrakech', prochaineEtape: 'Attente signature', valeur: 156000, importance: 'XX' },
  { id: 6, companyId: 'maghreb-rayonnage', nomEntreprise: 'Bricoma', nomClient: 'Youssef Alaoui', poste: 'Chef de projet', email: 'youssef.alaoui@bricoma.ma', telephone: '+212 6 62 55 67 09', localisation: 'Rabat', prochaineEtape: 'Relancer', valeur: 132000, importance: 'XX' },
  { id: 7, companyId: 'maghreb-rayonnage', nomEntreprise: 'Cosumar', nomClient: 'Hind Berrada', poste: 'Directrice des opérations', email: 'hind.berrada@cosumar.co.ma', telephone: '+212 6 69 44 23 71', localisation: 'Casablanca', prochaineEtape: 'Renouvellement à discuter', valeur: 121000, importance: 'XX' },
  { id: 8, companyId: 'maghreb-rayonnage', nomEntreprise: 'Décathlon Maroc', nomClient: 'Anas Sekkat', poste: 'Responsable supply chain', email: 'anas.sekkat@decathlon.ma', telephone: '+212 6 65 78 90 12', localisation: 'Mohammedia', prochaineEtape: 'Envoyer un devis', valeur: 98000, importance: 'XX' },
  { id: 9, companyId: 'maghreb-rayonnage', nomEntreprise: 'Mr Bricolage Maroc', nomClient: 'Leila Cherkaoui', poste: 'Gérante', email: 'leila.cherkaoui@mrbricolage.ma', telephone: '+212 6 61 09 88 34', localisation: 'Fès', prochaineEtape: 'Planifier une visite', valeur: 76000, importance: 'X' },
  { id: 10, companyId: 'maghreb-rayonnage', nomEntreprise: 'Lesieur Cristal', nomClient: 'Amine Bouzidi', poste: 'Responsable technique', email: 'amine.bouzidi@lesieur-cristal.ma', telephone: '+212 6 67 21 45 60', localisation: 'Casablanca', prochaineEtape: 'Négocier le prix', valeur: 64000, importance: 'X' },
  { id: 11, companyId: 'maghreb-rayonnage', nomEntreprise: 'IKEA Maroc', nomClient: 'Sara Ouazzani', poste: 'Chef de projet aménagement', email: 'sara.ouazzani@ikea.ma', telephone: '+212 6 68 33 12 09', localisation: 'Casablanca', prochaineEtape: 'Relancer', valeur: 54000, importance: 'X' },
  { id: 12, companyId: 'maghreb-rayonnage', nomEntreprise: 'Diana Holding', nomClient: 'Adil Bensouda', poste: 'Directeur administratif', email: 'adil.bensouda@dianaholding.ma', telephone: '+212 6 63 77 88 21', localisation: 'Meknès', prochaineEtape: 'Envoyer un devis', valeur: 41000, importance: 'X' },

  // AZ Rayonnage
  { id: 13, companyId: 'az-rayonnage', nomEntreprise: 'Somaca (Groupe Renault)', nomClient: 'Tarik Belmahi', poste: 'Directeur des opérations', email: 'tarik.belmahi@somaca.ma', telephone: '+212 6 71 22 33 45', localisation: 'Tanger', prochaineEtape: 'Attente signature', valeur: 310000, importance: 'XXX' },
  { id: 14, companyId: 'az-rayonnage', nomEntreprise: 'Yazaki Maroc', nomClient: 'Meryem Idrissi', poste: 'Responsable achats', email: 'meryem.idrissi@yazaki.ma', telephone: '+212 6 62 44 55 66', localisation: 'Tanger', prochaineEtape: 'Négocier le prix', valeur: 244000, importance: 'XXX' },
  { id: 15, companyId: 'az-rayonnage', nomEntreprise: 'LEONI Maroc Câblage', nomClient: 'Nawal Chaoui', poste: 'Responsable qualité', email: 'nawal.chaoui@leoni.ma', telephone: '+212 6 64 11 90 27', localisation: 'Tanger', prochaineEtape: 'Planifier une visite', valeur: 176000, importance: 'XX' },
  { id: 16, companyId: 'az-rayonnage', nomEntreprise: 'Derhem Logistics', nomClient: 'Rachid Lahlou', poste: 'Gérant', email: 'rachid.lahlou@derhemlogistics.ma', telephone: '+212 6 69 88 77 12', localisation: 'Kénitra', prochaineEtape: 'Relancer', valeur: 89000, importance: 'X' },
  { id: 17, companyId: 'az-rayonnage', nomEntreprise: 'STE Grands Travaux du Nord', nomClient: 'Imane Kabbaj', poste: 'Chef de chantier', email: 'imane.kabbaj@stegtn.ma', telephone: '+212 6 65 34 56 78', localisation: 'Tétouan', prochaineEtape: 'Envoyer un devis', valeur: 52000, importance: 'X' },

  // Top Rayonnage
  { id: 18, companyId: 'top-rayonnage', nomEntreprise: 'Copag', nomClient: 'Salma Idrissi', poste: 'Directrice commerciale', email: 'salma.idrissi@copag.ma', telephone: '+212 6 60 12 34 90', localisation: 'Taroudant', prochaineEtape: 'Attente signature', valeur: 142000, importance: 'XXX' },
  { id: 19, companyId: 'top-rayonnage', nomEntreprise: 'Somadis', nomClient: 'Mehdi Tazi', poste: 'Responsable entrepôt', email: 'mehdi.tazi@somadis.ma', telephone: '+212 6 61 90 45 33', localisation: 'Agadir', prochaineEtape: 'Renouvellement à discuter', valeur: 78000, importance: 'XX' },
  { id: 20, companyId: 'top-rayonnage', nomEntreprise: 'Colainord', nomClient: 'Karim Benali', poste: 'Responsable achats', email: 'karim.benali@colainord.ma', telephone: '+212 6 66 23 11 09', localisation: 'Agadir', prochaineEtape: 'Envoyer un devis', valeur: 45000, importance: 'X' },
  { id: 21, companyId: 'top-rayonnage', nomEntreprise: 'Managem', nomClient: 'Youssef Alaoui', poste: 'Responsable maintenance', email: 'youssef.alaoui@managem.ma', telephone: '+212 6 67 55 21 43', localisation: 'Guemassa', prochaineEtape: 'Négocier le prix', valeur: 96000, importance: 'XX' },
  { id: 22, companyId: 'top-rayonnage', nomEntreprise: 'Alstom Maroc', nomClient: 'Hind Berrada', poste: 'Responsable infrastructure', email: 'hind.berrada@alstom.ma', telephone: '+212 6 68 12 90 76', localisation: 'Fès', prochaineEtape: 'Relancer', valeur: 38000, importance: 'X' },
]

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

export const upcomingMeetings = [
  { id: 1, title: 'Présentation devis rayonnage', client: 'OCP Group', date: 'Aujourd\u2019hui, 15:30', companyId: 'maghreb-rayonnage' },
  { id: 2, title: 'Suivi installation mezzanine', client: 'Marjane Holding', date: 'Demain, 10:00', companyId: 'maghreb-rayonnage' },
  { id: 3, title: 'Négociation contrat annuel', client: 'Somaca (Groupe Renault)', date: 'Jeu. 19 juil., 09:00', companyId: 'az-rayonnage' },
  { id: 4, title: 'Visite site logistique', client: 'Copag', date: 'Ven. 20 juil., 14:00', companyId: 'top-rayonnage' },
]

export const recentActivity = [
  { id: 1, text: 'Contrat signé avec Marjane Holding', amount: '+420 000 DH', time: 'Il y a 2h', type: 'up' },
  { id: 2, text: 'Réunion tenue avec OCP Group', amount: null, time: 'Il y a 5h', type: 'neutral' },
  { id: 3, text: 'Devis refusé par IKEA Maroc', amount: '-54 000 DH', time: 'Hier', type: 'down' },
  { id: 4, text: 'Nouveau lead : Aswak Assalam', amount: null, time: 'Hier', type: 'neutral' },
  { id: 5, text: 'Paiement reçu de Cosumar', amount: '+60 500 DH', time: 'Il y a 2 jours', type: 'up' },
]

// ---------- AI Chat ----------

export const initialChatMessages = [
  {
    id: 1,
    sender: 'ai',
    text: 'Bonjour Rachid 👋 Je suis votre assistant IA. Je peux résumer vos coffres, préparer un compte-rendu de réunion ou analyser vos tendances de CA. Que puis-je faire pour vous ?',
    time: '09:02',
  },
  {
    id: 2,
    sender: 'user',
    text: 'Peux-tu me faire un résumé rapide du coffre Maghreb Rayonnage ?',
    time: '09:03',
  },
  {
    id: 3,
    sender: 'ai',
    text: 'Bien sûr. Maghreb Rayonnage compte 24 clients signés (+12%), 9 réunions tenues ce mois-ci et un CA de 1,23M DH sur 12 mois, soit 83% de l\u2019objectif mensuel. Septembre reste votre meilleur mois avec 138 000 DH. Les comptes OCP Group et Marjane Holding représentent vos plus fortes valeurs (XXX).',
    time: '09:03',
  },
  {
    id: 4,
    sender: 'user',
    text: 'Merci ! Prépare-moi 3 points pour la réunion avec OCP Group cet après-midi.',
    time: '09:05',
  },
  {
    id: 5,
    sender: 'ai',
    text: '1) Rappeler l\u2019avancement du devis rayonnage industriel (385 000 DH). 2) Proposer un délai d\u2019installation sur le site de Khouribga. 3) Mettre en avant la garantie 5 ans sur les structures métalliques.',
    time: '09:05',
  },
]

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
