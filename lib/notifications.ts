import { getSession, getStoreId } from '@/lib/auth'
import * as sync from '@/lib/sync'
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client'

export type NotificationType =
  | 'sale'
  | 'customer'
  | 'expense'
  | 'return'
  | 'suspend'
  | 'product'
  | 'login'

export interface AppNotification {
  id: string
  type: NotificationType
  title: string
  message: string
  /** Display name of the person who triggered it */
  actorName: string
  actorEmail: string
  /** Optional monetary amount (sales, expenses) */
  amount?: number
  /** Optional link the admin can jump to */
  href?: string
  read: boolean
  timestamp: string
  store_id?: string
}

const KEY = 'hoodmart_v2_notifications'
const MAX_STORED = 300

function get(): AppNotification[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as AppNotification[]) : []
  } catch {
    return []
  }
}

function set(list: AppNotification[]) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX_STORED)))
    window.dispatchEvent(new Event('hoodmart:notifications'))
  } catch {
    /* quota exceeded — ignore */
  }
}

function uuid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

export const notifications = {
  list: (): AppNotification[] => get(),

  unreadCount: (): number => get().filter((n) => !n.read).length,

  markRead: (id: string) => {
    set(get().map((n) => (n.id === id ? { ...n, read: true } : n)))
  },

  markAllRead: () => {
    set(get().map((n) => ({ ...n, read: true })))
  },

  clear: () => set([]),

  /** Record an activity notification. Safe to call from anywhere; never throws. */
  push: (
    type: NotificationType,
    title: string,
    message: string,
    opts: { amount?: number; href?: string } = {}
  ) => {
    try {
      const session = getSession()
      const notification: AppNotification = {
        id: uuid(),
        type,
        title,
        message,
        actorName: session?.user?.name || 'Unknown',
        actorEmail: session?.user?.email || '',
        amount: opts.amount,
        href: opts.href,
        read: false,
        timestamp: new Date().toISOString(),
        store_id: getStoreId(),
      }
      const list = get()
      list.unshift(notification)
      set(list)
      // Push to Supabase so the admin sees it on their own device
      sync.pushLocalChange('notifications', notification).catch(() => {})
    } catch {
      /* never break the caller */
    }
  },
}

/**
 * Pull notifications from Supabase and merge with local ones.
 * This lets the admin see sales made on other devices/cashier terminals.
 * Returns true if new notifications were added.
 */
export async function pullRemoteNotifications(): Promise<boolean> {
  if (!isSupabaseConfigured() || !supabase) return false
  const storeId = getStoreId()
  if (!storeId) return false
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('store_id', storeId)
      .order('timestamp', { ascending: false })
      .limit(MAX_STORED)
    if (error || !Array.isArray(data)) return false
    const local = get()
    const localIds = new Set(local.map((n) => n.id))
    let added = false
    for (const remote of data) {
      if (!localIds.has(remote.id)) {
        // Ensure required fields exist
        const n: AppNotification = {
          id: remote.id,
          type: (remote.type as NotificationType) || 'sale',
          title: remote.title || 'Notification',
          message: remote.message || '',
          actorName: remote.actorName || 'Unknown',
          actorEmail: remote.actorEmail || '',
          amount: remote.amount ?? undefined,
          href: remote.href ?? undefined,
          read: remote.read ?? false,
          timestamp: remote.timestamp || new Date().toISOString(),
          store_id: remote.store_id,
        }
        local.push(n)
        added = true
      }
    }
    if (added) {
      // Sort newest first and cap
      local.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      set(local.slice(0, MAX_STORED))
    }
    return added
  } catch {
    return false
  }
}

/** Subscribe to notification changes (same-tab + cross-tab). */
export function onNotificationsChange(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  const handler = () => cb()
  window.addEventListener('hoodmart:notifications', handler)
  window.addEventListener('storage', handler)
  return () => {
    window.removeEventListener('hoodmart:notifications', handler)
    window.removeEventListener('storage', handler)
  }
}

/** Fire-and-forget email to the store admin. Never throws. */
export async function emailAdmin(subject: string, html: string): Promise<void> {
  try {
    await fetch('/api/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'admin', subject, html }),
    })
  } catch {
    /* offline or not configured — ignore */
  }
}
