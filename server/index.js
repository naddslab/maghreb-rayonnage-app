import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import multer from 'multer'
import {
  initDb,
  closeDb,
  getAllMessages,
  clearMessages,
  insertMessage,
  getAllFacts,
  insertFact,
  updateFact,
  deleteFact,
  getAiSettings,
  saveAiSettings,
  getAllClients,
  getClientById,
  createClient,
  updateClient,
  deleteClient,
  getAllDealHistory,
  createDealHistory,
  getMonthlyRevenue,
  getRevenueByMonth,
  getMonthlyRevenueForVault,
  getRevenueByMonthForVault,
  getMonthlyGoal,
  setMonthlyGoal,
  getCurrentCasablancaMonth,
  getAllMeetings,
  getAllMeetingsWithClientName,
  createMeeting,
  getUpcomingMeetings,
  getAllActivities,
  getAllActivitiesWithClientName,
  createActivity,
  createFile,
  getFilesByClientId,
  getGeneralFiles,
  getFileById,
  deleteFile,
  getAllFiles,
  withTransaction,
} from './db.js'
import {
  getAssistantReply,
  buildSystemPrompt,
  extractFacts,
  stripMarkdown,
  SYSTEM_PROMPT,
  VAULTS,
  resolveVaultId,
  MAX_IMAGE_BYTES,
  MAX_PDF_BYTES,
} from './anthropic.js'
import { uploadFileToStorage, getFileUrl, deleteFileFromStorage } from './supabaseStorage.js'

// Files are buffered in memory (not written to disk) before being forwarded to Supabase
// Storage — appropriate for the small VM this API runs on, but caps upload size accordingly.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } })

const VALID_FACT_TYPES = new Set(['client', 'goal', 'task', 'date'])
const VALID_IMPORTANCE = new Set(['X', 'XX', 'XXX'])
const VALID_VAULT_IDS = new Set(VAULTS.map((v) => v.id))
const CLIENT_UPDATE_FIELDS = ['name', 'company', 'contact', 'email', 'phone', 'location', 'nextStep', 'value', 'importance', 'vaultId']
const TEXT_UPDATE_FIELDS = ['company', 'contact', 'email', 'phone', 'location', 'nextStep']

// Fact types extracted by extractFacts() that aren't tied to a client record and still go
// straight into the generic facts table, same as before this routing logic existed.
const SIMPLE_FACT_TYPES = new Set(['goal', 'task', 'date'])

// Exact (case-insensitive, trimmed) match only — no fuzzy/substring fallback. A substring match
// is unsafe here: "Mohammed" would ambiguously match both "Mohammed Ahmed" and "Mohammed Ali",
// silently picking whichever happens to come first. Logs the outcome either way, since a
// silently-failed lookup here is what makes deal/meeting/activity updates from chat look "stuck"
// without any visible error.
function findClientByName(clients, name) {
  if (!name) return null
  const normalized = String(name).trim().toLowerCase()
  if (!normalized) return null

  const exact = clients.find((c) => c.name && c.name.trim().toLowerCase() === normalized)
  if (exact) {
    console.log(`findClientByName("${name}") : correspondance exacte -> "${exact.name}"`)
    return exact
  }

  console.warn(`findClientByName("${name}") : aucune correspondance exacte trouvée parmi ${clients.length} client(s).`)
  return null
}


// Simple case-insensitive substring match: does the user's message mention this client by name?
// Good enough for "what's up with Karim Benali" without needing a separate extraction call.
function findMentionedClient(clients, message) {
  const lower = message.toLowerCase()
  return clients.find((c) => c.name && lower.includes(c.name.trim().toLowerCase())) || null
}

// Returns true if the message explicitly references a file or document so that general
// (non-client) file attachments are only injected into the Claude prompt when actually relevant.
// Without this gate, any file in the "general" bucket (client_id IS NULL) would be re-attached
// as a live image/document block on every single turn, distracting the model even on unrelated messages.
const FILE_KEYWORDS_RE =
  /\b(fichier|document|image|photo|capture|scan|pdf|cv|curriculum\s+vitae|contrat|accord|plan|blueprint|sch[eé]ma|brochure|catalogue|pr[eé]sentation|devis|facture|rapport|annexe|pi[eè]ce\s+jointe|excel|word|tableau)\b/i

function messageReferencesFiles(text) {
  return FILE_KEYWORDS_RE.test(text)
}

