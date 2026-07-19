import { useEffect, useState } from 'react'
import { Users, Target, ListChecks, CalendarClock, Plus, Pencil, Trash2 } from 'lucide-react'
import { apiUrl } from '../lib/api'

const FACT_TYPES = [
  { type: 'client', label: 'Clients', icon: Users },
  { type: 'goal', label: 'Objectifs', icon: Target },
  { type: 'task', label: 'Tâches / rappels', icon: ListChecks },
  { type: 'date', label: 'Dates importantes', icon: CalendarClock },
]

const FACT_FIELDS = {
  client: [
    { key: 'name', label: 'Nom du client' },
    { key: 'company', label: 'Entreprise' },
    { key: 'contact', label: 'Contact (email / téléphone)' },
    { key: 'meetingDate', label: 'Prochain rendez-vous', type: 'datetime-local' },
    { key: 'notes', label: 'Notes', wide: true },
  ],
  goal: [
    { key: 'description', label: 'Objectif', wide: true },
    { key: 'targetDate', label: 'Échéance', type: 'date' },
  ],
  task: [
    { key: 'description', label: 'Tâche', wide: true },
    { key: 'dueDate', label: 'À faire pour', type: 'datetime-local' },
  ],
  date: [
    { key: 'label', label: 'Intitulé', wide: true },
    { key: 'datetime', label: 'Date et heure', type: 'datetime-local' },
    { key: 'relatedTo', label: 'Lié à' },
  ],
}

