import { useEffect, useRef, useState } from 'react'
import { Bot, Send, Sparkles } from 'lucide-react'
import Layout from '../components/Layout'
import { currentUser } from '../data/mockData'
import { apiUrl } from '../lib/api'

const SUGGESTIONS = [
  'Résume mes clients prioritaires',
  'Que dois-je faire aujourd\u2019hui ?',
  'Rappelle-moi les rendez-vous de la semaine',
]

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
  const firstName = currentUser.name.split(' ')[0]

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
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, isSending])

  async function sendMessage(rawText) {
    const content = rawText.trim()
    if (!content || isSending) return

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
          <form onSubmit={handleSubmit} className="mx-auto flex max-w-[700px] items-end gap-2">
            <AutoResizeTextarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Écrivez un message…"
              disabled={isSending}
            />
            <button
              type="submit"
              disabled={!draft.trim() || isSending}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-500 text-white transition-transform active:scale-95 disabled:opacity-40"
              aria-label="Envoyer"
            >
              <Send size={16} />
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
