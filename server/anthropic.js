import Anthropic from '@anthropic-ai/sdk'

const MODEL = 'claude-sonnet-4-6'
const MAX_TOKENS = 1024
const EXTRACTION_MAX_TOKENS = 512

export const SYSTEM_PROMPT =
  "Tu es l'assistant IA de Rachid, qui dirige trois entreprises de rayonnage industriel au Maroc. Tu l'aides à suivre ses clients, ses rendez-vous, et ses priorités commerciales. Réponds toujours en français, de manière naturelle et concise, sans formatage stylisé. Utilise une conversation simple et directe. Raisonnez à partir des principes fondamentaux : décomposez chaque problème en ses éléments essentiels avant de répondre. Privilégiez la précision et l'objectivité à la politesse. Apportez des réponses directes et substantielles, sans préambule, sans reformulation de ma question ni remplissage inutile. Luttez contre vos propres biais : ne cherchez pas à me plaire, n'abusez pas des nuances pour éviter les conflits et ne flattez pas. Si je me trompe ou si mon raisonnement est erroné, dites-le clairement. Si une position est défendable mais minoritaire ou inconfortable, exposez-la tout de même. Je privilégie la rigueur intellectuelle à l'agrément : concentrez-vous sur ce qui est vrai et utile, et non sur ce qui est confortable. Remettez en question mes hypothèses lorsque cela se justifie. Si une question est mal formulée ou repose sur une prémisse erronée, rectifiez cette prémisse avant de répondre plutôt que de répondre à côté du sujet. Pour tout problème concret, concluez par des mesures spécifiques et applicables : quoi faire, dans quel ordre et comment mesurer le succès. Évitez les conseils génériques. Lorsque vous énoncez quelque chose d'incertain, indiquez votre degré de confiance ainsi que les éléments susceptibles de le modifier. N'utilisez jamais la structure rhétorique « ce n'est pas X, c'est Y » ou « X n'est pas X, mais Y ». Évitez de définir les choses par contraste ; énoncez-les directement."

const FACT_TYPE_LABELS = {
  client: 'Clients',
  goal: 'Objectifs',
  task: 'Tâches / rappels',
  date: 'Dates importantes',
}

// The three vaults (businesses) clients can belong to. Shared between the extraction prompt
// below and server/index.js so a client mentioned by name or id always resolves the same way.
export const VAULTS = [
  { id: 'maghreb-rayonnage', name: 'Maghreb Rayonnage' },
  { id: 'az-rayonnage', name: 'AZ Rayonnage' },
  { id: 'top-rayonnage', name: 'Top Rayonnage' },
]

// Accepts either a canonical vault id ("maghreb-rayonnage") or its display name
// ("Maghreb Rayonnage") and normalizes to the canonical id, or null if unrecognized.
export function resolveVaultId(vault) {
  if (!vault) return null
  const v = String(vault).trim().toLowerCase()
  const match = VAULTS.find((x) => x.id.toLowerCase() === v || x.name.toLowerCase() === v)
  return match ? match.id : null
}

let client = null

function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY manquante. Ajoutez-la dans votre fichier .env à la racine du projet.')
  }
  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  }
  return client
}

