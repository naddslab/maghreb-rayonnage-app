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

// Seed a handful of realistic example facts on first run so the Base de connaissances
// section in Settings isn't empty before the assistant has extracted anything for real.
async function seedFactsIfEmpty() {
  const { rows } = await pool.query('SELECT COUNT(*) AS c FROM facts')
  if (Number(rows[0].c) > 0) return

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
}

// Seed the default persona/business context on first run, so the app behaves the same
// way before Rachid ever visits Réglages as it does after — and Settings shows what's really used.
async function seedAiSettingsIfMissing() {
  if (await getAiSettings()) return
  await saveAiSettings(SYSTEM_PROMPT, DEFAULT_BUSINESS_CONTEXT)
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

  await seedFactsIfEmpty()
  await seedAiSettingsIfMissing()
}

export async function closeDb() {
  await pool.end()
}
