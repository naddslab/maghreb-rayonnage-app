import Anthropic from '@anthropic-ai/sdk'

const MODEL = 'claude-sonnet-4-6'
const MAX_TOKENS = 1024
const EXTRACTION_MAX_TOKENS = 2048

// Rachid's businesses operate in Morocco — every date/time shown to him or reasoned about by
// Claude must reflect this timezone regardless of where the Node process itself happens to run
// (e.g. Fly.io's "iad" region, which is US East / effectively UTC on a bare container).
const TIMEZONE = 'Africa/Casablanca'

// Returns the UTC offset (e.g. "+01:00", "+00:00") actually in effect for `date` in `timeZone`.
// Computed via Intl rather than hardcoded because Morocco's offset has changed historically and
// still shifts temporarily during Ramadan — this stays correct without needing updates here.
function getUtcOffset(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'shortOffset' }).formatToParts(date)
  const raw = parts.find((p) => p.type === 'timeZoneName')?.value || 'GMT+0'
  const match = raw.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/)
  if (!match) return '+00:00'
  const [, sign, hours, minutes = '00'] = match
  return `${sign}${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}`
}

// Formats `date` as an ISO 8601 string reflecting its wall-clock time in `timeZone`, with that
// zone's real offset attached (e.g. "2026-07-26T23:10:00+01:00") — unlike date.toISOString(),
// which is always UTC. Passing this to Claude means it never has to do UTC math in its head to
// resolve "demain" / "la semaine prochaine": the reference instant already reads as Morocco does.
function toIsoWithTimeZone(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const get = (type) => parts.find((p) => p.type === type)?.value
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}${getUtcOffset(date, timeZone)}`
}

export const SYSTEM_PROMPT =
  "Tu es l'assistant IA de Rachid, qui dirige trois entreprises de rayonnage industriel au Maroc. Tu l'aides à suivre ses clients, ses rendez-vous, et ses priorités commerciales. Réponds toujours en français, de manière naturelle et concise, sans formatage stylisé. Utilise une conversation simple et directe. Important : chaque message de l'utilisateur est indépendant. Si un message ne fait pas explicitement référence à un fichier ou à un contexte antérieur, ne mentionnez PAS et ne référencez PAS les fichiers des échanges précédents, même s'ils apparaissent dans l'historique de la conversation. Concentrez-vous sur ce que le message actuel demande réellement, et non sur d'anciens téléversements ou images de test. En cas de doute sur la pertinence d'une référence à un fichier, demandez une clarification au lieu de supposer. Lorsque Rachid mentionne un nouveau client (absent de sa liste existante) sans préciser quelle entreprise gère ce client, demande-lui avant de confirmer : \"Ce client est rattaché à Maghreb Rayonnage, AZ Rayonnage, ou Top Rayonnage ?\" Ne crée pas la fiche sans cette information. Si le message suivant de Rachid répond clairement à cette question (par exemple il cite uniquement le nom d'une entreprise, ou dit \"c'est pour Maghreb Rayonnage\"), confirme-lui simplement que le client sera rattaché à cette entreprise — ne repose jamais la même question sur le coffre."

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
    .replace(/(?<![*\w\d])\*([^*\n]+?)\*(?![*\w\d])/g, '$1') // *italic* — requires non-word/digit context to avoid eating math operators like 2*3*4
    .replace(/^#{1,6}\s+/gm, '') // # headings
    .replace(/^[ \t]*-[ \t]+(?=[A-Za-zÀ-ÿ"'«])/gm, '') // - bullets — only strip when followed by a letter/quote, not a digit or operator
    .trim()
}

// Formats a stored ISO timestamp as a localized French date/time so the model reasons
// about it the same way it reasons about "now" — never as a raw UTC string it could misread.
// Explicitly pinned to Africa/Casablanca so this always reads as Morocco local time, regardless
// of the server process's own timezone.
function formatIsoForPrompt(value) {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  const datePart = d.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: TIMEZONE,
  })
  const timePart = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: TIMEZONE })
  return `${datePart} à ${timePart}`
}

const MINUTE_MS = 60 * 1000
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS

function pluralizeFr(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`
}

