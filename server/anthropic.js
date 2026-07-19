import Anthropic from '@anthropic-ai/sdk'

const MODEL = 'claude-sonnet-4-6'
const MAX_TOKENS = 1024
const EXTRACTION_MAX_TOKENS = 512

export const SYSTEM_PROMPT =
  "Tu es l'assistant IA de Rachid, qui dirige trois entreprises de rayonnage industriel au Maroc : Maghreb Rayonnage, AZ Rayonnage, et Top Rayonnage. Tu l'aides à suivre ses clients, ses rendez-vous, et ses priorités commerciales. Réponds toujours en français, de manière concise et professionnelle."

const FACT_TYPE_LABELS = {
  client: 'Clients',
  goal: 'Objectifs',
  task: 'Tâches / rappels',
  date: 'Dates importantes',
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

const EXTRACTION_SYSTEM_PROMPT = `Tu es un extracteur de faits structurés pour un CRM. Analyse l'échange ci-dessous entre Rachid (dirigeant de Maghreb Rayonnage, AZ Rayonnage et Top Rayonnage) et son assistant IA. Extrais uniquement les faits NOUVEAUX ou mis à jour qui méritent d'être mémorisés durablement, parmi ces catégories :
- "client" : informations sur un client (nom, entreprise, contact, date de rendez-vous, notes)
- "goal" : un objectif exprimé par Rachid
- "task" : une tâche ou un rappel à faire, avec une échéance si mentionnée
- "date" : une date ou un rendez-vous important, avec son horaire si précisé

Réponds UNIQUEMENT avec un tableau JSON valide, sans aucun texte ni bloc de code autour, au format exact :
[{"fact_type": "client", "content": {"name": "...", "company": "...", "contact": "...", "meetingDate": "...", "notes": "..."}}]

Champs par type :
- client : name, company, contact, meetingDate, notes
- goal : description, targetDate
- task : description, dueDate
- date : label, datetime, relatedTo

Toutes les dates doivent être des timestamps ISO 8601 absolus, calculés à partir de la date actuelle fournie (jamais des expressions relatives comme "demain"). Omets les champs inconnus plutôt que d'inventer une valeur. Si l'échange ne contient aucun fait digne d'être mémorisé, réponds avec un tableau vide : []`

const VALID_FACT_TYPES = new Set(['client', 'goal', 'task', 'date'])

// Silently analyzes one exchange and returns any new facts worth remembering.
// Never throws to the caller for malformed model output — returns [] instead.
export async function extractFacts(userContent, assistantContent, now = new Date()) {
  const anthropic = getClient()

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: EXTRACTION_MAX_TOKENS,
    system: EXTRACTION_SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Date et heure actuelles : ${now.toISOString()}\n\nMessage de Rachid : ${userContent}\n\nRéponse de l'assistant : ${assistantContent}`,
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
