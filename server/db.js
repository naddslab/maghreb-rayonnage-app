import pg from 'pg'
import { SYSTEM_PROMPT } from './anthropic.js'

const { Pool } = pg

const DEFAULT_USER_ID = 'rachid'

const DEFAULT_BUSINESS_CONTEXT = `Maghreb Rayonnage — groupe spécialisé dans la conception, la fabrication et l'installation de systèmes de rayonnage industriel, mezzanines et solutions de stockage au Maroc.

Coffres actifs : Maghreb Rayonnage (siège, Casablanca), AZ Rayonnage (Tanger), Top Rayonnage (Marrakech).

Délai moyen de fabrication : 4 à 6 semaines. Garantie structures métalliques : 5 ans.
Grille tarifaire indicative : rayonnage à palettes à partir de 850 DH/mètre linéaire, mezzanines sur devis selon charge et surface.
Politique commerciale : remise de 5% au-delà de 300 000 DH, paiement 30% à la commande / 70% à la livraison.`

if (!process.env.DATABASE_URL) {
  throw new Error(
    'DATABASE_URL manquante. Ajoutez la chaîne de connexion PostgreSQL (Supabase) dans votre fichier .env à la racine du projet.'
  )
}

// Supabase's PostgreSQL requires SSL; rejectUnauthorized: false avoids self-signed chain issues
// in most managed environments (local dev, Railway, Fly.io) without requiring a CA bundle.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

// Idle clients can be dropped by the DB provider at any time; without this listener that
// surfaces as an uncaught exception and takes the whole process down.
pool.on('error', (err) => {
  console.error('Erreur inattendue du pool PostgreSQL :', err)
})

function rowToFact(row) {
  if (!row) return null
  let content = {}
  try {
    content = JSON.parse(row.content)
  } catch {
    content = {}
  }
  return { id: row.id, fact_type: row.fact_type, content, created_at: row.created_at, updated_at: row.updated_at }
}

export async function getAllMessages() {
  const { rows } = await pool.query('SELECT id, role, content, timestamp FROM messages ORDER BY id ASC')
  return rows
}

export async function insertMessage(role, content) {
  const timestamp = new Date().toISOString()
  const { rows } = await pool.query(
    'INSERT INTO messages (role, content, timestamp) VALUES ($1, $2, $3) RETURNING id, role, content, timestamp',
    [role, content, timestamp]
  )
  return rows[0]
}

export async function clearMessages() {
  await pool.query('DELETE FROM messages')
}

export async function getAllFacts() {
  const { rows } = await pool.query('SELECT * FROM facts ORDER BY id DESC')
  return rows.map(rowToFact)
}

export async function insertFact(factType, content) {
  const now = new Date().toISOString()
  const { rows } = await pool.query(
    'INSERT INTO facts (fact_type, content, created_at, updated_at) VALUES ($1, $2, $3, $4) RETURNING *',
    [factType, JSON.stringify(content ?? {}), now, now]
  )
  return rowToFact(rows[0])
}

export async function updateFact(id, factType, content) {
  const now = new Date().toISOString()
  const { rows } = await pool.query(
    'UPDATE facts SET fact_type = $1, content = $2, updated_at = $3 WHERE id = $4 RETURNING *',
    [factType, JSON.stringify(content ?? {}), now, id]
  )
  return rowToFact(rows[0])
}

export async function deleteFact(id) {
  await pool.query('DELETE FROM facts WHERE id = $1', [id])
}

export async function getAiSettings(userId = DEFAULT_USER_ID) {
  const { rows } = await pool.query('SELECT * FROM ai_settings WHERE user_id = $1', [userId])
  return rows[0] || null
}

export async function saveAiSettings(systemPrompt, businessContext, userId = DEFAULT_USER_ID) {
  const now = new Date().toISOString()
  const { rows } = await pool.query(
    `INSERT INTO ai_settings (user_id, system_prompt, business_context, updated_at)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id) DO UPDATE SET system_prompt = $2, business_context = $3, updated_at = $4
     RETURNING *`,
    [userId, systemPrompt, businessContext, now]
  )
  return rows[0]
}