// Precisely formats the gap between `targetDate` and `now` as a natural French duration —
// e.g. "dans 1 heure et 3 minutes", "dans 2 jours", "il y a 3 jours", "dans 3 semaines" — so
// Claude never has to compute this itself and can just read/repeat an already-correct string.
//
// This is a pure difference of two absolute instants (target.getTime() - now.getTime()), never
// server-local wall-clock fields like getDate()/getHours() — a Date-to-Date millisecond
// difference is the exact same physical duration in every timezone, so there is no "day
// boundary" to get wrong here regardless of which timezone the server process itself runs in.
// (Africa/Casablanca only matters for *calendar-facing* formatting, like formatIsoForPrompt.)
export function formatRelativeTime(targetDate, now = new Date()) {
  const target = targetDate instanceof Date ? targetDate : new Date(targetDate)
  if (Number.isNaN(target.getTime())) return ''

  const diffMs = target.getTime() - now.getTime()
  const isPast = diffMs < 0
  const absMs = Math.abs(diffMs)

  if (absMs < MINUTE_MS) return 'maintenant'

  const totalMinutes = Math.floor(absMs / MINUTE_MS)
  const totalHours = Math.floor(absMs / HOUR_MS)
  const totalDays = Math.floor(absMs / DAY_MS)

  let phrase
  if (totalDays >= 7) {
    // Weeks scale: show whole weeks, plus a day remainder only if there is one (so an exact
    // multiple of 7 days reads as "3 semaines", not "3 semaines et 0 jour").
    const weeks = Math.floor(totalDays / 7)
    const remainingDays = totalDays % 7
    phrase = pluralizeFr(weeks, 'semaine')
    if (remainingDays > 0) phrase += ` et ${pluralizeFr(remainingDays, 'jour')}`
  } else if (totalDays >= 1) {
    const remainingHours = Math.floor((absMs - totalDays * DAY_MS) / HOUR_MS)
    phrase = pluralizeFr(totalDays, 'jour')
    if (remainingHours > 0) phrase += ` et ${pluralizeFr(remainingHours, 'heure')}`
  } else if (totalHours >= 1) {
    const remainingMinutes = Math.floor((absMs - totalHours * HOUR_MS) / MINUTE_MS)
    phrase = pluralizeFr(totalHours, 'heure')
    if (remainingMinutes > 0) phrase += ` et ${pluralizeFr(remainingMinutes, 'minute')}`
  } else {
    phrase = pluralizeFr(totalMinutes, 'minute')
  }

  return isPast ? `il y a ${phrase}` : `dans ${phrase}`
}

// " — dans 1 jour et 3 heures" style suffix to tack onto a formatted date, or '' if `value`
// isn't a usable date — kept separate from formatRelativeTime so callers that don't need the
// leading " — " (e.g. the upcoming-meetings section, which uses its own layout) can call
// formatRelativeTime directly.
function relativeSuffix(value, now) {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  const rel = formatRelativeTime(d, now)
  return rel ? ` — ${rel}` : ''
}

function formatFactLine(fact, now) {
  const c = fact.content || {}
  switch (fact.fact_type) {
    case 'client':
      return `- ${c.name || 'Client'}${c.company ? ` (${c.company})` : ''}${c.contact ? ` — contact : ${c.contact}` : ''}${c.meetingDate ? ` — prochain RDV : ${formatIsoForPrompt(c.meetingDate)}${relativeSuffix(c.meetingDate, now)}` : ''}${c.notes ? ` — ${c.notes}` : ''}`
    case 'goal':
      return `- ${c.description || ''}${c.targetDate ? ` (échéance : ${formatIsoForPrompt(c.targetDate)}${relativeSuffix(c.targetDate, now)})` : ''}`
    case 'task':
      return `- ${c.description || ''}${c.dueDate ? ` (à faire pour : ${formatIsoForPrompt(c.dueDate)}${relativeSuffix(c.dueDate, now)})` : ''}`
    case 'date':
      return `- ${c.label || 'Date'} : ${formatIsoForPrompt(c.datetime)}${relativeSuffix(c.datetime, now)}${c.relatedTo ? ` (${c.relatedTo})` : ''}`
    default:
      return `- ${JSON.stringify(c)}`
  }
}

