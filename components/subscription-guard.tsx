'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { getSubscriptionInfo, SubscriptionInfo } from '@/lib/subscription'
import { getSubscriptionNotice } from '@/lib/subscription-status'
import { Button } from '@/components/ui/button'
import { Lock, Clock } from 'lucide-react'

const EXEMPT_PATHS = ['/billing', '/login']

export function SubscriptionBanner({ canManageBilling = false }: { canManageBilling?: boolean }) {
  const [info, setInfo] = useState<SubscriptionInfo | null>(null)
  const router = useRouter()

  useEffect(() => {
    let active = true
    let pending = false
    const refresh = async () => {
      if (pending) return
      pending = true
      try {
        const next = await getSubscriptionInfo()
        if (active) setInfo(next)
      } finally {
        pending = false
      }
    }
    const refreshVisible = () => {
      if (document.visibilityState === 'visible') void refresh()
    }
    void refresh()
    const interval = window.setInterval(refreshVisible, 5 * 60 * 1000)
    window.addEventListener('focus', refreshVisible)
    window.addEventListener('online', refreshVisible)
    document.addEventListener('visibilitychange', refreshVisible)
    return () => {
      active = false
      window.clearInterval(interval)
      window.removeEventListener('focus', refreshVisible)
      window.removeEventListener('online', refreshVisible)
      document.removeEventListener('visibilitychange', refreshVisible)
    }
  }, [])

  if (!info) return null
  const notice = getSubscriptionNotice(info)
  if (!notice) return null
  const toneClass = notice.tone === 'danger'
    ? 'bg-red-500/10 border-red-500/30 text-red-300'
    : notice.tone === 'warning'
      ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400'
      : 'bg-blue-500/10 border-blue-500/30 text-blue-300'

  return (
    <div role="status" className={`border-b px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-sm ${toneClass}`}>
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <Clock className="h-4 w-4 shrink-0" />
        <span>{notice.message}{!canManageBilling && notice.tone !== 'info' && ' Please contact your administrator about renewal.'}</span>
      </div>
      {canManageBilling && (
        <Button size="sm" className="gold-gradient text-black shrink-0" onClick={() => router.push('/billing')}>
          {notice.action}
        </Button>
      )}
    </div>
  )
}

export function SubscriptionGuard({ children }: { children: React.ReactNode }) {
  const [info, setInfo] = useState<SubscriptionInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    getSubscriptionInfo()
      .then(setInfo)
      .finally(() => setLoading(false))
  }, [])

  const exempt = EXEMPT_PATHS.some((p) => pathname?.startsWith(p))

  if (loading || exempt) return <>{children}</>

  if (info && !info.isAllowed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 p-6">
        <div className="max-w-md w-full text-center space-y-4 glass-card p-8 rounded-xl">
          <div className="mx-auto w-14 h-14 rounded-full bg-yellow-500/10 flex items-center justify-center">
            <Lock className="h-7 w-7 text-yellow-500" />
          </div>
          <h2 className="text-xl font-bold text-white">
            {info.status === 'trialing' ? 'Your free trial has ended' : 'Subscription required'}
          </h2>
          <p className="text-zinc-400 text-sm">
            Renew your subscription to continue using HOODMART Retail OS. Your data is safe and will be restored immediately after payment.
          </p>
          <Button className="gold-gradient text-black w-full" onClick={() => router.push('/billing')}>
            Go to Billing
          </Button>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
