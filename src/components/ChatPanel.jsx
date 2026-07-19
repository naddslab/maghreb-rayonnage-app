import { useEffect, useRef, useState } from 'react'
import { X, Sparkles, Send, Bot } from 'lucide-react'
import { initialChatMessages } from '../data/mockData'

const CANNED_REPLIES = [
  'Je note votre demande. Voici ce que je vois dans vos coffres actifs : les tendances restent positives sur AZ Rayonnage et Top Rayonnage ce mois-ci.',
  'D\u2019après les dernières données, 3 clients à forte importance (XXX) sont en attente de signature et nécessitent un suivi cette semaine.',
  'Je peux préparer un export PDF de ce coffre ou un résumé pour votre prochaine réunion, dites-moi ce qui vous aiderait le plus.',
  'Bonne question. Le CA du mois en cours est en ligne avec vos objectifs trimestriels, avec une marge de progression sur les nouveaux clients.',
]

function formatTime() {
  const d = new Date()
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

export default function ChatPanel({ isOpen, onClose }) {
  const [messages, setMessages] = useState(initialChatMessages)
  const [draft, setDraft] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const scrollRef = useRef(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, isTyping, isOpen])

  function handleSend(e) {
    e.preventDefault()
    const text = draft.trim()
    if (!text) return

    const userMsg = { id: Date.now(), sender: 'user', text, time: formatTime() }
    setMessages((prev) => [...prev, userMsg])
    setDraft('')
    setIsTyping(true)

    setTimeout(() => {
      const reply = CANNED_REPLIES[Math.floor(Math.random() * CANNED_REPLIES.length)]
      setMessages((prev) => [...prev, { id: Date.now() + 1, sender: 'ai', text: reply, time: formatTime() }])
      setIsTyping(false)
    }, 1100)
  }

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 z-40 bg-ink-900/25 backdrop-blur-sm" onClick={onClose} />
      )}

      <aside
        className={
          'fixed right-0 top-0 z-50 flex h-full w-full flex-col bg-white shadow-softLg transition-transform duration-300 ease-out sm:w-[380px] sm:border-l sm:border-ink-200 ' +
          (isOpen ? 'translate-x-0' : 'translate-x-full')
        }
      >
        <div className="relative overflow-hidden border-b border-ink-200 bg-accent-glossy px-4 py-4 text-white">
          <div className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-white/25 blur-xl" />
          <div className="relative z-10 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/25">
                <Bot size={17} />
              </div>
              <div>
                <p className="text-[13.5px] font-extrabold">Assistant IA</p>
                <p className="flex items-center gap-1.5 text-[11px] text-white/85">
                  <span className="h-1.5 w-1.5 rounded-full bg-white" />
                  En ligne
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-white/80 transition-colors hover:bg-white/20 hover:text-white"
              aria-label="Fermer l'assistant"
            >
              <X size={17} />
            </button>
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-3.5 py-4">
          <div className="flex flex-col gap-3">
            {messages.map((m) => (
              <div key={m.id} className={'flex items-end gap-2 ' + (m.sender === 'user' ? 'flex-row-reverse' : '')}>
                {m.sender === 'ai' && (
                  <div className="mb-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-gradient text-white">
                    <Sparkles size={11} />
                  </div>
                )}
                <div className={'flex max-w-[82%] flex-col ' + (m.sender === 'user' ? 'items-end' : 'items-start')}>
                  <div
                    className={
                      'px-3.5 py-2 text-[12.5px] leading-relaxed ' +
                      (m.sender === 'user'
                        ? 'rounded-lg rounded-br-sm bg-accent-500 text-white'
                        : 'rounded-lg rounded-bl-sm border border-ink-200 bg-ink-50 text-ink-700')
                    }
                  >
                    {m.text}
                  </div>
                  <span className="mt-1 px-1 text-[10px] text-ink-400">{m.time}</span>
                </div>
              </div>
            ))}

            {isTyping && (
              <div className="flex items-end gap-2">
                <div className="mb-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-gradient text-white">
                  <Sparkles size={11} />
                </div>
                <div className="flex items-center gap-1 rounded-lg rounded-bl-sm border border-ink-200 bg-ink-50 px-3.5 py-2.5">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-300 [animation-delay:-0.2s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-300 [animation-delay:-0.1s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-300" />
                </div>
              </div>
            )}
          </div>
        </div>

        <form onSubmit={handleSend} className="flex items-center gap-2 border-t border-ink-200 p-3">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Écrivez un message…"
            className="input-field flex-1"
          />
          <button
            type="submit"
            disabled={!draft.trim()}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-500 text-white transition-transform active:scale-95 disabled:opacity-40"
            aria-label="Envoyer"
          >
            <Send size={15} />
          </button>
        </form>
      </aside>
    </>
  )
}
