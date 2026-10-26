'use client'

import { useState, useRef, useEffect } from 'react'
import { getSession } from '@/lib/auth'
import { askAssistant } from '@/lib/ai/assistant-request'
import { getPermissions } from '@/lib/ai/permissions'
import { Brain, Send, X, Loader2, Sparkles } from 'lucide-react'

interface ChatMsg {
  role: 'user' | 'assistant'
  content: string
  loading?: boolean
}

const SUGGESTED = [
  "Today's summary",
  'My sales today',
  'Top selling items',
  'Recent sales',
  'Payment methods',
]

export function POSAIAssistant() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = async (text?: string) => {
    const q = (text || input).trim()
    if (!q || loading) return
    setInput('')
    setLoading(true)
    setMessages((prev) => [...prev, { role: 'user', content: q }, { role: 'assistant', content: '', loading: true }])

    try {
      const user = getSession()?.user
      if (!user) throw new Error('Please sign in again.')
      const { answer } = await askAssistant(q, user, getPermissions(user.role))
      setMessages((prev) => prev.map((m, i) => i === prev.length - 1 ? { ...m, content: answer, loading: false } : m))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not verify sales. Please try again.'
      setMessages((prev) => prev.map((m, i) => i === prev.length - 1 ? { ...m, content: message, loading: false } : m))
    } finally {
      setLoading(false)
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="no-print fixed bottom-[calc(6rem+env(safe-area-inset-bottom))] right-4 lg:bottom-6 lg:right-6 z-40 group flex items-center gap-2 pl-3 pr-4 py-2 gold-gradient rounded-full shadow-lg hover:shadow-yellow-500/30 transition-all hover:scale-105 active:scale-95"
      >
        <Brain className="h-4 w-4 text-black" />
        <span className="text-xs font-bold text-black whitespace-nowrap">Sales AI</span>
      </button>
    )
  }

  return (
    <div className="no-print fixed bottom-[calc(6rem+env(safe-area-inset-bottom))] right-4 lg:bottom-6 lg:right-6 z-50 w-[calc(100vw-2rem)] max-w-sm">
      <div className="bg-zinc-950/65 backdrop-blur-sm border border-yellow-500/25 rounded-2xl shadow-2xl flex flex-col max-h-[min(50dvh,400px)] overflow-hidden">
        <div className="flex items-center justify-between p-3 border-b border-zinc-800 shrink-0">
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-yellow-500" />
            <span className="text-sm font-bold text-white">Sales Assistant</span>
          </div>
          <button onClick={() => setOpen(false)} className="text-zinc-400 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-[200px]">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center py-6">
              <Sparkles className="h-8 w-8 text-yellow-500 mb-2" />
              <p className="text-sm text-zinc-300 font-medium mb-1">Today's Sales AI</p>
              <p className="text-xs text-zinc-500 mb-4">Ask about today's sales activity</p>
              <div className="flex flex-wrap gap-1.5 justify-center">
                {SUGGESTED.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="text-xs px-2.5 py-1.5 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-300 hover:border-yellow-500/40 hover:text-yellow-400 transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={msg.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
              <div className={`max-w-[90%] rounded-lg px-3 py-2 text-sm ${msg.role === 'user' ? 'bg-yellow-500/10 border border-yellow-500/30 text-zinc-100' : 'bg-zinc-950/60 border border-zinc-800 text-zinc-200'}`}>
                {msg.loading ? (
                  <div className="flex items-center gap-2 text-zinc-400">
                    <Loader2 className="h-3 w-3 animate-spin text-yellow-500" />
                    <span className="text-xs">Checking today's sales...</span>
                  </div>
                ) : (
                  <div className="whitespace-pre-line">{msg.content}</div>
                )}
              </div>
            </div>
          ))}
          <div ref={endRef} />
        </div>

        <div className="border-t border-zinc-800 p-2 shrink-0">
          <div className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
              placeholder="Ask about today's sales..."
              disabled={loading}
              className="flex-1 bg-zinc-950 border border-zinc-800 text-white rounded-lg px-3 py-2 text-sm placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-yellow-500"
            />
            <button
              onClick={() => send()}
              disabled={!input.trim() || loading}
              className="gold-gradient text-black rounded-lg px-3 py-2 font-bold disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