// ---------- Clients ----------

function rowToClient(row) {
  if (!row) return null
  return {
    id: row.id,
    name: row.name,
    company: row.company,
    contact: row.contact,
    email: row.email,
    phone: row.phone,
    location: row.location,
    nextStep: row.next_step,
    value: row.value === null ? null : Number(row.value),
    importance: row.importance,
    vaultId: row.vault_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function getAllClients() {
  try {
    const { rows } = await pool.query('SELECT * FROM clients ORDER BY id DESC')
    return rows.map(rowToClient)
  } catch (err) {
    throw new Error(`Impossible de récupérer la liste des clients : ${err.message}`)
  }
}

export async function getClientById(clientId) {
  try {
    const { rows } = await pool.query('SELECT * FROM clients WHERE id = $1', [clientId])
    return rowToClient(rows[0])
  } catch (err) {
    throw new Error(`Impossible de récupérer le client ${clientId} : ${err.message}`)
  }
}

export async function createClient(name, company, contact, email, phone, location, nextStep, value, importance, vaultId) {
  if (!name || !String(name).trim()) {
    throw new Error('Le nom du client est requis.')
  }
  const now = new Date().toISOString()
  try {
    const { rows } = await pool.query(
      `INSERT INTO clients (name, company, contact, email, phone, location, next_step, value, importance, vault_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11)
       RETURNING *`,
      [name, company ?? null, contact ?? null, email ?? null, phone ?? null, location ?? null, nextStep ?? null, value ?? null, importance ?? null, vaultId ?? null, now]
    )
    return rowToClient(rows[0])
  } catch (err) {
    throw new Error(`Impossible de créer le client "${name}" : ${err.message}`)
  }
}

// Maps the camelCase keys callers use in `updates` to the snake_case columns in the clients
// table, and only ever updates fields explicitly present in `updates` — anything else on the
// row is left untouched.
const CLIENT_FIELD_TO_COLUMN = {
  name: 'name',
  company: 'company',
  contact: 'contact',
  email: 'email',
  phone: 'phone',
  location: 'location',
  nextStep: 'next_step',
  value: 'value',
  importance: 'importance',
  vaultId: 'vault_id',
}

export async function updateClient(clientId, updates = {}) {
  const entries = Object.entries(updates).filter(([key]) => CLIENT_FIELD_TO_COLUMN[key])
  if (entries.length === 0) {
    throw new Error('Aucun champ valide à mettre à jour pour ce client.')
  }

  const setClauses = entries.map(([key], i) => `${CLIENT_FIELD_TO_COLUMN[key]} = $${i + 1}`)
  const values = entries.map(([, value]) => value)
  const updatedAtIndex = values.length + 1
  const clientIdIndex = values.length + 2
  values.push(new Date().toISOString(), clientId)

  try {
    const { rows } = await pool.query(
      `UPDATE clients SET ${setClauses.join(', ')}, updated_at = $${updatedAtIndex}
       WHERE id = $${clientIdIndex}
       RETURNING *`,
      values
    )
    return rowToClient(rows[0])
  } catch (err) {
    throw new Error(`Impossible de mettre à jour le client ${clientId} : ${err.message}`)
  }
}

export async function deleteClient(clientId) {
  try {
    const { rowCount } = await pool.query('DELETE FROM clients WHERE id = $1', [clientId])
    return { deleted: rowCount > 0 }
  } catch (err) {
    throw new Error(`Impossible de supprimer le client ${clientId} : ${err.message}`)
  }
}

// ---------- Deal history ----------

function rowToDealHistory(row) {
  if (!row) return null
  return {
    id: row.id,
    clientId: row.client_id,
    oldValue: row.old_value === null ? null : Number(row.old_value),
    newValue: row.new_value === null ? null : Number(row.new_value),
    reason: row.reason,
    createdAt: row.created_at,
  }
}

export async function getAllDealHistory(clientId) {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM deal_history WHERE client_id = $1 ORDER BY created_at ASC, id ASC',
      [clientId]
    )
    return rows.map(rowToDealHistory)
  } catch (err) {
    throw new Error(`Impossible de récupérer l'historique des offres du client ${clientId} : ${err.message}`)
  }
}