// Removes markdown formatting symbols (**, __, *, -, #) while keeping the underlying text,
// so replies read as plain conversational text in the chat UI.
export function stripMarkdown(text) {
  if (!text) return text
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1') // **bold**
    .replace(/__(.*?)__/g, '$1') // __underline__
    .replace(/\*(.*?)\*/g, '$1') // *italic*
    .replace(/^#{1,6}\s+/gm, '') // # headings
    .replace(/^[ \t]*-\s+/gm, '') // - bullets
    .trim()
}

// Formats a stored ISO timestamp as a localized French date/time so the model reasons
// about it the same way it reasons about "now" — never as a raw UTC string it could misread.
function formatIsoForPrompt(value) {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  const datePart = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const timePart = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  return `${datePart} à ${timePart}`
}

function formatFactLine(fact) {
  const c = fact.content || {}
  switch (fact.fact_type) {
    case 'client':
      return `- ${c.name || 'Client'}${c.company ? ` (${c.company})` : ''}${c.contact ? ` — contact : ${c.contact}` : ''}${c.meetingDate ? ` — prochain RDV : ${formatIsoForPrompt(c.meetingDate)}` : ''}${c.notes ? ` — ${c.notes}` : ''}`
    case 'goal':
      return `- ${c.description || ''}${c.targetDate ? ` (échéance : ${formatIsoForPrompt(c.targetDate)})` : ''}`
    case 'task':
      return `- ${c.description || ''}${c.dueDate ? ` (à faire pour : ${formatIsoForPrompt(c.dueDate)})` : ''}`
    case 'date':
      return `- ${c.label || 'Date'} : ${formatIsoForPrompt(c.datetime)}${c.relatedTo ? ` (${c.relatedTo})` : ''}`
    default:
      return `- ${JSON.stringify(c)}`
  }
}

// Builds the system prompt sent with every chat turn: the editable base persona (from
// Réglages, falling back to the built-in default), an absolute reference to "now" so
// relative dates ("demain", "la semaine prochaine") can be resolved, and a compact summary
// of everything learned so far from the knowledge base.
export function buildSystemPrompt(basePrompt = SYSTEM_PROMPT, facts = [], now = new Date()) {
  const dateStr = now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const timeStr = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })

  let prompt =
    `${basePrompt || SYSTEM_PROMPT}\n\n` +
    `Nous sommes actuellement le ${dateStr}, il est ${timeStr}. Utilise cette date comme référence absolue pour ` +
    `interpréter toute expression relative ("demain", "la semaine prochaine", "dans 3 jours"...).`

  const grouped = { client: [], goal: [], task: [], date: [] }
  facts.forEach((f) => {
    if (grouped[f.fact_type]) grouped[f.fact_type].push(f)
  })

  const sections = Object.entries(grouped)
    .filter(([, list]) => list.length > 0)
    .map(([type, list]) => `${FACT_TYPE_LABELS[type]} :\n${list.slice(0, 20).map(formatFactLine).join('\n')}`)

  if (sections.length > 0) {
    prompt +=
      '\n\nVoici ce que tu sais déjà sur l\u2019activité de Rachid, appris lors de conversations précédentes. ' +
      'Utilise ces informations pour rendre tes réponses plus pertinentes et contextuelles (par exemple en ' +
      'rappelant naturellement un rendez-vous proche), sans les lister mécaniquement si ce n\u2019est pas utile :\n\n' +
      sections.join('\n\n')
  }

  return prompt
}

// history: array of { role: 'user' | 'assistant', content: string }, oldest first.
// businessContext (from Réglages) is woven into the latest user turn — not persisted to the
// visible conversation — so the model has it as context without it being a rigid instruction.
export async function getAssistantReply(history, systemPrompt = SYSTEM_PROMPT, businessContext = '') {
  const anthropic = getClient()

  const messages = history.map((m) => ({ role: m.role, content: m.content }))
  const lastMessage = messages[messages.length - 1]
  if (businessContext && lastMessage?.role === 'user') {
    lastMessage.content =
      `[Contexte métier interne, à utiliser si pertinent — ne pas le citer mot pour mot] :\n${businessContext}\n\n---\n\n` +
      lastMessage.content
  }

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: systemPrompt,
    messages,
  })

  const textBlock = response.content.find((block) => block.type === 'text')
  return textBlock?.text ?? ''
}

const VAULT_LIST_FOR_PROMPT = VAULTS.map((v) => `"${v.id}" (${v.name})`).join(', ')

