export interface Conversation {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  archivedAt: string | null
}

export interface Message {
  id: string
  conversationId: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  toolCalls?: Array<{
    toolName: string
    data: unknown
  }>
  dateRangeLabel?: string
  model?: string
}

const CONV_KEY = 'emdpos_ai_conversations'
const MSG_KEY = 'emdpos_ai_messages'

function uuid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

function getConversations(): Conversation[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(CONV_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveConversations(convs: Conversation[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem(CONV_KEY, JSON.stringify(convs))
}

function getMessages(): Message[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(MSG_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveMessages(msgs: Message[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem(MSG_KEY, JSON.stringify(msgs))
}

export const conversationStore = {
  listConversations(): Conversation[] {
    return getConversations().sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  },

  createConversation(title?: string): Conversation {
    const now = new Date().toISOString()
    const conv: Conversation = {
      id: uuid(),
      title: title || 'New conversation',
      createdAt: now,
      updatedAt: now,
      archivedAt: null,
    }
    const convs = getConversations()
    convs.push(conv)
    saveConversations(convs)
    return conv
  },

  deleteConversation(id: string) {
    saveConversations(getConversations().filter((c) => c.id !== id))
    saveMessages(getMessages().filter((m) => m.conversationId !== id))
  },

  updateConversationTitle(id: string, title: string) {
    const convs = getConversations()
    const idx = convs.findIndex((c) => c.id === id)
    if (idx >= 0) {
      convs[idx].title = title
      convs[idx].updatedAt = new Date().toISOString()
      saveConversations(convs)
    }
  },

  getMessages(conversationId: string): Message[] {
    return getMessages()
      .filter((m) => m.conversationId === conversationId)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
  },

  addMessage(msg: Omit<Message, 'id' | 'timestamp'>): Message {
    const full: Message = {
      ...msg,
      id: uuid(),
      timestamp: new Date().toISOString(),
    }
    const msgs = getMessages()
    msgs.push(full)
    saveMessages(msgs)

    const convs = getConversations()
    const idx = convs.findIndex((c) => c.id === msg.conversationId)
    if (idx >= 0) {
      convs[idx].updatedAt = new Date().toISOString()
      if (msg.role === 'user' && convs[idx].title === 'New conversation') {
        convs[idx].title = msg.content.slice(0, 40)
      }
      saveConversations(convs)
    }

    return full
  },

  clearAll() {
    if (typeof window === 'undefined') return
    localStorage.removeItem(CONV_KEY)
    localStorage.removeItem(MSG_KEY)
  },
}