function toDatetimeLocal(value) {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function emptyContentFor(type) {
  const fields = FACT_FIELDS[type] || []
  return fields.reduce((acc, f) => ({ ...acc, [f.key]: '' }), {})
}

function normalizeContentForEdit(type, content) {
  const fields = FACT_FIELDS[type] || []
  const normalized = {}
  fields.forEach((f) => {
    const raw = content?.[f.key] ?? ''
    normalized[f.key] = f.type === 'datetime-local' ? toDatetimeLocal(raw) : raw
  })
  return normalized
}

function formatDateFr(value) {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function factSummary(fact) {
  const c = fact.content || {}
  switch (fact.fact_type) {
    case 'client':
      return {
        title: c.name || 'Client sans nom',
        meta: [c.company, c.contact, c.meetingDate && `RDV : ${formatDateFr(c.meetingDate)}`, c.notes].filter(Boolean),
      }
    case 'goal':
      return {
        title: c.description || 'Objectif',
        meta: [c.targetDate && `Échéance : ${formatDateFr(c.targetDate)}`].filter(Boolean),
      }
    case 'task':
      return {
        title: c.description || 'Tâche',
        meta: [c.dueDate && `À faire pour : ${formatDateFr(c.dueDate)}`].filter(Boolean),
      }
    case 'date':
      return {
        title: c.label || 'Date importante',
        meta: [c.datetime && formatDateFr(c.datetime), c.relatedTo].filter(Boolean),
      }
    default:
      return { title: 'Fait', meta: [] }
  }
}

function FactForm({ factType, initialValues, allowTypeChange, onChangeType, onSubmit, onCancel }) {
  const [values, setValues] = useState(initialValues)
  const fields = FACT_FIELDS[factType] || []

  return (
    <div className="rounded-xl border border-ink-200 bg-ink-50/60 p-3">
      {allowTypeChange && (
        <div className="mb-2.5">
          <label className="label-field">Type de fait</label>
          <select value={factType} onChange={(e) => onChangeType(e.target.value)} className="input-field">
            {FACT_TYPES.map((t) => (
              <option key={t.type} value={t.type}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {fields.map((f) => (
          <div key={f.key} className={f.wide ? 'sm:col-span-2' : ''}>
            <label className="label-field">{f.label}</label>
            <input
              type={f.type || 'text'}
              value={values[f.key] ?? ''}
              onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
              className="input-field"
            />
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-end gap-2">
        <button type="button" onClick={onCancel} className="btn-secondary px-3 py-1.5 text-[12px]">
          Annuler
        </button>
        <button type="button" onClick={() => onSubmit(values)} className="btn-primary px-3 py-1.5 text-[12px]">
          Enregistrer
        </button>
      </div>
    </div>
  )
}

function FactRow({ fact, isEditing, onEdit, onDelete, onSubmitEdit, onCancelEdit }) {
  if (isEditing) {
    return (
      <FactForm
        factType={fact.fact_type}
        initialValues={normalizeContentForEdit(fact.fact_type, fact.content)}
        allowTypeChange={false}
        onSubmit={onSubmitEdit}
        onCancel={onCancelEdit}
      />
    )
  }

  const { title, meta } = factSummary(fact)

  return (
    <div className="flex items-start justify-between gap-3 rounded-xl border border-ink-100 px-3 py-2.5">
      <div className="min-w-0">
        <p className="text-[12.5px] font-bold text-ink-800">{title}</p>
        {meta.length > 0 && <p className="mt-0.5 truncate text-[11px] text-ink-400">{meta.join(' · ')}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          onClick={onEdit}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700"
          aria-label="Modifier"
        >
          <Pencil size={13} />
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-400 transition-colors hover:bg-rose-50 hover:text-rose-500"
          aria-label="Supprimer"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  )
}

export default function FactsPanel() {
  const [facts, setFacts] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [editingId, setEditingId] = useState(null)
  const [isAdding, setIsAdding] = useState(false)
  const [addType, setAddType] = useState('client')

  async function loadFacts() {
    try {
      const res = await fetch(apiUrl('/api/facts'))
      if (res.ok) setFacts(await res.json())
    } catch {
      // Backend not reachable — keep whatever was already loaded and fail silently.
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadFacts()
  }, [])

  async function handleAdd(values) {
    await fetch(apiUrl('/api/facts'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fact_type: addType, content: values }),
    })
    setIsAdding(false)
    loadFacts()
  }

  async function handleUpdate(id, factType, values) {
    await fetch(apiUrl(`/api/facts/${id}`), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fact_type: factType, content: values }),
    })
    setEditingId(null)
    loadFacts()
  }

  async function handleDelete(id) {
    setFacts((prev) => prev.filter((f) => f.id !== id))
    await fetch(apiUrl(`/api/facts/${id}`), { method: 'DELETE' })
  }

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-200 p-4">
        <div>
          <h3 className="text-[13.5px] font-bold text-ink-800">Base de connaissances</h3>
          <p className="mt-0.5 text-[11.5px] text-ink-400">
            Faits appris automatiquement par l&apos;assistant IA au fil de vos conversations
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditingId(null)
            setIsAdding((v) => !v)
          }}
          className="btn-secondary px-3 py-1.5 text-[12px]"
        >
          <Plus size={13} />
          Ajouter un fait
        </button>
      </div>

      <div className="flex flex-col gap-4 p-4">
        {isAdding && (
          <FactForm
            key={addType}
            factType={addType}
            initialValues={emptyContentFor(addType)}
            allowTypeChange
            onChangeType={setAddType}
            onSubmit={handleAdd}
            onCancel={() => setIsAdding(false)}
          />
        )}

        {isLoading ? (
          <p className="text-[12.5px] text-ink-400">Chargement…</p>
        ) : (
          FACT_TYPES.map(({ type, label, icon: Icon }) => {
            const items = facts.filter((f) => f.fact_type === type)
            return (
              <div key={type}>
                <div className="mb-2 flex items-center gap-2">
                  <Icon size={14} className="text-ink-400" />
                  <h4 className="text-[12px] font-bold uppercase tracking-wide text-ink-500">{label}</h4>
                  <span className="badge bg-ink-100 text-ink-500">{items.length}</span>
                </div>
                {items.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-ink-200 px-3 py-3 text-[12px] text-ink-400">
                    Aucun fait enregistré pour l&apos;instant.
                  </p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {items.map((fact) => (
                      <FactRow
                        key={fact.id}
                        fact={fact}
                        isEditing={editingId === fact.id}
                        onEdit={() => {
                          setIsAdding(false)
                          setEditingId(fact.id)
                        }}
                        onDelete={() => handleDelete(fact.id)}
                        onSubmitEdit={(values) => handleUpdate(fact.id, fact.fact_type, values)}
                        onCancelEdit={() => setEditingId(null)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