const EXTRACTION_SYSTEM_PROMPT = `Tu es un extracteur de faits structurés pour un CRM. Analyse l'échange ci-dessous entre Rachid (dirigeant de Maghreb Rayonnage, AZ Rayonnage et Top Rayonnage) et son assistant IA. Extrais uniquement les informations NOUVELLES ou mises à jour qui méritent d'être mémorisées durablement, parmi ces catégories :

- "client" : un NOUVEAU client, ou une MISE À JOUR d'un client déjà connu (voir la liste des clients connus fournie ci-dessous, si elle est présente). Champs : name, company, contact, email, phone, location, next_step, value, importance, vault, meeting_date.
- "goal" : un objectif exprimé par Rachid. Champs : description, targetDate.
- "task" : une tâche ou un rappel à faire, avec une échéance si mentionnée. Champs : description, dueDate.
- "date" : une date ou un rendez-vous important, avec son horaire si précisé. Champs : label, datetime, relatedTo.
- "deal_update" : un changement de valeur (montant) sur une offre en cours pour un client déjà identifié. Champs : client_name (le nom du client, ou null si l'échange ne permet pas de l'identifier avec certitude), old_value, new_value, reason.
- "meeting" : une réunion tenue ou planifiée avec un client, mentionnée explicitement dans l'échange. Champs : client_name, meeting_date, notes, meeting_type.
- "activity" : un événement notable concernant un client (signature d'un contrat, devis refusé, paiement reçu, nouveau lead, etc.). Champs : client_name, activity_type, amount, description.
- "delete_client" : Rachid demande EXPLICITEMENT de supprimer un client déjà connu (ex. "supprime Karim Benali", "retire ce client", "efface la fiche de X", "delete [nom]"). Champs : client_name (nom exact du client, tel qu'il apparaît dans la liste des clients connus).

Règles importantes pour "client" :
- Si l'un des champs email, phone, location, next_step, value, importance n'est PAS mentionné dans l'échange, mets-le explicitement à null dans le JSON — ne l'omets pas, et n'invente JAMAIS une valeur manquante.
- Si le client correspond à un client déjà connu (liste fournie ci-dessous), reprends exactement le même nom pour qu'il puisse être relié à la bonne fiche plutôt que créé en double.
- "vault" identifie laquelle des trois entreprises de Rachid gère la relation avec ce client — PAS l'entreprise du client lui-même (qui va dans "company"). Utilise uniquement l'un de ces identifiants exacts : ${VAULT_LIST_FOR_PROMPT}. Ne déduis "vault" que si le coffre est explicitement mentionné ou clairement évident dans le contexte ; sinon mets null. N'invente jamais cette valeur.

Règle importante pour "delete_client" :
- N'extrais "delete_client" QUE si Rachid demande sans ambiguïté de supprimer/retirer/effacer un client précis. Une simple mention du client, une mise à jour, ou une phrase comme "ce client ne m'intéresse plus pour l'instant" ne sont PAS des demandes de suppression — dans le doute, n'extrais rien plutôt que de risquer une suppression involontaire.

Réponds UNIQUEMENT avec un tableau JSON valide, sans aucun texte ni bloc de code autour, au format exact :
[{"fact_type": "client", "content": {"name": "...", "company": "...", "contact": "...", "email": null, "phone": null, "location": null, "next_step": null, "value": null, "importance": null, "vault": null, "meeting_date": "..."}}]

Champs par type :
- client : name, company, contact, email, phone, location, next_step, value, importance, vault, meeting_date
- goal : description, targetDate
- task : description, dueDate
- date : label, datetime, relatedTo
- deal_update : client_name, old_value, new_value, reason
- meeting : client_name, meeting_date, notes, meeting_type
- activity : client_name, activity_type, amount, description
- delete_client : client_name

Toutes les dates doivent être des timestamps ISO 8601 absolus, calculés à partir de la date actuelle fournie (jamais des expressions relatives comme "demain"). Pour "client", n'omets un champ que si le concept lui-même n'a pas de sens dans le contexte (par exemple pas de company pour un particulier) ; pour email/phone/location/next_step/value/importance/vault, préfère toujours null explicite à l'omission. Si l'échange ne contient aucune information digne d'être mémorisée, réponds avec un tableau vide : []`

const VALID_FACT_TYPES = new Set(['client', 'goal', 'task', 'date', 'deal_update', 'meeting', 'activity', 'delete_client'])

// Compact "Karim Benali (Marjane Holding)" style list injected into the extraction prompt so
// Claude can match a client mentioned by name to an existing record (for "client" updates and
// for client_name on deal_update/meeting/activity) instead of only ever seeing new clients.
function formatExistingClientsForPrompt(existingClients) {
  if (!Array.isArray(existingClients) || existingClients.length === 0) return ''
  const lines = existingClients
    .slice(0, 50)
    .map((c) => `- ${c.name}${c.company ? ` (${c.company})` : ''}${c.vaultId ? ` — coffre : ${c.vaultId}` : ''}`)
  return `\n\nClients déjà connus (reprends exactement le même nom pour toute mise à jour ou référence) :\n${lines.join('\n')}`
}

// Silently analyzes one exchange and returns any new facts worth remembering.
// Never throws to the caller for malformed model output — returns [] instead.
// existingClients (from getAllClients()) lets Claude recognize when the conversation refers to
// a client already on file, instead of only ever being able to extract brand-new clients.
export async function extractFacts(userContent, assistantContent, now = new Date(), existingClients = []) {
  const anthropic = getClient()

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: EXTRACTION_MAX_TOKENS,
    system: EXTRACTION_SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Date et heure actuelles : ${now.toISOString()}${formatExistingClientsForPrompt(existingClients)}\n\nMessage de Rachid : ${userContent}\n\nRéponse de l'assistant : ${assistantContent}`,
      },
    ],
  })

  const textBlock = response.content.find((block) => block.type === 'text')
  const raw = (textBlock?.text ?? '[]').replace(/```json|```/g, '').trim()

  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (f) => f && typeof f === 'object' && VALID_FACT_TYPES.has(f.fact_type) && typeof f.content === 'object'
    )
  } catch {
    return []
  }
}
