import { useEffect, useRef, useState } from 'react'
import { Bot, Loader2, Paperclip, Send, Sparkles, X } from 'lucide-react'
import Layout from '../components/Layout'
import { currentUser } from '../data/mockData'
import { apiUrl } from '../lib/api'
import { fetchAllClients, createClient, uploadClientFile, uploadGeneralFile } from '../lib/clients'

const SUGGESTIONS = [
  'Résume mes clients prioritaires',
  'Que dois-je faire aujourd\u2019hui ?',
  'Rappelle-moi les rendez-vous de la semaine',
]

// Only images and PDFs are actually uploaded for now — Word/Excel are still offered in the file
// picker (so they're not confusingly grayed out) but rejected with an explicit message.
const OFFICE_EXTENSIONS = ['.doc', '.docx', '.xls', '.xlsx']
const OFFICE_MIME_TYPES = [
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]

function isSupportedAttachment(file) {
  return file.type.startsWith('image/') || file.type === 'application/pdf'
}

function isOfficeDoc(file) {
  const name = file.name.toLowerCase()
  return OFFICE_EXTENSIONS.some((ext) => name.endsWith(ext)) || OFFICE_MIME_TYPES.includes(file.type)
}

function AutoResizeTextarea({ value, onChange, onKeyDown, placeholder, disabled }) {
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 160) + 'px'
  }, [value])

  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      onChange={onChange}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      disabled={disabled}
      className="input-field max-h-40 flex-1 resize-none py-2.5 leading-relaxed"
    />
  )
}