// Fetches the actual bytes for every image/PDF in the given list so Claude can read them, not
// just know they exist. Best-effort throughout: a file that fails to download or exceeds the
// Claude API's size limits is skipped with a warning rather than failing the whole chat turn.
async function filesToPromptAttachments(files) {
  const relevant = files.filter((f) => f.fileType?.startsWith('image/') || f.fileType === 'application/pdf')
  const results = []

  for (const file of relevant) {
    try {
      const url = await getFileUrl(file.filePath)
      const response = await fetch(url)
      if (!response.ok) {
        console.warn(`Téléchargement du fichier "${file.filename}" échoué (HTTP ${response.status}), ignoré.`)
        continue
      }

      const buffer = Buffer.from(await response.arrayBuffer())
      const isImage = file.fileType.startsWith('image/')
      const limit = isImage ? MAX_IMAGE_BYTES : MAX_PDF_BYTES
      if (buffer.length > limit) {
        console.warn(
          `Fichier "${file.filename}" ignoré : ${buffer.length} octets dépasse la limite de ${limit} octets pour ce type.`
        )
        continue
      }

      results.push({ filename: file.filename, fileType: file.fileType, base64: buffer.toString('base64') })
    } catch (err) {
      console.warn(`Impossible de charger le fichier "${file.filename}" pour le contexte IA, ignoré :`, err.message)
    }
  }

  return results
}

async function loadClientFilesForPrompt(clientId) {
  let files
  try {
    files = await getFilesByClientId(clientId)
  } catch (err) {
    console.warn('Impossible de récupérer les fichiers du client pour le contexte IA :', err.message)
    return []
  }
  return filesToPromptAttachments(files)
}

// General files (no client attached, e.g. a personal CV) are few enough that we can just always
// make them available to Claude every turn rather than trying to guess relevance from the
// message text — capped at a handful so a large personal library doesn't blow up request size.
async function loadGeneralFilesForPrompt(limit = 5) {
  let files
  try {
    files = await getGeneralFiles(limit)
  } catch (err) {
    console.warn('Impossible de récupérer les fichiers généraux pour le contexte IA :', err.message)
    return []
  }
  return filesToPromptAttachments(files)
}