export async function createDealHistory(clientId, oldValue, newValue, reason) {
  const now = new Date().toISOString()
  try {
    const { rows } = await pool.query(
      `INSERT INTO deal_history (client_id, old_value, new_value, reason, created_at)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [clientId, oldValue ?? null, newValue ?? null, reason ?? null, now]
    )
    return rowToDealHistory(rows[0])
  } catch (err) {
    if (err.code === '23503') {
      throw new Error(`Client introuvable (id ${clientId}) : impossible d'ajouter un historique d'offre.`)
    }
    throw new Error(`Impossible de créer l'historique d'offre pour le client ${clientId} : ${err.message}`)
  }
}

// ---------- Meetings ----------

function rowToMeeting(row) {
  if (!row) return null
  return {
    id: row.id,
    clientId: row.client_id,
    meetingDate: row.meeting_date,
    notes: row.notes,
    meetingType: row.meeting_type,
    createdAt: row.created_at,
  }
}

export async function getAllMeetings(clientId) {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM meetings WHERE client_id = $1 ORDER BY meeting_date ASC, id ASC',
      [clientId]
    )
    return rows.map(rowToMeeting)
  } catch (err) {
    throw new Error(`Impossible de récupérer les réunions du client ${clientId} : ${err.message}`)
  }
}

export async function createMeeting(clientId, meetingDate, notes, meetingType) {
  if (!meetingDate) {
    throw new Error('La date de la réunion est requise.')
  }
  const now = new Date().toISOString()
  try {
    const { rows } = await pool.query(
      `INSERT INTO meetings (client_id, meeting_date, notes, meeting_type, created_at)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [clientId, meetingDate, notes ?? null, meetingType ?? null, now]
    )
    return rowToMeeting(rows[0])
  } catch (err) {
    if (err.code === '23503') {
      throw new Error(`Client introuvable (id ${clientId}) : impossible de créer la réunion.`)
    }
    throw new Error(`Impossible de créer la réunion pour le client ${clientId} : ${err.message}`)
  }
}

// ---------- Activities ----------

function rowToActivity(row) {
  if (!row) return null
  return {
    id: row.id,
    clientId: row.client_id,
    activityType: row.activity_type,
    amount: row.amount === null ? null : Number(row.amount),
    description: row.description,
    createdAt: row.created_at,
  }
}

export async function getAllActivities(clientId) {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM activities WHERE client_id = $1 ORDER BY created_at DESC, id DESC',
      [clientId]
    )
    return rows.map(rowToActivity)
  } catch (err) {
    throw new Error(`Impossible de récupérer les activités du client ${clientId} : ${err.message}`)
  }
}

export async function createActivity(clientId, activityType, amount, description) {
  const now = new Date().toISOString()
  try {
    const { rows } = await pool.query(
      `INSERT INTO activities (client_id, activity_type, amount, description, created_at)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [clientId, activityType ?? null, amount ?? null, description ?? null, now]
    )
    return rowToActivity(rows[0])
  } catch (err) {
    if (err.code === '23503') {
      throw new Error(`Client introuvable (id ${clientId}) : impossible de créer l'activité.`)
    }
    throw new Error(`Impossible de créer l'activité pour le client ${clientId} : ${err.message}`)
  }
}

// ---------- Files ----------

function rowToFile(row) {
  if (!row) return null
  return {
    id: row.id,
    clientId: row.client_id,
    filename: row.filename,
    filePath: row.file_path,
    fileType: row.file_type,
    fileSize: row.file_size === null ? null : Number(row.file_size),
    createdAt: row.created_at,
  }
}