function TypingIndicator() {
  return (
    <div className="flex gap-3">
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-gradient text-white">
        <Bot size={14} />
      </div>
      <div className="flex items-center gap-1 py-2">
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-300 [animation-delay:-0.2s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-300 [animation-delay:-0.1s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-300" />
      </div>
    </div>
  )
}

export default function AIAssistantPage() {
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState('')
  const [isLoadingHistory, setIsLoadingHistory] = useState(true)
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState(null)
  const scrollRef = useRef(null)
  const fileInputRef = useRef(null)
  const firstName = currentUser.name.split(' ')[0]

  // Attachment flow: pick a file -> pick/type which client it's for -> upload happens on send.
  const [clients, setClients] = useState([])
  const [attachedFile, setAttachedFile] = useState(null)
  const [attachClientQuery, setAttachClientQuery] = useState('')
  const [attachClientId, setAttachClientId] = useState(null)
  const [attachmentError, setAttachmentError] = useState('')
  const [isUploadingFile, setIsUploadingFile] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function loadHistory() {
      try {
        const res = await fetch(apiUrl('/api/messages'))
        if (!res.ok) throw new Error('load failed')
        const data = await res.json()
        if (!cancelled) setMessages(data)
      } catch {
        // Backend not reachable yet — start from the empty state instead of failing the page.
      } finally {
        if (!cancelled) setIsLoadingHistory(false)
      }
    }
    loadHistory()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    fetchAllClients()
      .then((data) => {
        if (!cancelled) setClients(data)
      })
      .catch(() => {
        // The client picker just falls back to "always create a new client" if this fails.
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Single source of truth for "is the attachment flow active right now?" — the client-name
  // picker, and any requirement to fill it in, must ALWAYS gate on this and nothing else, so a
  // normal text-only message never shows extra UI or has extra requirements.
  const hasAttachment = Boolean(attachedFile)

  const attachSuggestions =
    hasAttachment && attachClientQuery.trim() && !attachClientId
      ? clients
          .filter((c) => c.name.toLowerCase().includes(attachClientQuery.trim().toLowerCase()))
          .slice(0, 5)
      : []

  function handleFileSelected(e) {
    const file = e.target.files?.[0]
    e.target.value = '' // allow picking the same file again later
    if (!file) return

    if (!isSupportedAttachment(file)) {
      setAttachmentError(
        isOfficeDoc(file)
          ? "Ce format n'est pas encore supporté. Utilisez une image ou un PDF."
          : "Ce type de fichier n'est pas pris en charge. Utilisez une image ou un PDF."
      )
      return
    }

    setAttachmentError('')
    setAttachedFile(file)
    setAttachClientQuery('')
    setAttachClientId(null)
  }

  function clearAttachment() {
    setAttachedFile(null)
    setAttachClientQuery('')
    setAttachClientId(null)
    setAttachmentError('')
  }

  // Resolves the typed/selected client name to an id, creating the client on the fly if it
  // doesn't exist yet — the user is explicitly allowed to type a brand-new name.
  async function resolveAttachmentClient(name) {
    if (attachClientId) {
      const known = clients.find((c) => c.id === attachClientId)
      if (known && known.name.trim().toLowerCase() === name.toLowerCase()) return known
    }

    const existing = clients.find((c) => c.name.trim().toLowerCase() === name.toLowerCase())
    if (existing) return existing

    const created = await createClient(name)
    setClients((prev) => [created, ...prev])
    return created
  }

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, isSending])

  async function sendMessage(rawText) {
    const trimmed = rawText.trim()
    if ((!trimmed && !hasAttachment) || isSending || isUploadingFile) return

    let content = trimmed

    // Everything in this block only ever runs when an attachment is actually present — a plain
    // text message never touches this code path at all. The client name is optional: if left
    // blank the file is uploaded as a "general" file (clientId = null) instead of blocking send.
    if (hasAttachment) {
      const clientName = attachClientQuery.trim()

      setIsUploadingFile(true)
      setAttachmentError('')
      try {
        if (clientName) {
          const client = await resolveAttachmentClient(clientName)
          await uploadClientFile(client.id, attachedFile)
          const note = `[Fichier joint : ${attachedFile.name} pour ${client.name}]`
          content = content ? `${content}\n\n${note}` : note
        } else {
          await uploadGeneralFile(attachedFile)
          const note = `[Fichier joint : ${attachedFile.name}]`
          content = content ? `${content}\n\n${note}` : note
        }
        clearAttachment()
      } catch (err) {
        setAttachmentError(err.message || "Échec de l'envoi du fichier.")
        setIsUploadingFile(false)
        return
      }
      setIsUploadingFile(false)
    }

    if (!content) return

    const tempId = `local-${Date.now()}`
    const tempUserMessage = { id: tempId, role: 'user', content, timestamp: new Date().toISOString() }
    setMessages((prev) => [...prev, tempUserMessage])
    setDraft('')
    setIsSending(true)
    setError(null)

    try {
      const res = await fetch(apiUrl('/api/chat'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data?.error || 'Une erreur est survenue.')
      }

      setMessages((prev) => [
        ...prev.filter((m) => m.id !== tempId),
        data.userMessage,
        data.assistantMessage,
      ])
    } catch (err) {
      setError(err.message || "Impossible de contacter l'assistant IA pour le moment.")
    } finally {
      setIsSending(false)
    }
  }

  function handleSubmit(e) {
    e.preventDefault()
    sendMessage(draft)
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(draft)
    }
  }

  const hasMessages = messages.length > 0

  return (
    <Layout
      title="Assistant IA"
      subtitle="Vue transverse · Maghreb Rayonnage, AZ Rayonnage & Top Rayonnage"
      fullBleed
    >
      <div className="flex h-full flex-col pb-16 lg:pb-0">
        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          {!hasMessages && !isLoadingHistory ? (
            <div className="flex h-full flex-col items-center justify-center px-4 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-glossy text-white">
                <Sparkles size={20} />
              </div>
              <h2 className="mt-4 text-[22px] font-extrabold leading-tight tracking-tight text-ink-900 sm:text-[24px]">
                Bonjour {firstName}, comment puis-je vous aider aujourd’hui ?
              </h2>
              <p className="mt-1.5 max-w-md text-[13px] leading-relaxed text-ink-500">
                J&apos;ai une vue sur vos trois coffres — Maghreb Rayonnage, AZ Rayonnage et Top Rayonnage. Posez-moi une
                question sur vos clients, vos réunions ou vos priorités du moment.
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => sendMessage(s)}
                    className="rounded-full border border-ink-200 bg-white px-3.5 py-2 text-[12.5px] font-semibold text-ink-600 transition-colors hover:border-accent-300 hover:text-accent-600"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="mx-auto flex max-w-[700px] flex-col gap-6 px-4 py-8 sm:px-0">
              {messages.map((m) => (
                <div key={m.id} className={'flex gap-3 ' + (m.role === 'user' ? 'justify-end' : '')}>
                  {m.role === 'assistant' && (
                    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-gradient text-white">
                      <Bot size={14} />
                    </div>
                  )}
                  <div className={m.role === 'user' ? 'max-w-[80%]' : 'max-w-[85%] flex-1'}>
                    {m.role === 'user' ? (
                      <div className="rounded-2xl bg-ink-100 px-4 py-2.5 text-[13.5px] leading-relaxed text-ink-800">
                        {m.content}
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-ink-800">{m.content}</p>
                    )}
                  </div>
                </div>
              ))}

              {isSending && <TypingIndicator />}

              {error && (
                <div className="ml-10 flex max-w-[85%] items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-[12.5px] text-rose-600">
                  {error}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="border-t border-ink-200 bg-white px-4 pb-3 pt-3 lg:pb-4">
          {/* Client-name picker: gated ONLY on hasAttachment — must never appear, and never
              require anything, for a normal text-only message. */}
          {hasAttachment && (
            <div className="mx-auto mb-2 flex max-w-[700px] flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-ink-200 bg-ink-50 px-2.5 py-1.5 text-[12px] font-semibold text-ink-700">
                {isUploadingFile ? (
                  <Loader2 size={12} className="shrink-0 animate-spin text-ink-400" />
                ) : (
                  <Paperclip size={12} className="shrink-0 text-ink-400" />
                )}
                <span className="max-w-[160px] truncate">{attachedFile.name}</span>
                {!isUploadingFile && (
                  <button
                    type="button"
                    onClick={clearAttachment}
                    aria-label="Retirer le fichier"
                    className="text-ink-400 transition-colors hover:text-rose-500"
                  >
                    <X size={12} />
                  </button>
                )}
              </span>

              <div className="relative min-w-[200px] flex-1">
                <input
                  type="text"
                  value={attachClientQuery}
                  onChange={(e) => {
                    setAttachClientQuery(e.target.value)
                    setAttachClientId(null)
                  }}
                  disabled={isUploadingFile}
                  placeholder="Client concerné (optionnel)…"
                  className="input-field w-full py-1.5 text-[12px]"
                />
                {attachSuggestions.length > 0 && (
                  <div className="absolute bottom-full left-0 z-10 mb-1 w-full overflow-hidden rounded-lg border border-ink-200 bg-white py-1 shadow-sm">
                    {attachSuggestions.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setAttachClientId(c.id)
                          setAttachClientQuery(c.name)
                        }}
                        className="block w-full px-3 py-1.5 text-left text-[12px] font-medium text-ink-700 hover:bg-ink-50"
                      >
                        {c.name}
                        {c.company && <span className="ml-1 text-ink-400">— {c.company}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {attachmentError && (
            <p className="mx-auto mb-2 max-w-[700px] text-[11.5px] font-semibold text-rose-500">{attachmentError}</p>
          )}

          <form onSubmit={handleSubmit} className="mx-auto flex max-w-[700px] items-end gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx"
              className="hidden"
              onChange={handleFileSelected}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isSending || isUploadingFile}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-ink-200 text-ink-500 transition-colors hover:border-accent-300 hover:text-accent-600 disabled:opacity-40"
              aria-label="Joindre un fichier"
            >
              <Paperclip size={16} />
            </button>
            <AutoResizeTextarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Écrivez un message…"
              disabled={isSending || isUploadingFile}
            />
            <button
              type="submit"
              disabled={(!draft.trim() && !hasAttachment) || isSending || isUploadingFile}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-500 text-white transition-transform active:scale-95 disabled:opacity-40"
              aria-label="Envoyer"
            >
              {isUploadingFile ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            </button>
          </form>
          <p className="mx-auto mt-1.5 max-w-[700px] text-center text-[10.5px] text-ink-400">
            L&apos;assistant IA peut faire des erreurs. Vérifiez les informations importantes.
          </p>
        </div>
      </div>
    </Layout>
  )
}
