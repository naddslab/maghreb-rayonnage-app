import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import {
  initDb,
  closeDb,
  getAllMessages,
  insertMessage,
  getAllFacts,
  insertFact,
  updateFact,
  deleteFact,
  getAiSettings,
  saveAiSettings,
} from './db.js'
import { getAssistantReply, buildSystemPrompt, extractFacts, stripMarkdown, SYSTEM_PROMPT } from './anthropic.js'

const VALID_FACT_TYPES = new Set(['client', 'goal', 'task', 'date'])

const app = express()
app.use(cors())
app.use(express.json())

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' })
})

app.get('/api/messages', async (req, res) => {
  res.json(await getAllMessages())
})

app.post('/api/chat', async (req, res) => {
  const content = typeof req.body?.content === 'string' ? req.body.content.trim() : ''
  if (!content) {
    return res.status(400).json({ error: 'Le message ne peut pas être vide.' })
  }

  const userMessage = await insertMessage('user', content)

  try {
    const history = await getAllMessages()
    const now = new Date()
    const aiSettings = await getAiSettings()
    const facts = await getAllFacts()
    const systemPrompt = buildSystemPrompt(aiSettings?.system_prompt || SYSTEM_PROMPT, facts, now)
    const rawReply = await getAssistantReply(history, systemPrompt, aiSettings?.business_context || '')
    const replyText = stripMarkdown(rawReply)
    const assistantMessage = await insertMessage('assistant', replyText)
    res.json({ userMessage, assistantMessage })

    // Fire-and-forget: learn from this exchange without ever blocking or breaking the chat reply.
    extractFacts(content, replyText, now)
      .then(async (extracted) => {
        for (const f of extracted) {
          await insertFact(f.fact_type, f.content)
        }
      })
      .catch((err) => console.error('Extraction de faits échouée :', err))
  } catch (err) {
    console.error('Erreur lors de l\u2019appel \u00e0 l\u2019assistant IA:', err)
    res.status(500).json({
      userMessage,
      error: err.message || "Une erreur est survenue lors de l'appel à l'assistant IA.",
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
  res.json(await updateFact(id, fact_type, content))
})

app.delete('/api/facts/:id', async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'id invalide.' })
  }
  await deleteFact(id)
  res.status(204).end()
})

// Catches errors from any route above (including rejected promises in async handlers,
// which Express 5 forwards here automatically) so the API always replies with JSON —
// never Express's default HTML error page, which would break the frontend's res.json().
app.use((req, res) => {
  res.status(404).json({ error: 'Route introuvable.' })
})

app.use((err, req, res, next) => {
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
  if (server) server.close()
  await closeDb().catch(() => {})
  process.exit(0)
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
