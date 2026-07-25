'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { AuthGuard } from '@/components/auth-guard'
import { DashboardLayout } from '@/components/layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/hooks/useAuth'
import { getPermissions, canAccessAI, AIPermission } from '@/lib/ai/permissions'
import { processQuestion } from '@/lib/ai/engine'
import { conversationStore, Conversation } from '@/lib/ai/conversation'
import { getRemainingRequests } from '@/lib/ai/rate-limit'
import { logAudit } from '@/lib/ai/audit'
import {
  Brain,
  Send,
  Plus,
  Trash2,
  Copy,
  RefreshCw,
  Loader2,
  AlertCircle,
  Clock,
  Sparkles,
  MessageSquare,
  Wrench,
  ThumbsUp,
  ThumbsDown,
  Zap,
} from 'lucide-react'
import toast from 'react-hot-toast'

const SUGGESTED_QUESTIONS = [
  'What are today\'s sales?',
  'Show this month\'s profit',
  'Which products are selling the most?',
  'Which products should I restock?',
  'Which products should be discounted?',
  'Who are my top customers?',
  'Who qualifies for a gift card?',
  'Which store is performing best?',
  'Give me today\'s business summary',
  'What should I focus on today?',
]

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  toolCalls?: Array<{ toolName: string; data: unknown }>
  dateRangeLabel?: string
  model?: string
  loading?: boolean
  error?: boolean
}