// Builds the system prompt sent with every chat turn: the editable base persona (from
// Réglages, falling back to the built-in default), an absolute reference to "now" so
// relative dates ("demain", "la semaine prochaine") can be resolved, a compact summary of
// everything learned so far from the knowledge base, and the list of upcoming meetings (see
// getUpcomingMeetings in db.js) — each with a precomputed formatRelativeTime() string, so Claude
// reads and repeats an already-correct duration instead of ever computing one itself.
// dateStr/timeStr are pinned to Africa/Casablanca — the server may run in any timezone (Fly.io's
// "iad" region is effectively UTC), but Rachid's business, and every date shown to him, is Morocco time.
export function buildSystemPrompt(basePrompt = SYSTEM_PROMPT, facts = [], now = new Date(), upcomingMeetings = []) {
  const dateStr = now.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: TIMEZONE,
  })
  const timeStr = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: TIMEZONE })

  let prompt =
    `${basePrompt || SYSTEM_PROMPT}\n\n` +
    `Nous sommes actuellement le ${dateStr}, il est ${timeStr} (heure du Maroc, Africa/Casablanca). Utilise cette ` +
    `date comme référence absolue pour interpréter toute expression relative ("demain", "la semaine prochaine", ` +
    `"dans 3 jours"...).`

  if (Array.isArray(upcomingMeetings) && upcomingMeetings.length > 0) {
    const lines = upcomingMeetings.map((m) => {
      const when = formatIsoForPrompt(m.meetingDate)
      const rel = formatRelativeTime(new Date(m.meetingDate), now)
      return `- ${m.clientName || 'Client inconnu'} : ${when}${rel ? ` — ${rel}` : ''}${m.meetingType ? ` (${m.meetingType})` : ''}${m.notes ? ` — ${m.notes}` : ''}`
    })
    prompt +=
      '\n\nRéunions à venir (les durées ci-dessous sont déjà calculées avec précision — réutilise-les telles ' +
      'quelles, ne recalcule jamais toi-même un écart de temps) :\n' +
      lines.join('\n')
  }

  const grouped = { client: [], goal: [], task: [], date: [] }
  facts.forEach((f) => {
    if (grouped[f.fact_type]) grouped[f.fact_type].push(f)
  })

  const sections = Object.entries(grouped)
    .filter(([, list]) => list.length > 0)
    .map(([type, list]) => `${FACT_TYPE_LABELS[type]} :\n${list.slice(0, 20).map((f) => formatFactLine(f, now)).join('\n')}`)

  if (sections.length > 0) {
    prompt +=
      '\n\nVoici ce que tu sais déjà sur l\u2019activité de Rachid, appris lors de conversations précédentes. ' +
      'Utilise ces informations pour rendre tes réponses plus pertinentes et contextuelles (par exemple en ' +
      'rappelant naturellement un rendez-vous proche), sans les lister mécaniquement si ce n\u2019est pas utile :\n\n' +
      sections.join('\n\n')
  }

  return prompt
}

// Claude API limits: ~5MB per base64-encoded image, and 32MB / 100 pages per PDF document.
// Exported so server/index.js can reuse them for its own file-size guard without duplicating the values.
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024
export const MAX_PDF_BYTES = 32 * 1024 * 1024

