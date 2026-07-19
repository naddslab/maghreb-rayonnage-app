import { useEffect, useState } from 'react'
import { Sparkles } from 'lucide-react'
import Sidebar from './Sidebar'
import MobileNav from './MobileNav'
import TopBar from './TopBar'
import ChatPanel from './ChatPanel'

export default function Layout({ title, subtitle, children, fullBleed = false }) {
  const [chatOpen, setChatOpen] = useState(false)

  useEffect(() => {
    function openChat() {
      setChatOpen(true)
    }
    window.addEventListener('open-chat', openChat)
    return () => window.removeEventListener('open-chat', openChat)
  }, [])

  return (
    <div className={'flex bg-ink-50 ' + (fullBleed ? 'h-screen overflow-hidden' : 'min-h-screen')}>
      <Sidebar />

      <div className={'flex min-w-0 flex-1 flex-col ' + (fullBleed ? 'h-screen' : 'min-h-screen')}>
        <TopBar title={title} subtitle={subtitle} onOpenChat={() => setChatOpen(true)} hideAssistantButton={fullBleed} />

        <main
          className={
            fullBleed
              ? 'flex flex-1 flex-col overflow-hidden'
              : 'flex-1 px-4 pb-24 pt-4 sm:px-6 lg:px-7 lg:pb-6 lg:pt-5'
          }
        >
          {fullBleed ? children : <div className="mx-auto flex max-w-[1240px] flex-col gap-3">{children}</div>}
        </main>
      </div>

      {!fullBleed && (
        <button
          type="button"
          onClick={() => setChatOpen(true)}
          className="fixed bottom-20 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-accent-500 text-white transition-transform active:scale-95 sm:hidden"
          aria-label="Ouvrir l'assistant IA"
        >
          <Sparkles size={22} />
        </button>
      )}

      <MobileNav />

      {!fullBleed && <ChatPanel isOpen={chatOpen} onClose={() => setChatOpen(false)} />}
    </div>
  )
}