// Splits what extractFacts() returns across the right destinations: "client" items create or
// update a row in the clients table, "deal_update"/"meeting"/"activity" attach to whichever
// existing (or just-created) client they name, and "goal"/"task"/"date" still go to the generic
// facts table as before. Runs in two passes so a brand-new client mentioned in the same exchange
// as a deal/meeting/activity about them can still be resolved, regardless of the order Claude
// returned the items in. Never throws — a malformed or unmatched item is logged and skipped so
// one bad extraction can't drop the rest of the batch.
async function persistExtractedFacts(extracted, existingClients) {
  const knownClients = [...existingClients]
  const clientItems = extracted.filter((f) => f.fact_type === 'client')
  const otherItems = extracted.filter((f) => f.fact_type !== 'client')

  for (const f of clientItems) {
    const c = f.content || {}
    const vaultId = resolveVaultId(c.vault)
    try {
      const existing = findClientByName(knownClients, c.name)
      if (existing) {
        const updates = {}
        if (c.company != null) updates.company = c.company
        if (c.contact != null) updates.contact = c.contact
        if (c.email != null) updates.email = c.email
        if (c.phone != null) updates.phone = c.phone
        if (c.location != null) updates.location = c.location
        if (c.next_step != null) updates.nextStep = c.next_step
        if (c.value != null) updates.value = c.value
        if (c.importance != null) updates.importance = c.importance
        // A client's vault is effectively permanent once known — only fill it in the first time
        // it's identified, never let a later, possibly-ambiguous mention reassign it.
        if (vaultId && !existing.vaultId) updates.vaultId = vaultId
        // Only send fields Claude actually mentioned this turn — a field left null just means
        // "not mentioned", not "clear it", so we must never overwrite existing data with null.
        if (Object.keys(updates).length > 0) {
          const updated = await updateClient(existing.id, updates)
          Object.assign(existing, updated)
        }
        // EXTRACTION_SYSTEM_PROMPT allows meeting_date on a "client" fact; create the meeting row
        // here so it is never silently dropped when Claude bundles it with the client update.
        if (c.meeting_date) {
          await createMeeting(existing.id, c.meeting_date, null, null)
        }
      } else if (c.name) {
        // Wrap createClient + createDealHistory atomically so a failed history write doesn't
        // leave an orphaned client row with no revenue record.
        const created = await withTransaction(async (tx) => {
          const newClient = await createClient(
            c.name, c.company, c.contact, c.email, c.phone, c.location, c.next_step, c.value, c.importance, vaultId, tx
          )
          // If this new client was signed with an initial deal value, record it in deal_history so
          // it shows up in the monthly revenue chart (which queries deal_history, not clients.value).
          if (c.value != null && typeof c.value === 'number' && c.value > 0) {
            await createDealHistory(newClient.id, 0, c.value, 'Client initial', tx)
          }
          return newClient
        })
        // Only add to the in-memory list after both DB writes committed successfully.
        knownClients.push(created)
        // Same meeting_date handling for newly-created clients.
        if (c.meeting_date) {
          await createMeeting(created.id, c.meeting_date, null, null)
        }
      } else {
        console.warn('Extraction "client" ignorée : nom manquant.', c)
      }
    } catch (err) {
      console.error('Échec de la synchronisation du client extrait :', c.name, err)
    }
  }

  for (const f of otherItems) {
    const c = f.content || {}
    try {
      if (SIMPLE_FACT_TYPES.has(f.fact_type)) {
        await insertFact(f.fact_type, c)
        continue
      }

      // monthly_goal isn't tied to any client — resolve straight to setMonthlyGoal(), with a
      // server-side fallback to the current Casablanca month in case Claude ever omits it despite
      // the prompt's instruction to default to "this month".
      if (f.fact_type === 'monthly_goal') {
        const month = typeof c.month === 'string' && /^\d{4}-\d{2}$/.test(c.month) ? c.month : getCurrentCasablancaMonth()
        const targetValue = Number(c.target_value)
        if (!Number.isFinite(targetValue) || targetValue < 0) {
          console.warn('Extraction "monthly_goal" ignorée : target_value invalide.', c)
          continue
        }
        await setMonthlyGoal(month, targetValue)
        continue
      }

      // delete_client gets its own dedicated path (rather than sharing the generic lookup below)
      // so every step — extraction, lookup, and the delete itself — is individually logged. Those
      // logs show up in `fly logs` and pinpoint exactly which step is failing if a deletion
      // requested in chat doesn't actually remove the client.
      if (f.fact_type === 'delete_client') {
        console.log('DELETE_CLIENT extracted:', c.client_name)

        const client = findClientByName(knownClients, c.client_name)
        console.log('Found client for deletion:', client ? client.name : 'NOT FOUND')

        if (!client) {
          console.warn('Client not found for deletion:', c.client_name)
          continue
        }

        try {
          const files = await getFilesByClientId(client.id)
          const result = await deleteClient(client.id)
          console.log('Client deleted successfully:', result)
          knownClients.splice(knownClients.indexOf(client), 1)
          // The chat reply for this turn was already sent before this runs (extraction is
          // fire-and-forget), so this confirmation can't appear in that same reply — it's saved
          // as a new assistant message and will show up the next time the conversation is loaded.
          await insertMessage('assistant', `${client.name} supprimé.`)
          for (const file of files) {
            if (file.filePath) {
              deleteFileFromStorage(file.filePath).catch((err) =>
                console.warn(`Suppression du fichier "${file.filePath}" dans le stockage a échoué (ignoré) :`, err.message)
              )
            }
          }
        } catch (err) {
          console.error('Delete failed:', err.message)
        }
        continue
      }

      const client = findClientByName(knownClients, c.client_name)
      if (!client) {
        console.warn(`Extraction "${f.fact_type}" ignorée : client "${c.client_name}" introuvable.`)
        continue
      }

      if (f.fact_type === 'deal_update') {
        await withTransaction(async (tx) => {
          const currentClient = await getClientById(client.id, tx)
          const oldValue = currentClient?.value ?? null
          await createDealHistory(client.id, oldValue, c.new_value, c.reason, tx)
          if (c.new_value != null) await updateClient(client.id, { value: c.new_value }, tx)
        })
      } else if (f.fact_type === 'meeting') {
        await createMeeting(client.id, c.meeting_date, c.notes, c.meeting_type)
      } else if (f.fact_type === 'activity') {
        await createActivity(client.id, c.activity_type, c.amount, c.description)
      } else {
        console.warn(`Type de fait extrait inconnu, ignoré : ${f.fact_type}`)
      }
    } catch (err) {
      console.error(`Échec de l'enregistrement de l'extraction "${f.fact_type}" :`, err)
    }
  }
}