// Turns files relevant to this turn — both client-linked files (see server/index.js's
// loadClientFilesForPrompt) and general, non-client files (loadGeneralFilesForPrompt, e.g.
// Rachid's own CV) — into Claude API content blocks so the model can actually see the
// attachment, not just know it exists by name. This function itself doesn't care which bucket a
// file came from; the caller is responsible for deciding what's relevant and merging both lists.
// Each entry is expected to already carry `base64` (pre-fetched by the caller) — `url` is kept
// as a fallback only, so this still degrades gracefully if a caller passes files un-fetched.
// Never throws: any single file that's unsupported, unfetchable, or oversized is skipped with a
// warning so one bad attachment can't break the whole chat turn.
async function buildFileContentBlocks(clientFiles) {
  const blocks = []

  for (const file of clientFiles) {
    if (!file?.fileType) continue
    const isImage = file.fileType.startsWith('image/')
    const isPdf = file.fileType === 'application/pdf'
    if (!isImage && !isPdf) continue

    let base64 = file.base64
    if (!base64 && file.url) {
      try {
        const response = await fetch(file.url)
        if (!response.ok) {
          console.warn(`Téléchargement du fichier "${file.filename}" échoué (HTTP ${response.status}), ignoré.`)
          continue
        }
        base64 = Buffer.from(await response.arrayBuffer()).toString('base64')
      } catch (err) {
        console.warn(`Impossible de récupérer le fichier "${file.filename}" pour le prompt, ignoré :`, err.message)
        continue
      }
    }
    if (!base64) continue

    const approxBytes = Math.ceil((base64.length * 3) / 4)
    const limit = isImage ? MAX_IMAGE_BYTES : MAX_PDF_BYTES
    if (approxBytes > limit) {
      console.warn(`Fichier "${file.filename}" ignoré dans le prompt : dépasse la limite de taille autorisée par l'API Claude.`)
      continue
    }

    blocks.push(
      isImage
        ? { type: 'image', source: { type: 'base64', media_type: file.fileType, data: base64 } }
        : { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } }
    )
  }

  return blocks
}

