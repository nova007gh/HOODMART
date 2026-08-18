'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { notifications, onNotificationsChange, pullRemoteNotifications, AppNotification } from '@/lib/notifications'
import { money } from '@/lib/store'
import {
  Bell,
  ShoppingCart,
  UserPlus,
  Receipt,
  Undo2,
  Archive,
  Package,
  LogIn,
  CheckCheck,
  X,
} from 'lucide-react'

const ICONS: Record<AppNotification['type'], typeof Bell> = {
  sale: ShoppingCart,
  customer: UserPlus,
  expense: Receipt,
  return: Undo2,
  suspend: Archive,
  product: Package,
  login: LogIn,
}

const ACCENTS: Record<AppNotification['type'], string> = {
  sale: 'text-emerald-400 bg-emerald-500/10',
  customer: 'text-sky-400 bg-sky-500/10',
  expense: 'text-orange-400 bg-orange-500/10',
  return: 'text-rose-400 bg-rose-500/10',
  suspend: 'text-zinc-400 bg-zinc-500/10',
  product: 'text-violet-400 bg-violet-500/10',
  login: 'text-yellow-400 bg-yellow-500/10',
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString()
}

export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<AppNotification[]>([])
  const [unread, setUnread] = useState(0)
  const panelRef = useRef<HTMLDivElement>(null)

  const refresh = () => {
    setItems(notifications.list().slice(0, 40))
    setUnread(notifications.unreadCount())
  }

  useEffect(() => {
    refresh()
    const unsub = onNotificationsChange(refresh)
    // Refresh from local storage frequently
    const interval = setInterval(refresh, 15000)
    // Pull from Supabase every 30s so the admin sees sales from
    // other cashier terminals / devices in near-real-time
    const remoteInterval = setInterval(async () => {
      const added = await pullRemoteNotifications()
      if (added) refresh()
    }, 30000)
    // Also pull once on mount
    pullRemoteNotifications().then((added) => { if (added) refresh() })
    return () => {
      unsub()
      clearInterval(interval)
      clearInterval(remoteInterval)
    }
  }, [])

  // Close on outside click / Escape
  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const handleMarkAll = () => {
    notifications.markAllRead()
    refresh()
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Notifications"
        className="relative flex h-10 w-10 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900/80 text-zinc-300 transition-all hover:border-yellow-500/50 hover:text-yellow-400 active:scale-95"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-yellow-500 px-1 text-[10px] font-bold text-black shadow-[0_0_10px_rgba(250,204,21,0.6)]">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-50 w-[min(92vw,22rem)] origin-top-right animate-in overflow-hidden rounded-xl border border-yellow-500/20 bg-zinc-900/95 shadow-2xl backdrop-blur-xl">
          <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-yellow-500" />
              <p className="text-sm font-semibold text-white">Activity</p>
              {unread > 0 && (
                <span className="rounded-full bg-yellow-500/15 px-2 py-0.5 text-[10px] font-bold text-yellow-400">
                  {unread} new
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unread > 0 && (
                <button
                  onClick={handleMarkAll}
                  title="Mark all as read"
                  className="rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-yellow-400"
                >
                  <CheckCheck className="h-4 w-4" />
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="max-h-[26rem] overflow-y-auto overscroll-contain">
            {items.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800">
                  <Bell className="h-5 w-5 text-zinc-500" />
                </div>
                <p className="text-sm text-zinc-400">No activity yet</p>
                <p className="text-xs text-zinc-600">
                  Sales and updates from your team will appear here.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-zinc-800/70">
                {items.map((n) => {
                  const Icon = ICONS[n.type] ?? Bell
                  const accent = ACCENTS[n.type] ?? 'text-zinc-400 bg-zinc-500/10'
                  const body = (
                    <div
                      className={`flex gap-3 px-4 py-3 transition-colors hover:bg-zinc-800/50 ${
                        n.read ? '' : 'bg-yellow-500/[0.04]'
                      }`}
                    >
                      <div
                        className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${accent}`}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="truncate text-sm font-medium text-white">{n.title}</p>
                          {typeof n.amount === 'number' && (
                            <span className="shrink-0 text-sm font-bold text-yellow-400">
                              {money(n.amount)}
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 line-clamp-2 text-xs text-zinc-400">{n.message}</p>
                        <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-zinc-500">
                          <span className="truncate font-medium text-zinc-400">{n.actorName}</span>
                          <span aria-hidden>·</span>
                          <span className="shrink-0">{timeAgo(n.timestamp)}</span>
                          {!n.read && (
                            <span className="ml-auto h-2 w-2 shrink-0 rounded-full bg-yellow-500" />
                          )}
                        </div>
                      </div>
                    </div>
                  )

                  return (
                    <li key={n.id}>
                      {n.href ? (
                        <Link
                          href={n.href}
                          onClick={() => {
                            notifications.markRead(n.id)
                            setOpen(false)
                          }}
                          className="block"
                        >
                          {body}
                        </Link>
                      ) : (
                        <button
                          onClick={() => {
                            notifications.markRead(n.id)
                            refresh()
                          }}
                          className="block w-full text-left"
                        >
                          {body}
                        </button>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          {items.length > 0 && (
            <div className="border-t border-zinc-800 px-4 py-2.5">
              <Link
                href="/activities"
                onClick={() => setOpen(false)}
                className="block text-center text-xs font-medium text-yellow-500 transition-colors hover:text-yellow-400"
              >
                View all activity
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