const app = express()
app.use(cors())
app.use(express.json())

const API_KEY = process.env.API_KEY

if (!API_KEY) {
  console.error(
    'API_KEY manquante : ajoutez-la dans votre fichier .env (dev) ou comme secret Fly.io (prod) — voir .env.example. ' +
      'Tant qu\'elle n\'est pas définie, toutes les requêtes protégées seront refusées (401) par sécurité.'
  )
}

// Every route requires "Authorization: Bearer <API_KEY>", except the health check — Fly.io's own
// monitoring hits it without any custom header, so it has to stay public. This is a single shared
// secret (not per-user auth), appropriate for a small internal tool with one operator.
app.use((req, res, next) => {
  if (req.method === 'GET' && req.path === '/api/health') {
    return next()
  }

  const authHeader = req.headers.authorization || ''
  const [scheme, token] = authHeader.split(' ')
  if (!API_KEY || scheme !== 'Bearer' || token !== API_KEY) {
    return res.status(401).json({ error: 'Non autorisé.' })
  }

  next()
})

// Runs for every route with a :clientId param below, before the route handler: validates the id
// is a number and that the client actually exists, so every one of those routes gets consistent
// 400/404 behavior for free instead of repeating the same check in each handler.
app.param('clientId', async (req, res, next, clientId) => {
  const id = Number(clientId)
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'clientId invalide.' })
  }
  try {
    const client = await getClientById(id)
    if (!client) {
      return res.status(404).json({ error: 'Client introuvable.' })
    }
    req.clientId = id
    req.client = client
    next()
  } catch (err) {
    next(err)
  }
})

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' })
})

app.get('/api/messages', async (req, res) => {
  res.json(await getAllMessages())
})

// There's no per-conversation grouping in this app (messages is one flat, chronological table
// shared across the whole chat) — "clear" here means wipe the entire chat history, which is what
// "Nouvelle conversation" in the UI is meant to do. Accepts an optional conversationId in the
// body for forward compatibility, but it's currently unused/ignored since there's nothing to
// scope by.
app.post('/api/chat/clear', async (req, res) => {
  try {
    await clearMessages()
    res.json({ success: true })
  } catch (err) {
    console.error('Échec de la suppression de la conversation :', err)
    res.status(500).json({ success: false, error: 'Impossible de supprimer la conversation.' })
  }
})

app.post('/api/chat', async (req, res) => {
  const content = typeof req.body?.content === 'string' ? req.body.content.trim() : ''
  if (!content) {
    return res.status(400).json({ error: 'Le message ne peut pas être vide.' })
  }

  try {
    const history = await getAllMessages()
    const now = new Date()
    const aiSettings = await getAiSettings()
    const facts = await getAllFacts()
    // Best-effort: an upcoming-meetings lookup failure shouldn't block the chat reply, it just
    // means that turn's system prompt won't include the "Réunions à venir" section.
    const upcomingMeetings = await getUpcomingMeetings(20).catch((err) => {
      console.warn('Impossible de récupérer les réunions à venir pour le contexte IA :', err.message)
      return []
    })
    const systemPrompt = buildSystemPrompt(aiSettings?.system_prompt || SYSTEM_PROMPT, facts, now, upcomingMeetings)

    // Fetch clients once and share across both file-loading and extraction — single consistent
    // snapshot for the entire turn, no second DB round-trip needed.
    const allClients = await getAllClients()

    // If the message names a known client, pull their image/PDF files so Claude can actually
    // read them this turn (e.g. "que dit le contrat de Karim Benali ?") instead of only knowing
    // they exist. Also always include general (non-client) files — e.g. Rachid's own CV — so
    // he can ask "what's in my CV" without tying the file to a client. Best-effort throughout —
    // never blocks the chat reply if either lookup fails.
    let clientFiles = []
    try {
      const mentionedClient = findMentionedClient(allClients, content)
      const [mentionedClientFiles, generalFiles] = await Promise.all([
        mentionedClient ? loadClientFilesForPrompt(mentionedClient.id) : Promise.resolve([]),
        messageReferencesFiles(content) ? loadGeneralFilesForPrompt() : Promise.resolve([]),
      ])
      clientFiles = [...mentionedClientFiles, ...generalFiles]
    } catch (err) {
      console.warn('Impossible de préparer les fichiers pour cette réponse :', err.message)
    }

    // The user message is not yet in the DB, so getAllMessages() above doesn't include it.
    // Append it inline so Claude sees the full conversation including this turn, then persist
    // both messages only after Claude succeeds — a failed API call leaves nothing in history.
    const rawReply = await getAssistantReply([...history, { role: 'user', content }], systemPrompt, aiSettings?.business_context || '', clientFiles)
    const replyText = stripMarkdown(rawReply)
    const userMessage = await insertMessage('user', content)
    const assistantMessage = await insertMessage('assistant', replyText)

    // Awaited before responding so concurrent messages cannot race on the same client snapshot.
    // Inner try/catch ensures an extraction failure never prevents the reply from being sent.
    try {
      const extracted = await extractFacts(content, replyText, now, allClients)
      await persistExtractedFacts(extracted, allClients)
    } catch (err) {
      console.error('Extraction de faits échouée :', err)
    }

    res.json({ userMessage, assistantMessage })
  } catch (err) {
    console.error('Erreur lors de l\u2019appel \u00e0 l\u2019assistant IA:', err)
    res.status(500).json({
      error: "Une erreur est survenue lors de l'appel à l'assistant IA.",
    })
  }
})