export default function AssistantPage() {
  const { session } = useAuth()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConv, setActiveConv] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [permissions, setPermissions] = useState<AIPermission[]>([])
  const [remaining, setRemaining] = useState({ minute: 10, hour: 50 })
  const [showSidebar, setShowSidebar] = useState(false)
  const [showConvMobile, setShowConvMobile] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<boolean>(false)

  useEffect(() => {
    if (!session) return
    const perms = getPermissions(session.user.role)
    setPermissions(perms)
    const convs = conversationStore.listConversations()
    setConversations(convs)
    setRemaining(getRemainingRequests())
    if (convs.length > 0) {
      setActiveConv(convs[0])
      loadMessages(convs[0].id)
    }
  }, [session])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const loadMessages = (convId: string) => {
    const msgs = conversationStore.getMessages(convId)
    setMessages(msgs.map((m) => ({ ...m })))
  }

  const handleNewConversation = () => {
    const conv = conversationStore.createConversation()
    setConversations(conversationStore.listConversations())
    setActiveConv(conv)
    setMessages([])
  }

  const handleDeleteConversation = (id: string) => {
    conversationStore.deleteConversation(id)
    const updated = conversationStore.listConversations()
    setConversations(updated)
    if (activeConv?.id === id) {
      if (updated.length > 0) {
        setActiveConv(updated[0])
        loadMessages(updated[0].id)
      } else {
        setActiveConv(null)
        setMessages([])
      }
    }
  }

  const handleSelectConversation = (conv: Conversation) => {
    setActiveConv(conv)
    loadMessages(conv.id)
  }

  const handleStop = () => {
    abortRef.current = true
    setLoading(false)
  }

  const handleSend = (questionText?: string) => {
    const q = (questionText || input).trim()
    if (!q || loading) return
    if (!session) return
    if (!canAccessAI(session.user.role)) {
      toast.error('You do not have permission to use the AI assistant.')
      return
    }

    setInput('')
    setLoading(true)
    abortRef.current = false

    let conv = activeConv
    if (!conv) {
      conv = conversationStore.createConversation(q.slice(0, 40))
      setConversations(conversationStore.listConversations())
      setActiveConv(conv)
    }

    const startTime = Date.now()

    const userMsg: ChatMessage = {
      id: Math.random().toString(36).slice(2),
      role: 'user',
      content: q,
      timestamp: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, userMsg])

    const assistantMsgId = Math.random().toString(36).slice(2)
    setMessages((prev) => [...prev, {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
      loading: true,
    }])

    try {
      const result = processQuestion(q, session.user, permissions, conv.id)

      if (abortRef.current) return

      setMessages((prev) => prev.map((m) =>
        m.id === assistantMsgId
          ? { ...m, content: result.answer, loading: false, toolCalls: result.toolResults, dateRangeLabel: result.dateRangeLabel, model: 'local' }
          : m
      ))

      setRemaining(getRemainingRequests())
      setConversations(conversationStore.listConversations())
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error'
      setMessages((prev) => prev.map((m) =>
        m.id === assistantMsgId
          ? { ...m, content: `Error: ${errMsg}`, loading: false, error: true }
          : m
      ))

      logAudit({
        timestamp: new Date().toISOString(),
        user: session.user.email,
        role: session.user.role,
        question: q,
        toolsUsed: [],
        dateRange: '',
        status: 'error',
        durationMs: Date.now() - startTime,
        error: errMsg,
      })

      toast.error(errMsg)
    } finally {
      setLoading(false)
    }
  }

  const handleRetry = (msgId: string) => {
    const msg = messages.find((m) => m.id === msgId)
    if (!msg) return
    const userMsg = messages.filter((m) => m.role === 'user').pop()
    if (!userMsg) return
    setMessages((prev) => prev.filter((m) => m.id !== msgId))
    handleSend(userMsg.content)
  }

  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content)
    toast.success('Copied to clipboard')
  }

  const handleFeedback = (msgId: string, positive: boolean) => {
    toast.success(positive ? 'Thanks for the feedback!' : 'Thanks — we\'ll use this to improve.')
  }

  if (!session) return null

  if (!canAccessAI(session.user.role)) {
    return (
      <AuthGuard>
        <DashboardLayout>
          <div className="flex items-center justify-center min-h-[60vh]">
            <Card className="max-w-md">
              <CardContent className="pt-6 text-center">
                <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                <h2 className="text-xl font-bold text-white mb-2">Access Denied</h2>
                <p className="text-zinc-400">Your role ({session.user.role}) does not have permission to use EMDPOS Intelligence.</p>
              </CardContent>
            </Card>
          </div>
        </DashboardLayout>
      </AuthGuard>
    )
  }

  return (
    <AuthGuard>
      <DashboardLayout>
        <div className="mb-4 sm:mb-6 flex flex-col gap-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white flex items-center gap-2">
                <Brain className="h-6 w-6 sm:h-7 sm:w-7 lg:h-8 lg:w-8 text-yellow-500 shrink-0" />
                <span className="truncate">EMDPOS Intelligence</span>
              </h1>
              <p className="text-xs sm:text-sm text-zinc-400 mt-1">Ask questions about your business and get AI-powered insights.</p>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-zinc-500 shrink-0">
              <Clock className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{remaining.hour} requests left this hour</span>
              <span className="sm:hidden">{remaining.hour} left</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-3 lg:gap-4 h-[calc(100vh-180px)] sm:h-[calc(100vh-220px)] min-h-[400px] sm:min-h-[500px]">
          {/* Mobile conversation toggle */}
          <Button
            onClick={() => setShowConvMobile(!showConvMobile)}
            variant="outline"
            className="lg:hidden border-zinc-700 text-zinc-300 w-full justify-center"
          >
            <MessageSquare className="h-4 w-4 mr-2 shrink-0" />
            <span>{showConvMobile ? 'Hide Chats' : 'Show Chats'}</span>
            {conversations.length > 0 && <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 text-xs shrink-0">{conversations.length}</span>}
          </Button>

          {/* Sidebar - desktop: always visible, mobile: toggle */}
          <div className={`${showConvMobile ? 'flex' : 'hidden'} lg:flex w-full lg:w-60 xl:w-64 shrink-0 flex-col gap-2 overflow-hidden max-h-[180px] lg:max-h-none`}>
              <Button
                onClick={handleNewConversation}
                className="gold-gradient text-black font-bold shrink-0"
              >
                <Plus className="h-4 w-4 mr-2" />
                New Chat
              </Button>
              <div className="flex-1 overflow-y-auto space-y-1">
                {conversations.length === 0 && (
                  <p className="text-xs text-zinc-500 text-center pt-4">No conversations yet</p>
                )}
                {conversations.map((conv) => (
                  <div
                    key={conv.id}
                    onClick={() => { handleSelectConversation(conv); setShowConvMobile(false) }}
                    className={`group flex items-center gap-2 rounded-lg px-3 py-2 cursor-pointer transition-colors ${
                      activeConv?.id === conv.id
                        ? 'bg-yellow-500/10 border border-yellow-500/30'
                        : 'hover:bg-zinc-800 border border-transparent'
                    }`}
                  >
                    <MessageSquare className="h-4 w-4 text-zinc-500 shrink-0" />
                    <span className="text-sm text-zinc-300 truncate flex-1">{conv.title}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteConversation(conv.id); setShowConvMobile(false) }}
                      className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-red-400 transition-opacity"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

          <div className="flex-1 flex flex-col min-w-0">
            <Card className="flex-1 flex flex-col glass-card overflow-hidden">
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
                {messages.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full text-center py-12">
                    <div className="h-14 w-14 sm:h-16 sm:w-16 rounded-full bg-yellow-500/10 flex items-center justify-center mb-3 sm:mb-4">
                      <Sparkles className="h-7 w-7 sm:h-8 sm:w-8 text-yellow-500" />
                    </div>
                    <h2 className="text-lg sm:text-xl font-bold text-white mb-2">Ask EMDPOS Intelligence</h2>
                    <p className="text-sm text-zinc-400 mb-4 sm:mb-6 max-w-md">
                      Get instant answers about your sales, products, inventory, customers, and business performance.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-2xl w-full">
                      {SUGGESTED_QUESTIONS.map((q) => (
                        <button
                          key={q}
                          onClick={() => handleSend(q)}
                          className="text-left text-xs sm:text-sm px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg bg-zinc-900/60 border border-zinc-800 hover:border-yellow-500/40 hover:bg-yellow-500/5 text-zinc-300 transition-colors"
                        >
                          <Zap className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-yellow-500 inline mr-2 shrink-0" />
                          <span className="line-clamp-2">{q}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {messages.map((msg) => (
                  <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[90%] sm:max-w-[85%] ${msg.role === 'user' ? '' : 'w-full'}`}>
                      {msg.role === 'user' ? (
                        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-3 sm:px-4 py-2.5 sm:py-3">
                          <p className="text-xs sm:text-sm text-zinc-100 break-words">{msg.content}</p>
                        </div>
                      ) : (
                        <div className={`rounded-lg px-3 sm:px-4 py-2.5 sm:py-3 ${msg.error ? 'bg-red-900/20 border border-red-800' : 'bg-zinc-900/60 border border-zinc-800'}`}>
                          {msg.loading ? (
                            <div className="flex items-center gap-2 text-zinc-400">
                              <Loader2 className="h-4 w-4 animate-spin text-yellow-500 shrink-0" />
                              <span className="text-xs sm:text-sm">Analyzing your business data...</span>
                            </div>
                          ) : (
                            <>
                              <div className="prose prose-invert prose-sm max-w-none">
                                <MarkdownContent content={msg.content} />
                              </div>

                              {msg.toolCalls && msg.toolCalls.length > 0 && (
                                <div className="mt-3 pt-3 border-t border-zinc-800">
                                  <div className="flex items-center gap-1.5 text-xs text-zinc-500 mb-1.5">
                                    <Wrench className="h-3 w-3" />
                                    <span>Tools used ({msg.toolCalls.length})</span>
                                  </div>
                                  <div className="flex flex-wrap gap-1">
                                    {msg.toolCalls.map((tc, i) => (
                                      <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700">
                                        {tc.toolName.replace(/_/g, ' ')}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {msg.dateRangeLabel && (
                                <div className="mt-2 flex items-center gap-1.5 text-xs text-zinc-500">
                                  <Clock className="h-3 w-3" />
                                  <span>Period: {msg.dateRangeLabel}</span>
                                  {msg.model && msg.model !== 'fallback' && (
                                    <span className="text-zinc-600">· {msg.model}</span>
                                  )}
                                </div>
                              )}

                              {!msg.loading && !msg.error && (
                                <div className="mt-3 flex items-center gap-2">
                                  <button
                                    onClick={() => handleCopy(msg.content)}
                                    className="text-zinc-500 hover:text-yellow-500 transition-colors"
                                    title="Copy"
                                  >
                                    <Copy className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleRetry(msg.id)}
                                    className="text-zinc-500 hover:text-yellow-500 transition-colors"
                                    title="Retry"
                                  >
                                    <RefreshCw className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleFeedback(msg.id, true)}
                                    className="text-zinc-500 hover:text-green-500 transition-colors"
                                    title="Good answer"
                                  >
                                    <ThumbsUp className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleFeedback(msg.id, false)}
                                    className="text-zinc-500 hover:text-red-500 transition-colors"
                                    title="Needs improvement"
                                  >
                                    <ThumbsDown className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              <div className="border-t border-zinc-800 p-2 sm:p-3 lg:p-4">
                <div className="flex gap-2">
                  <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
                    placeholder="Ask about your business..."
                    disabled={loading}
                    className="bg-zinc-900 border-zinc-700 text-white placeholder-zinc-500"
                  />
                  {loading ? (
                    <Button onClick={handleStop} variant="outline" className="border-red-500/40 text-red-400 hover:bg-red-500/10 shrink-0 px-3">
                      <span className="text-xs sm:text-sm">Stop</span>
                    </Button>
                  ) : (
                    <Button
                      onClick={() => handleSend()}
                      disabled={!input.trim()}
                      className="gold-gradient text-black font-bold shrink-0 px-3"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          </div>
        </div>
      </DashboardLayout>
    </AuthGuard>
  )
}

function MarkdownContent({ content }: { content: string }) {
  const lines = content.split('\n')
  const elements: React.ReactNode[] = []

  lines.forEach((line, i) => {
    if (line.startsWith('**') && line.endsWith('**')) {
      elements.push(<p key={i} className="font-bold text-yellow-500 mt-2 mb-1 text-sm sm:text-base">{line.slice(2, -2)}</p>)
    } else if (line.startsWith('- ')) {
      elements.push(<p key={i} className="text-xs sm:text-sm text-zinc-300 ml-4 mb-0.5">• {line.slice(2)}</p>)
    } else if (line.startsWith('  ')) {
      elements.push(<p key={i} className="text-xs text-zinc-400 ml-8 mb-0.5">{line.trim()}</p>)
    } else if (line.match(/^\d+\.\s/)) {
      elements.push(<p key={i} className="text-xs sm:text-sm text-zinc-300 ml-4 mb-0.5">{line}</p>)
    } else if (line.trim() === '') {
      elements.push(<div key={i} className="h-2" />)
    } else {
      const parts = line.split(/(\*\*[^*]+\*\*)/g)
      const rendered = parts.map((part, j) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={j} className="text-yellow-400">{part.slice(2, -2)}</strong>
        }
        return <span key={j}>{part}</span>
      })
      elements.push(<p key={i} className="text-xs sm:text-sm text-zinc-200 mb-1">{rendered}</p>)
    }
  })

  return <>{elements}</>
}