export async function createFile(clientId, filename, filePath, fileType, fileSize) {
  if (!filename || !String(filename).trim()) {
    throw new Error('Le nom du fichier est requis.')
  }
  if (!filePath || !String(filePath).trim()) {
    throw new Error("Le chemin du fichier est requis.")
  }
  const now = new Date().toISOString()
  try {
    const { rows } = await pool.query(
      `INSERT INTO files (client_id, filename, file_path, file_type, file_size, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [clientId, filename, filePath, fileType ?? null, fileSize ?? null, now]
    )
    return rowToFile(rows[0])
  } catch (err) {
    if (err.code === '23503') {
      throw new Error(`Client introuvable (id ${clientId}) : impossible d'enregistrer le fichier.`)
    }
    throw new Error(`Impossible d'enregistrer le fichier "${filename}" pour le client ${clientId} : ${err.message}`)
  }
}

export async function getFilesByClientId(clientId) {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM files WHERE client_id = $1 ORDER BY created_at DESC, id DESC',
      [clientId]
    )
    return rows.map(rowToFile)
  } catch (err) {
    throw new Error(`Impossible de récupérer les fichiers du client ${clientId} : ${err.message}`)
  }
}

export async function getFileById(fileId) {
  try {
    const { rows } = await pool.query('SELECT * FROM files WHERE id = $1', [fileId])
    return rowToFile(rows[0])
  } catch (err) {
    throw new Error(`Impossible de récupérer le fichier ${fileId} : ${err.message}`)
  }
}

export async function deleteFile(fileId) {
  try {
    const { rowCount } = await pool.query('DELETE FROM files WHERE id = $1', [fileId])
    return { deleted: rowCount > 0 }
  } catch (err) {
    throw new Error(`Impossible de supprimer le fichier ${fileId} : ${err.message}`)
  }
}

export async function getAllFiles() {
  try {
    const { rows } = await pool.query('SELECT * FROM files ORDER BY created_at DESC, id DESC')
    return rows.map(rowToFile)
  } catch (err) {
    throw new Error(`Impossible de récupérer la liste des fichiers : ${err.message}`)
  }
}

// Tracks one-time setup tasks (e.g. demo-data seeding) that should never repeat, even if the
// table they seed is later emptied on purpose (e.g. a user manually clearing demo data before
// handing the app to someone else). Gating on this instead of "is the table empty?" means a
// deliberate clear stays cleared across restarts/redeploys.
async function hasSeeded(key) {
  const { rows } = await pool.query('SELECT 1 FROM seed_state WHERE key = $1', [key])
  return rows.length > 0
}

async function markSeeded(key) {
  await pool.query(
    'INSERT INTO seed_state (key, seeded_at) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING',
    [key, new Date().toISOString()]
  )
}