app.get('/api/ai-settings', async (req, res) => {
  const settings = await getAiSettings()
  res.json(settings || { system_prompt: SYSTEM_PROMPT, business_context: '', updated_at: null })
})

app.put('/api/ai-settings', async (req, res) => {
  const systemPrompt = typeof req.body?.system_prompt === 'string' ? req.body.system_prompt : ''
  const businessContext = typeof req.body?.business_context === 'string' ? req.body.business_context : ''
  if (!systemPrompt.trim()) {
    return res.status(400).json({ error: 'Le prompt système ne peut pas être vide.' })
  }
  res.json(await saveAiSettings(systemPrompt, businessContext))
})

app.get('/api/facts', async (req, res) => {
  res.json(await getAllFacts())
})

app.post('/api/facts', async (req, res) => {
  const { fact_type, content } = req.body || {}
  if (!VALID_FACT_TYPES.has(fact_type) || typeof content !== 'object' || content === null) {
    return res.status(400).json({ error: 'fact_type ou content invalide.' })
  }
  res.status(201).json(await insertFact(fact_type, content))
})

app.put('/api/facts/:id', async (req, res) => {
  const id = Number(req.params.id)
  const { fact_type, content } = req.body || {}
  if (!Number.isInteger(id) || !VALID_FACT_TYPES.has(fact_type) || typeof content !== 'object' || content === null) {
    return res.status(400).json({ error: 'fact_type ou content invalide.' })
  }
  const updated = await updateFact(id, fact_type, content)
  if (updated == null) return res.status(404).json({ error: 'Fait introuvable.' })
  res.json(updated)
})

app.delete('/api/facts/:id', async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'id invalide.' })
  }
  await deleteFact(id)
  res.status(204).end()
})

// ---------- Clients ----------

app.get('/api/clients', async (req, res) => {
  res.json(await getAllClients())
})

app.get('/api/clients/:clientId', (req, res) => {
  res.json(req.client)
})

app.post('/api/clients', async (req, res) => {
  const { name, company, contact, email, phone, location, nextStep, value, importance, vaultId } = req.body || {}
  if (typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'Le nom du client est requis.' })
  }
  for (const [field, val] of [['company', company], ['contact', contact], ['email', email],
                               ['phone', phone], ['location', location], ['nextStep', nextStep]]) {
    if (val !== undefined && val !== null && typeof val !== 'string') {
      return res.status(400).json({ error: `Le champ "${field}" doit être une chaîne de caractères ou null.` })
    }
  }
  if (value !== undefined && value !== null && typeof value !== 'number') {
    return res.status(400).json({ error: 'La valeur du client doit être un nombre.' })
  }
  if (importance !== undefined && importance !== null && !VALID_IMPORTANCE.has(importance)) {
    return res.status(400).json({ error: "L'importance doit être 'X', 'XX' ou 'XXX'." })
  }
  if (vaultId !== undefined && vaultId !== null && !VALID_VAULT_IDS.has(vaultId)) {
    return res.status(400).json({ error: `vaultId doit être l'un de : ${[...VALID_VAULT_IDS].join(', ')}.` })
  }
  const client = await withTransaction(async (tx) => {
    const created = await createClient(name, company, contact, email, phone, location, nextStep, value, importance, vaultId, tx)
    if (value != null && typeof value === 'number' && value > 0) {
      await createDealHistory(created.id, 0, value, 'Client initial', tx)
    }
    return created
  })
  res.status(201).json(client)
})

