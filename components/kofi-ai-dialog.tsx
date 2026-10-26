'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Bot, X, Send, Loader2, Maximize2 } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { getPermissions } from '@/lib/ai/permissions'
import { askAssistant } from '@/lib/ai/assistant-request'

export function KofiAIDialog({ onClose }: { onClose: () => void }) {
  const { session } = useAuth()
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<Array<{ role: string; text: string }>>([])
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const endRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    inputRef.current?.focus()
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', escape)
    return () => { window.removeEventListener('keydown', escape); previous?.focus() }
  }, [onClose])
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'nearest' }) }, [messages])

  const send = async (suggestion?: string) => {
    const question = (suggestion || input).trim()
    if (!question || busy || !session) return
    setInput(''); setBusy(true)
    setMessages(previous => [...previous, { role: 'user', text: question }])
    try {
      const result = await askAssistant(question, session.user, getPermissions(session.user.role))
      setMessages(previous => [...previous, { role: 'assistant', text: result.answer }])
    } catch (error) {
      setMessages(previous => [...previous, { role: 'assistant', text: error instanceof Error ? error.message : 'Could not verify data. Please try again.' }])
    } finally { setBusy(false) }
  }

  return (
    <section role="dialog" aria-modal="false" aria-labelledby="kofi-dialog-title" className="no-print fixed bottom-[calc(6rem+env(safe-area-inset-bottom))] right-3 z-50 flex max-h-[min(55dvh,440px)] w-[calc(100vw-1.5rem)] max-w-sm flex-col overflow-hidden rounded-2xl border border-yellow-500/30 bg-zinc-950/65 shadow-2xl backdrop-blur-sm lg:bottom-24 lg:right-6">
      <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2">
        <Bot className="h-5 w-5 text-yellow-400" />
        <h2 id="kofi-dialog-title" className="flex-1 text-sm font-semibold text-yellow-400">Kofi AI</h2>
        <Link href="/dashboard/assistant" onClick={onClose} aria-label="Open full assistant" className="rounded p-2 text-zinc-300 hover:text-white"><Maximize2 className="h-4 w-4" /></Link>
        <button type="button" onClick={onClose} aria-label="Close Kofi AI" className="rounded p-2 text-zinc-300 hover:text-white"><X className="h-4 w-4" /></button>
      </div>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3 text-sm" aria-live="polite" aria-busy={busy}>
        {!messages.length && <>
          <p className="text-zinc-200">Ask about your business while keeping your screen in view.</p>
          <div className="flex flex-wrap gap-2">{["My sales today", "Today's best selling item", ...(session?.user.role === 'admin' ? ['Analyze all sales and salesperson activities'] : [])].map(text => <button type="button" key={text} onClick={() => send(text)} className="rounded-lg border border-white/15 bg-black/20 px-2 py-1.5 text-left text-xs text-zinc-100">{text}</button>)}</div>
          <p className="text-xs text-zinc-400">Sales answers use verified, synced records. Kofi does not change transactions.</p>
        </>}
        {messages.map((message, index) => <p key={index} className={`whitespace-pre-wrap break-words rounded-lg p-2 text-xs leading-relaxed ${message.role === 'user' ? 'ml-6 bg-yellow-500/10 text-yellow-100' : 'bg-black/15 text-zinc-100'}`}>{message.text}</p>)}
        {busy && <p className="flex items-center gap-2 text-xs text-yellow-300"><Loader2 className="h-4 w-4 animate-spin" />Checking synced records…</p>}
        <div ref={endRef} />
      </div>
      <form onSubmit={event => { event.preventDefault(); send() }} className="flex gap-2 border-t border-white/10 p-2">
        <input ref={inputRef} aria-label="Ask Kofi AI" maxLength={500} value={input} onChange={event => setInput(event.target.value)} placeholder="Ask Kofi AI…" className="min-w-0 flex-1 rounded-lg border border-white/15 bg-black/25 px-3 py-2 text-sm text-white placeholder:text-zinc-400" />
        <button type="submit" disabled={busy || !input.trim()} aria-label="Send question" className="rounded-lg bg-yellow-400 px-3 text-black disabled:opacity-50"><Send className="h-4 w-4" /></button>
      </form>
    </section>
  )
}