// Seed a handful of realistic example facts the first time this app ever runs, so the Base de
// connaissances section in Settings isn't empty before the assistant has extracted anything for
// real. Runs at most once ever (see hasSeeded/markSeeded) — deleting all facts later does not
// bring the demo data back.
async function seedFactsIfEmpty() {
  if (await hasSeeded('facts')) return

  const { rows } = await pool.query('SELECT COUNT(*) AS c FROM facts')
  if (Number(rows[0].c) > 0) {
    await markSeeded('facts')
    return
  }

  const now = new Date()
  const tomorrow9am = new Date(now)
  tomorrow9am.setDate(now.getDate() + 1)
  tomorrow9am.setHours(9, 0, 0, 0)
  const in3Days2pm = new Date(now)
  in3Days2pm.setDate(now.getDate() + 3)
  in3Days2pm.setHours(14, 0, 0, 0)
  const endOfMonth6pm = new Date(now.getFullYear(), now.getMonth() + 1, 0, 18, 0, 0)

  const seedFacts = [
    {
      fact_type: 'client',
      content: {
        name: 'Karim Benali',
        company: 'Marjane Holding',
        contact: 'karim.benali@marjaneholding.ma',
        meetingDate: '',
        notes: 'Attente de signature du devis rayonnage industriel.',
      },
    },
    {
      fact_type: 'client',
      content: {
        name: 'Fatima Zahra Amrani',
        company: 'OCP Group',
        contact: 'fatimazahra.amrani@ocpgroup.ma',
        meetingDate: tomorrow9am.toISOString(),
        notes: 'Présentation du devis rayonnage prévue.',
      },
    },
    {
      fact_type: 'goal',
      content: {
        description: "Atteindre 130 000 DH de chiffre d'affaires ce mois-ci sur Maghreb Rayonnage",
        targetDate: endOfMonth6pm.toISOString(),
      },
    },
    {
      fact_type: 'task',
      content: {
        description: 'Relancer Bricoma sur leur devis en attente',
        dueDate: in3Days2pm.toISOString(),
      },
    },
    {
      fact_type: 'date',
      content: {
        label: 'Présentation devis rayonnage',
        datetime: tomorrow9am.toISOString(),
        relatedTo: 'OCP Group',
      },
    },
  ]

  for (const f of seedFacts) {
    await insertFact(f.fact_type, f.content)
  }

  await markSeeded('facts')
}

// Seed the default persona/business context the first time this app ever runs, so it behaves
// the same way before Rachid ever visits Réglages as it does after. Runs at most once ever —
// if the ai_settings row is later deleted on purpose, this will not silently recreate it.
async function seedAiSettingsIfMissing() {
  if (await hasSeeded('ai_settings')) return

  if (!(await getAiSettings())) {
    await saveAiSettings(SYSTEM_PROMPT, DEFAULT_BUSINESS_CONTEXT)
  }

  await markSeeded('ai_settings')
}

// Creates all tables (if missing) and seeds first-run data. Must be awaited before the
// HTTP server starts accepting requests.
export async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
      content TEXT NOT NULL,
      timestamp TEXT NOT NULL
    )
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS facts (
      id SERIAL PRIMARY KEY,
      fact_type TEXT NOT NULL CHECK (fact_type IN ('client', 'goal', 'task', 'date')),
      content TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ai_settings (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL UNIQUE,
      system_prompt TEXT NOT NULL,
      business_context TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS clients (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      company TEXT,
      contact TEXT,
      email TEXT,
      phone TEXT,
      location TEXT,
      next_step TEXT,
      value NUMERIC,
      importance TEXT CHECK (importance IN ('X', 'XX', 'XXX')),
      vault_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `)

  // Backfills vault_id on databases created before vault tracking existed — CREATE TABLE IF NOT
  // EXISTS above is a no-op once the table already exists, so older deployments need this to pick
  // up the new column.
  await pool.query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS vault_id TEXT`)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS deal_history (
      id SERIAL PRIMARY KEY,
      client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      old_value NUMERIC,
      new_value NUMERIC,
      reason TEXT,
      created_at TEXT NOT NULL
    )
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS meetings (
      id SERIAL PRIMARY KEY,
      client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      meeting_date TEXT NOT NULL,
      notes TEXT,
      meeting_type TEXT,
      created_at TEXT NOT NULL
    )
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS activities (
      id SERIAL PRIMARY KEY,
      client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      activity_type TEXT,
      amount NUMERIC,
      description TEXT,
      created_at TEXT NOT NULL
    )
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS files (
      id SERIAL PRIMARY KEY,
      client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      filename TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_type TEXT,
      file_size INTEGER,
      created_at TEXT NOT NULL
    )
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS seed_state (
      key TEXT PRIMARY KEY,
      seeded_at TEXT NOT NULL
    )
  `)

  await seedFactsIfEmpty()
  await seedAiSettingsIfMissing()
}

export async function closeDb() {
  await pool.end()
}