app.put('/api/clients/:clientId', async (req, res) => {
  const updates = req.body
  if (typeof updates !== 'object' || updates === null || Array.isArray(updates)) {
    return res.status(400).json({ error: 'Le corps de la requête doit être un objet JSON.' })
  }
  if (!CLIENT_UPDATE_FIELDS.some((field) => field in updates)) {
    return res.status(400).json({ error: 'Aucun champ valide à mettre à jour.' })
  }
  if ('name' in updates && (typeof updates.name !== 'string' || !updates.name.trim())) {
    return res.status(400).json({ error: 'Le nom du client ne peut pas être vide.' })
  }
  if ('value' in updates && updates.value !== null && typeof updates.value !== 'number') {
    return res.status(400).json({ error: 'La valeur du client doit être un nombre.' })
  }
  if ('importance' in updates && updates.importance !== null && !VALID_IMPORTANCE.has(updates.importance)) {
    return res.status(400).json({ error: "L'importance doit être 'X', 'XX' ou 'XXX'." })
  }
  if ('vaultId' in updates && updates.vaultId !== null && !VALID_VAULT_IDS.has(updates.vaultId)) {
    return res.status(400).json({ error: `vaultId doit être l'un de : ${[...VALID_VAULT_IDS].join(', ')}.` })
  }
  for (const field of TEXT_UPDATE_FIELDS) {
    if (field in updates && updates[field] !== null && typeof updates[field] !== 'string') {
      return res.status(400).json({ error: `Le champ "${field}" doit être une chaîne de caractères ou null.` })
    }
  }

  const oldValue = req.client.value
  const updated = await withTransaction(async (tx) => {
    const u = await updateClient(req.clientId, updates, tx)
    if ('value' in updates && updates.value !== oldValue) {
      await createDealHistory(req.clientId, oldValue, updates.value, 'Mise à jour REST', tx)
    }
    return u
  })
  res.json(updated)
})

app.delete('/api/clients/:clientId', async (req, res) => {
  // Fetch file paths before deleting — the DB CASCADE removes file rows together with the
  // client, so this lookup must happen first or the paths are gone before we can read them.
  const files = await getFilesByClientId(req.clientId)
  await deleteClient(req.clientId)
  // Storage deletions run after the DB commit and are intentionally fire-and-forget: a
  // Supabase Storage failure must never roll back an already-committed client deletion.
  for (const file of files) {
    if (file.filePath) {
      deleteFileFromStorage(file.filePath).catch((err) =>
        console.warn(`Suppression du fichier "${file.filePath}" dans le stockage a échoué (ignoré) :`, err.message)
      )
    }
  }
  res.json({ deleted: true })
})

// ---------- Deal history ----------

app.get('/api/clients/:clientId/deal-history', async (req, res) => {
  res.json(await getAllDealHistory(req.clientId))
})

app.post('/api/clients/:clientId/deal-history', async (req, res) => {
  const { oldValue, newValue, reason } = req.body || {}
  if (oldValue !== undefined && oldValue !== null && typeof oldValue !== 'number') {
    return res.status(400).json({ error: 'oldValue doit être un nombre.' })
  }
  if (newValue !== undefined && newValue !== null && typeof newValue !== 'number') {
    return res.status(400).json({ error: 'newValue doit être un nombre.' })
  }
  if (reason !== undefined && reason !== null && typeof reason !== 'string') {
    return res.status(400).json({ error: 'reason doit être une chaîne de caractères.' })
  }
  const record = await createDealHistory(req.clientId, oldValue, newValue, reason)
  res.status(201).json(record)
})

// ---------- Revenue & goals ----------

const MONTH_FORMAT_RE = /^\d{4}-\d{2}$/

app.get('/api/revenue/monthly', async (req, res) => {
  const month = typeof req.query.month === 'string' ? req.query.month : ''
  if (!MONTH_FORMAT_RE.test(month)) {
    return res.status(400).json({ error: 'Paramètre "month" invalide ou manquant (attendu "YYYY-MM").' })
  }
  const revenue = await getMonthlyRevenue(month)
  res.json({ month, revenue })
})

app.get('/api/revenue/chart', async (req, res) => {
  const monthsBack = Number(req.query.monthsBack)
  const data = await getRevenueByMonth(Number.isInteger(monthsBack) && monthsBack > 0 ? monthsBack : 12)
  res.json(data)
})

