'use client'

import { useState, useRef, useEffect } from 'react'
import { store, money, Sale } from '@/lib/store'
import { getSession } from '@/lib/auth'
import { Brain, Send, X, Loader2, Sparkles } from 'lucide-react'

interface ChatMsg {
  role: 'user' | 'assistant'
  content: string
  loading?: boolean
}

function getTodaySales(): Sale[] {
  const today = new Date().toISOString().slice(0, 10)
  return store.getSales().filter((s) => s.timestamp.startsWith(today))
}

function answerQuestion(q: string): string {
  const lower = q.toLowerCase()
  const sales = getTodaySales()
  const session = getSession()
  const user = session?.user

  if (sales.length === 0) {
    return 'No sales have been recorded today yet. Start selling to see your daily activity here!'
  }

  const totalRevenue = sales.reduce((sum, s) => sum + s.total, 0)
  const totalItems = sales.reduce((sum, s) => sum + s.items.reduce((a, i) => a + i.qty, 0), 0)
  const avgOrder = sales.length ? totalRevenue / sales.length : 0

  if (lower.includes('my sales') || lower.includes('my activity') || (lower.includes('how many') && lower.includes('sale'))) {
    if (user && user.email) {
      const mySales = sales.filter((s) => s.userEmail === user.email)
      const myRevenue = mySales.reduce((sum, s) => sum + s.total, 0)
      const myItems = mySales.reduce((sum, s) => sum + s.items.reduce((a, i) => a + i.qty, 0), 0)
      return `**Your Sales Today**\n\n- Transactions: ${mySales.length}\n- Items sold: ${myItems}\n- Revenue: ${money(myRevenue)}\n- Average order: ${money(mySales.length ? myRevenue / mySales.length : 0)}`
    }
  }

  if (lower.includes('summary') || lower.includes('overview') || lower.includes('how am i doing') || lower.includes('today')) {
    return `**Today's Sales Summary**\n\n- Total transactions: ${sales.length}\n- Items sold: ${totalItems}\n- Total revenue: ${money(totalRevenue)}\n- Average order value: ${money(avgOrder)}\n\n${user ? `You have processed ${sales.filter((s) => s.userEmail === user.email).length} sale(s) today.` : ''}`
  }

  if (lower.includes('top') || lower.includes('best') || lower.includes('popular')) {
    const map = new Map<string, { name: string; qty: number; total: number }>()
    sales.forEach((s) => s.items.forEach((i) => {
      const cur = map.get(i.id) || { name: i.name, qty: 0, total: 0 }
      cur.qty += i.qty
      cur.total += i.price * i.qty
      map.set(i.id, cur)
    }))
    const top = Array.from(map.values()).sort((a, b) => b.qty - a.qty).slice(0, 5)
    if (top.length === 0) return 'No items sold today yet.'
    return `**Top Selling Items Today**\n\n${top.map((t, i) => `${i + 1}. ${t.name} — ${t.qty} units (${money(t.total)})`).join('\n')}`
  }

  if (lower.includes('payment') || lower.includes('cash') || lower.includes('card') || lower.includes('mobile')) {
    const cash = sales.filter((s) => s.paymentMethod === 'cash')
    const card = sales.filter((s) => s.paymentMethod === 'card')
    const mobile = sales.filter((s) => s.paymentMethod === 'mobile')
    return `**Payment Methods Today**\n\n- Cash: ${cash.length} transactions (${money(cash.reduce((s, x) => s + x.total, 0))})\n- Card: ${card.length} transactions (${money(card.reduce((s, x) => s + x.total, 0))})\n- Mobile Money: ${mobile.length} transactions (${money(mobile.reduce((s, x) => s + x.total, 0))})`
  }

  if (lower.includes('last') || lower.includes('recent')) {
    const recent = sales.slice(-5).reverse()
    return `**Recent Sales Today**\n\n${recent.map((s, i) => `${i + 1}. ${new Date(s.timestamp).toLocaleTimeString()} — ${s.items.length} item(s) — ${money(s.total)} (${s.paymentMethod})`).join('\n')}`
  }

  return `**Today's Sales Activity**\n\n- Total transactions: ${sales.length}\n- Items sold: ${totalItems}\n- Total revenue: ${money(totalRevenue)}\n- Average order: ${money(avgOrder)}\n\nAsk me about: my sales, top items, payments, recent sales, or today's summary.`
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

  const send = (text?: string) => {
    const q = (text || input).trim()
    if (!q || loading) return
    setInput('')
    setLoading(true)
    setMessages((prev) => [...prev, { role: 'user', content: q }, { role: 'assistant', content: '', loading: true }])

    setTimeout(() => {
      const answer = answerQuestion(q)
      setMessages((prev) => prev.map((m, i) => i === prev.length - 1 ? { ...m, content: answer, loading: false } : m))
      setLoading(false)
    }, 400)
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-20 right-4 sm:bottom-6 sm:right-6 z-40 group flex items-center gap-2 pl-3 pr-4 py-2 gold-gradient rounded-full shadow-lg hover:shadow-yellow-500/30 transition-all hover:scale-105 active:scale-95"
      >
        <Brain className="h-4 w-4 text-black" />
        <span className="text-xs font-bold text-black whitespace-nowrap">Sales AI</span>
      </button>
    )
  }

  return (
    <div className="fixed bottom-20 right-4 sm:bottom-6 sm:right-6 z-50 w-[calc(100vw-2rem)] max-w-sm">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl flex flex-col max-h-[70vh] overflow-hidden">
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