// history: array of { role: 'user' | 'assistant', content: string }, oldest first.
// businessContext (from Réglages) is woven into the latest user turn — not persisted to the
// visible conversation — so the model has it as context without it being a rigid instruction.
// clientFiles (optional): array of { filename, fileType, url, base64 } for files relevant to the
// current conversation (see server/index.js) — may mix client-linked files and general,
// non-client files (e.g. a personal CV) — attached to the last user message as image/document
// content blocks so Claude can actually read them, not just know they exist.
export async function getAssistantReply(history, systemPrompt = SYSTEM_PROMPT, businessContext = '', clientFiles = []) {
  const anthropic = getClient()

  const messages = history.map((m) => ({ role: m.role, content: m.content }))
  const lastMessage = messages[messages.length - 1]
  if (businessContext && lastMessage?.role === 'user') {
    lastMessage.content =
      `[Contexte métier interne, à utiliser si pertinent — ne pas le citer mot pour mot] :\n${businessContext}\n\n---\n\n` +
      lastMessage.content
  }

  if (Array.isArray(clientFiles) && clientFiles.length > 0 && lastMessage?.role === 'user') {
    const fileBlocks = await buildFileContentBlocks(clientFiles)
    if (fileBlocks.length > 0) {
      lastMessage.content = [...fileBlocks, { type: 'text', text: lastMessage.content }]
    }
  }

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: systemPrompt,
    messages,
  })

  if (response.stop_reason !== 'end_turn') {
    console.warn('Assistant reply may have been truncated. stop_reason:', response.stop_reason)
  }
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
- "activity" : un événement notable concernant un client. Champs : client_name, activity_type, amount, description.
- "delete_client" : Rachid demande EXPLICITEMENT de supprimer un client déjà connu (ex. "supprime Karim Benali", "retire ce client", "efface la fiche de X", "delete [nom]"). Champs : client_name (nom exact du client, tel qu'il apparaît dans la liste des clients connus).
- "monthly_goal" : Rachid fixe ou met à jour un objectif de chiffre d'affaires pour un mois donné (ex. "mon objectif ce mois est 200000 DH", "notre objectif pour juillet est 500k"). Champs : month, target_value.

Règles importantes pour "monthly_goal" :
- "month" doit être au format "YYYY-MM". Déduis-le du contexte (nom de mois mentionné, "ce mois-ci", "le mois prochain", etc.) par rapport à la date actuelle fournie ci-dessous ; si aucun mois n'est mentionné, utilise le mois en cours.
- "target_value" est un montant numérique en DH (pas de texte, pas de devise) — convertis les abréviations comme "500k" en 500000.

Règles importantes pour "client" :
- Si l'un des champs email, phone, location, next_step, value, importance n'est PAS mentionné dans l'échange, mets-le explicitement à null dans le JSON — ne l'omets pas, et n'invente JAMAIS une valeur manquante.
- Si le client correspond à un client déjà connu (liste fournie ci-dessous), reprends exactement le même nom pour qu'il puisse être relié à la bonne fiche plutôt que créé en double.
- Pour un NOUVEAU client (qui n'apparaît PAS dans la liste des clients connus) : si un montant de deal est mentionné dans le même contexte (ex. "j'ai signé un nouveau client pour 100k DH", "Client X nous a choisi pour 250 000 DH"), inclus ce montant dans le champ "value" du fait "client". Le backend l'enregistrera comme la valeur initiale du deal pour ce client.
- Pour un client EXISTANT (qui apparaît dans la liste des clients connus) : si l'échange concerne principalement une mise à jour de la valeur du deal (ex. "j'ai signé X pour Y DH", "deal avec X est passé à Z", "contrat de X finalisé à Y"), extrais un fait "deal_update" plutôt qu'un fait "client". Utilise le nom exact tel qu'il apparaît dans la liste des clients connus pour le champ client_name du deal_update, afin que le backend puisse le relier sans ambiguïté. Si d'autres informations sur le client sont aussi mentionnées (nouvel email, nouveau contact, etc.), tu peux extraire DEUX faits : un "deal_update" pour la valeur ET un "client" pour les autres champs mis à jour.
- "vault" identifie laquelle des trois entreprises de Rachid gère la relation avec ce client — PAS l'entreprise du client lui-même (qui va dans "company"). Utilise uniquement l'un de ces identifiants exacts : ${VAULT_LIST_FOR_PROMPT}. Ne déduis "vault" que si le coffre est explicitement mentionné ou clairement évident dans le contexte ; sinon mets null. N'invente jamais cette valeur.
- Si le client est NOUVEAU (absent de la liste des clients connus ci-dessous) et que vault ne peut pas être déterminé, ET que la réponse ACTUELLE de l'assistant (celle indiquée dans la section "Réponse de l'assistant" ci-dessous, PAS une réponse mentionnée dans le contexte des échanges précédents) demande explicitement à Rachid de préciser l'entreprise (coffre), n'extrais PAS encore ce fait "client" — attends l'échange suivant, où Rachid aura fourni le vault, pour créer la fiche complète.

Règles importantes pour "next_step" (dans les faits "client") :
- next_step doit être EXACTEMENT l'une de ces valeurs — n'invente jamais une autre chaîne :
  Envoyer un devis | Planifier une visite | Négocier le prix | Attente signature | Renouvellement à discuter | Relancer | Signé | Perdu
- Choisis la valeur la plus proche du contexte de l'échange. Si l'état du client est inconnu ou non mentionné, mets next_step à null (ne l'omets pas — cf. règle ci-dessus).

Règles importantes pour "activity" :
- activity_type doit être EXACTEMENT l'une de ces valeurs — n'invente jamais une autre chaîne :
  contrat_signé | paiement_reçu | devis_accepté | devis_envoyé | relance | nouveau_lead | réunion_tenue | devis_refusé | deal_perdu | contrat_annulé | autre
- Si aucune valeur ne correspond précisément à l'événement décrit, utilise "autre".

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
- monthly_goal : month, target_value

Toutes les dates doivent être des timestamps ISO 8601 absolus, calculés à partir de la date actuelle fournie (jamais des expressions relatives comme "demain"). La date et l'heure actuelles fournies ci-dessous sont exprimées en heure du Maroc (Africa/Casablanca), décalage horaire inclus (ex. "2026-07-26T23:10:00+01:00") : calcule toute expression relative directement par rapport à cette heure locale, puis renvoie les timestamps avec ce même décalage horaire — ne les convertis JAMAIS en UTC ("Z"), car cela décalerait la date locale d'un jour selon l'heure de la journée. Pour "client", n'omets un champ que si le concept lui-même n'a pas de sens dans le contexte (par exemple pas de company pour un particulier) ; pour email/phone/location/next_step/value/importance/vault, préfère toujours null explicite à l'omission. Si l'échange ne contient aucune information digne d'être mémorisée, réponds avec un tableau vide : []`

const VALID_FACT_TYPES = new Set([
  'client',
  'goal',
  'task',
  'date',
  'deal_update',
  'meeting',
  'activity',
  'delete_client',
  'monthly_goal',
])

// Compact "Karim Benali (Marjane Holding)" style list injected into the extraction prompt so
// Claude can match a client mentioned by name to an existing record (for "client" updates and
// for client_name on deal_update/meeting/activity) instead of only ever seeing new clients.
function formatExistingClientsForPrompt(existingClients) {
  if (!Array.isArray(existingClients) || existingClients.length === 0) return ''
  const lines = existingClients
    .slice(0, 50)
    .map((c) => `- "${c.name}"${c.company ? ` (entreprise : ${c.company})` : ''}${c.vaultId ? ` — coffre : ${c.vaultId}` : ''}`)
  return `\n\nClients déjà connus (pour le champ "name" dans tes faits extraits, reprends UNIQUEMENT la valeur entre guillemets — pas l'entreprise entre parenthèses) :\n${lines.join('\n')}`
}

// Silently analyzes one exchange and returns any new facts worth remembering.
// Never throws to the caller for malformed model output — returns [] instead.
// existingClients (from getAllClients()) lets Claude recognize when the conversation refers to
// a client already on file, instead of only ever being able to extract brand-new clients.
export async function extractFacts(userContent, assistantContent, now = new Date(), existingClients = [], recentHistory = []) {
  const anthropic = getClient()

  // now.toISOString() would give the UTC instant — correct, but it forces Claude to convert to
  // Morocco time in its head before resolving "demain"/"la semaine prochaine", which is exactly
  // the kind of silent off-by-one-day mistake this fixes. Passing the Casablanca-local wall-clock
  // time (with its real offset attached) means Claude reasons in Rachid's timezone directly.
  const nowLocal = toIsoWithTimeZone(now, TIMEZONE)

  // Include up to the last 4 prior messages (2 turns) as read-only reference context so
  // multi-turn facts can be assembled — e.g. client name stated in Turn N-1 and vault provided
  // in Turn N. Claude is explicitly told NOT to re-extract facts from prior turns; they exist
  // only to resolve implicit references in the current exchange.
  let priorContext = ''
  if (Array.isArray(recentHistory) && recentHistory.length > 0) {
    const lines = recentHistory.map(
      (m) => `${m.role === 'user' ? 'Rachid' : 'Assistant'} : ${typeof m.content === 'string' ? m.content : JSON.stringify(m.content)}`
    )
    priorContext =
      '\n\nContexte des échanges précédents (pour résoudre les références implicites uniquement' +
      " — n'extrais PAS de faits de ces échanges, utilise-les uniquement pour comprendre l'échange actuel ci-dessous) :\n" +
      lines.join('\n')
  }

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: EXTRACTION_MAX_TOKENS,
    system: EXTRACTION_SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Date et heure actuelles (heure du Maroc, Africa/Casablanca) : ${nowLocal}${formatExistingClientsForPrompt(existingClients)}${priorContext}\n\nMessage de Rachid : ${userContent}\n\nRéponse de l'assistant : ${assistantContent}`,
      },
    ],
  })

  if (response.stop_reason !== 'end_turn') {
    console.warn('Extraction may have been truncated. stop_reason:', response.stop_reason)
  }
  
  const textBlock = response.content.find((block) => block.type === 'text')
  const raw = (textBlock?.text ?? '[]').replace(/```json|```/g, '').trim()

  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (f) => f && typeof f === 'object' && VALID_FACT_TYPES.has(f.fact_type) && f.content !== null && typeof f.content === 'object'
    )
  } catch (err) {
    console.error(
      'Échec du parsing de l\'extraction JSON.',
      '| stop_reason:', response.stop_reason,
      '| raw output:', raw,
      '| erreur:', err.message
    )
    return []
  }
}