app.get('/api/goals/:month', async (req, res) => {
  const { month } = req.params
  if (!MONTH_FORMAT_RE.test(month)) {
    return res.status(400).json({ error: 'Paramètre "month" invalide (attendu "YYYY-MM").' })
  }
  const targetValue = await getMonthlyGoal(month)
  res.json({ month, targetValue })
})

app.put('/api/goals/:month', async (req, res) => {
  const { month } = req.params
  if (!MONTH_FORMAT_RE.test(month)) {
    return res.status(400).json({ error: 'Paramètre "month" invalide (attendu "YYYY-MM").' })
  }
  const targetValue = Number(req.body?.targetValue)
  if (!Number.isFinite(targetValue) || targetValue < 0) {
    return res.status(400).json({ error: '"targetValue" doit être un nombre positif.' })
  }
  const result = await setMonthlyGoal(month, targetValue)
  res.json(result)
})

app.get('/api/vaults/:vaultId/revenue/monthly', async (req, res) => {
  const { vaultId } = req.params
  if (!VALID_VAULT_IDS.has(vaultId)) {
    return res.status(400).json({ error: `vaultId doit être l'un de : ${[...VALID_VAULT_IDS].join(', ')}.` })
  }
  const month = typeof req.query.month === 'string' ? req.query.month : ''
  if (!MONTH_FORMAT_RE.test(month)) {
    return res.status(400).json({ error: 'Paramètre "month" invalide ou manquant (attendu "YYYY-MM").' })
  }
  const revenue = await getMonthlyRevenueForVault(vaultId, month)
  res.json({ vaultId, month, revenue })
})

app.get('/api/vaults/:vaultId/revenue/chart', async (req, res) => {
  const { vaultId } = req.params
  if (!VALID_VAULT_IDS.has(vaultId)) {
    return res.status(400).json({ error: `vaultId doit être l'un de : ${[...VALID_VAULT_IDS].join(', ')}.` })
  }
  const monthsBack = Number(req.query.monthsBack)
  const data = await getRevenueByMonthForVault(vaultId, Number.isInteger(monthsBack) && monthsBack > 0 ? monthsBack : 12)
  res.json(data)
})

// ---------- Meetings ----------

// Bulk endpoint: all meetings across every client, with client_name included via JOIN.
// Uses no :clientId param so the app.param middleware (which runs getClientById per request)
// is never invoked — one DB query instead of N+1.
app.get('/api/meetings', async (req, res) => {
  res.json(await getAllMeetingsWithClientName())
})

// ---------- Activities ----------

// Bulk endpoint: all activities across every client, with client_name included via JOIN.
app.get('/api/activities', async (req, res) => {
  res.json(await getAllActivitiesWithClientName())
})

// ---------- Per-client meetings ----------

app.get('/api/clients/:clientId/meetings', async (req, res) => {
  res.json(await getAllMeetings(req.clientId))
})

app.post('/api/clients/:clientId/meetings', async (req, res) => {
  const { meetingDate, notes, meetingType } = req.body || {}
  if (typeof meetingDate !== 'string' || !meetingDate.trim()) {
    return res.status(400).json({ error: 'meetingDate est requis.' })
  }
  if (notes !== undefined && notes !== null && typeof notes !== 'string') {
    return res.status(400).json({ error: 'notes doit être une chaîne de caractères.' })
  }
  if (meetingType !== undefined && meetingType !== null && typeof meetingType !== 'string') {
    return res.status(400).json({ error: 'meetingType doit être une chaîne de caractères.' })
  }
  const meeting = await createMeeting(req.clientId, meetingDate, notes, meetingType)
  res.status(201).json(meeting)
})

// ---------- Per-client activities ----------

app.get('/api/clients/:clientId/activities', async (req, res) => {
  res.json(await getAllActivities(req.clientId))
})

app.post('/api/clients/:clientId/activities', async (req, res) => {
  const { activityType, amount, description } = req.body || {}
  if (amount !== undefined && amount !== null && typeof amount !== 'number') {
    return res.status(400).json({ error: 'amount doit être un nombre.' })
  }
  if (activityType !== undefined && activityType !== null && typeof activityType !== 'string') {
    return res.status(400).json({ error: 'activityType doit être une chaîne de caractères.' })
  }
  if (description !== undefined && description !== null && typeof description !== 'string') {
    return res.status(400).json({ error: 'description doit être une chaîne de caractères.' })
  }
  const activity = await createActivity(req.clientId, activityType, amount, description)
  res.status(201).json(activity)
})

