'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getSession } from '@/lib/auth'
import { store, money } from '@/lib/store'
import { Camera, Clock, Receipt, ShoppingBag, User as UserIcon } from 'lucide-react'

interface Me {
  name: string
  role: string
  email: string
  avatar?: string
  phone?: string
}

/** Bold identity card for the person currently selling — shown at the top of the POS. */
export function CashierCard({ refreshKey = 0 }: { refreshKey?: number }) {
  const [me, setMe] = useState<Me | null>(null)
  const [stats, setStats] = useState({ count: 0, total: 0, items: 0 })
  const [now, setNow] = useState<Date | null>(null)

  const load = () => {
    const session = getSession()
    if (!session) return
    const { user } = session
    const emp = store.getEmployees().find((e) => e.email?.toLowerCase() === user.email)
    setMe({
      name: emp?.name || user.name || 'Sales Person',
      role: user.role || 'cashier',
      email: user.email,
      avatar: emp?.avatar || user.avatar,
      phone: emp?.phone || user.phone,
    })

    // Today's takings for THIS person only
    const today = new Date().toISOString().slice(0, 10)
    const mine = store
      .getSales()
      .filter((s) => String(s.timestamp || '').slice(0, 10) === today)
      .filter((s) => (s.userEmail || '').toLowerCase() === user.email)
    setStats({
      count: mine.length,
      total: mine.reduce((sum, s) => sum + (s.total || 0), 0),
      items: mine.reduce((sum, s) => sum + s.items.reduce((a, i) => a + (i.qty || 0), 0), 0),
    })
  }

  useEffect(() => {
    load()
    const onProfile = () => load()
    window.addEventListener('hoodmart:profile', onProfile)
    return () => window.removeEventListener('hoodmart:profile', onProfile)
  }, [refreshKey])

  useEffect(() => {
    setNow(new Date())
    const t = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(t)
  }, [])

  if (!me) return null

  const initials = me.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('')

  return (
    <div className="animate-slide-up relative overflow-hidden rounded-xl border border-yellow-500/25 bg-gradient-to-br from-yellow-500/[0.07] via-zinc-900 to-zinc-900 p-4">
      {/* soft glow, pointer-events-none so it never blocks clicks */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-yellow-500/10 blur-3xl"
      />

      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center">
        {/* Identity */}
        <div className="flex min-w-0 flex-1 items-center gap-3.5">
          <Link href="/profile" className="group relative shrink-0" title="Edit my profile">
            {me.avatar ? (
              <img
                src={me.avatar}
                alt={me.name}
                className="h-16 w-16 rounded-full object-cover ring-2 ring-yellow-500/60 transition-transform group-hover:scale-105 sm:h-[68px] sm:w-[68px]"
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-zinc-800 text-lg font-bold text-zinc-400 ring-2 ring-zinc-600 transition-transform group-hover:scale-105 sm:h-[68px] sm:w-[68px]">
                {initials || <UserIcon className="h-7 w-7" />}
              </div>
            )}
            <span className="absolute -bottom-0.5 -right-0.5 flex h-6 w-6 items-center justify-center rounded-full gold-gradient text-black opacity-0 shadow transition-opacity group-hover:opacity-100">
              <Camera className="h-3 w-3" />
            </span>
            {/* online dot */}
            <span className="absolute right-0 top-0 h-3.5 w-3.5 rounded-full border-2 border-zinc-900 bg-emerald-500" />
          </Link>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h2 className="truncate text-lg font-bold leading-tight text-white sm:text-xl">
                {me.name}
              </h2>
              <span className="shrink-0 rounded-full border border-yellow-500/30 bg-yellow-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-yellow-400">
                {me.role}
              </span>
            </div>
            <p className="mt-0.5 truncate text-xs text-zinc-400">{me.email}</p>
            {now && (
              <p className="mt-1 flex items-center gap-1.5 text-[11px] text-zinc-500">
                <Clock className="h-3 w-3 shrink-0" />
                <span className="truncate">
                  {now.toLocaleDateString(undefined, {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                  })}
                  {' · '}
                  {now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                </span>
              </p>
            )}
          </div>
        </div>

        {/* My takings today — wraps cleanly, never overlaps */}
        <div className="grid shrink-0 grid-cols-3 gap-2 sm:gap-3">
          <Stat icon={Receipt} label="My Sales" value={String(stats.count)} />
          <Stat icon={ShoppingBag} label="Items" value={String(stats.items)} />
          <Stat label="My Total" value={money(stats.total)} highlight />
        </div>
      </div>
    </div>
  )
}

function Stat({
  icon: Icon,
  label,
  value,
  highlight,
}: {
  icon?: typeof Receipt
  label: string
  value: string
  highlight?: boolean
}) {
  return (
    <div
      className={`rounded-lg border px-2.5 py-2 text-center sm:min-w-[84px] ${
        highlight
          ? 'border-yellow-500/30 bg-yellow-500/[0.08]'
          : 'border-zinc-700/60 bg-zinc-950/50'
      }`}
    >
      <p className="flex items-center justify-center gap-1 text-[10px] uppercase tracking-wide text-zinc-500">
        {Icon && <Icon className="h-3 w-3 shrink-0" />}
        <span className="truncate">{label}</span>
      </p>
      <p
        className={`mt-0.5 truncate text-sm font-bold sm:text-base ${
          highlight ? 'gold-text' : 'text-white'
        }`}
      >
        {value}
      </p>
    </div>
  )
}