// ---------- Files ----------

app.get('/api/clients/:clientId/files', async (req, res) => {
  res.json(await getFilesByClientId(req.clientId))
})

app.post('/api/clients/:clientId/files', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "Aucun fichier reçu (champ 'file' manquant)." })
  }

  try {
    const filePath = await uploadFileToStorage(req.file.buffer, req.file.originalname, req.file.mimetype)
    const file = await createFile(req.clientId, req.file.originalname, filePath, req.file.mimetype, req.file.size)
    const url = await getFileUrl(filePath)
    res.status(201).json({ ...file, url })
  } catch (err) {
    console.error("Échec de l'envoi du fichier :", err)
    res.status(500).json({ error: "Échec de l'envoi du fichier." })
  }
})

// General file upload: not tied to any client (e.g. a personal document attached in chat
// without specifying who it's for). Deliberately its own route rather than reusing
// /api/clients/:clientId/files, since that route's :clientId param is validated by
// app.param('clientId', ...) below and must resolve to a real client.
app.post('/api/files', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "Aucun fichier reçu (champ 'file' manquant)." })
  }

  try {
    const filePath = await uploadFileToStorage(req.file.buffer, req.file.originalname, req.file.mimetype)
    const file = await createFile(null, req.file.originalname, filePath, req.file.mimetype, req.file.size)
    const url = await getFileUrl(filePath)
    res.status(201).json({ ...file, url })
  } catch (err) {
    console.error("Échec de l'envoi du fichier :", err)
    res.status(500).json({ error: "Échec de l'envoi du fichier." })
  }
})

app.get('/api/files/general', async (req, res) => {
  res.json(await getGeneralFiles())
})

app.get('/api/files', async (req, res) => {
  res.json(await getAllFiles())
})

app.get('/api/files/:fileId/url', async (req, res) => {
  const id = Number(req.params.fileId)
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'fileId invalide.' })
  }
  const file = await getFileById(id)
  if (!file) {
    return res.status(404).json({ error: 'Fichier introuvable.' })
  }
  const url = await getFileUrl(file.filePath)
  res.json({ url })
})

app.delete('/api/files/:fileId', async (req, res) => {
  const id = Number(req.params.fileId)
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'fileId invalide.' })
  }

  const file = await getFileById(id)
  if (!file) {
    return res.status(404).json({ error: 'Fichier introuvable.' })
  }

  try {
    await deleteFileFromStorage(file.filePath)
  } catch (err) {
    // Don't let a storage-side failure (e.g. already missing, or a transient Supabase error)
    // block removing the now-broken reference from the database.
    console.warn(`Suppression du fichier ${id} dans le stockage a échoué (on continue) :`, err.message)
  }

  const result = await deleteFile(id)
  res.json(result)
})

// Catches errors from any route above (including rejected promises in async handlers,
// which Express 5 forwards here automatically) so the API always replies with JSON —
// never Express's default HTML error page, which would break the frontend's res.json().
app.use((req, res) => {
  res.status(404).json({ error: 'Route introuvable.' })
})

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    const message =
      err.code === 'LIMIT_FILE_SIZE' ? 'Le fichier dépasse la taille maximale autorisée (10 Mo).' : "Erreur lors de l'envoi du fichier."
    return res.status(400).json({ error: message })
  }
  console.error('Erreur serveur non gérée :', err)
  res.status(500).json({ error: 'Une erreur interne est survenue.' })
})

const PORT = process.env.PORT || 8787

let server

initDb()
  .then(() => {
    server = app.listen(PORT, () => {
      console.log(`API assistant IA prête sur http://localhost:${PORT}`)
    })
  })
  .catch((err) => {
    console.error('Impossible d\u2019initialiser la base de données :', err)
    process.exit(1)
  })

// Platforms like Fly.io and Railway send SIGTERM before restarting/redeploying a container —
// close connections cleanly instead of dropping them mid-request.
async function shutdown() {
  console.log('Arrêt en cours, fermeture des connexions...')
  await new Promise((resolve) => {
    if (!server) return resolve()
    const timeout = setTimeout(() => {
      console.warn('server.close() timeout — forçage de la fermeture.')
      resolve()
    }, 5000)
    server.close(() => {
      clearTimeout(timeout)
      resolve()
    })
  })
  await closeDb().catch((err) => console.error('closeDb on shutdown failed:', err))
  process.exit(0)
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
