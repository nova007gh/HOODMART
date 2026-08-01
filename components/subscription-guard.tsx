'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { getSubscriptionInfo, SubscriptionInfo } from '@/lib/subscription'
import { Button } from '@/components/ui/button'
import { Lock, Clock } from 'lucide-react'

const EXEMPT_PATHS = ['/billing', '/login']

export function SubscriptionBanner() {
  const [info, setInfo] = useState<SubscriptionInfo | null>(null)
  const router = useRouter()

  useEffect(() => {
    getSubscriptionInfo().then(setInfo)
  }, [])

  if (!info) return null
  if (info.status !== 'trialing') return null
  if (info.daysRemaining === null || info.daysRemaining > 3) return null

  return (
    <div className="bg-yellow-500/10 border-b border-yellow-500/30 px-4 py-2 flex items-center justify-between gap-3 text-sm">
      <div className="flex items-center gap-2 text-yellow-400">
        <Clock className="h-4 w-4" />
        {info.daysRemaining <= 0
          ? 'Your free trial has ended.'
          : `Your free trial ends in ${info.daysRemaining} day${info.daysRemaining === 1 ? '' : 's'}.`}
      </div>
      <Button size="sm" className="gold-gradient text-black" onClick={() => router.push('/billing')}>
        Upgrade Now
      </Button>
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
            Renew your subscription to continue using EMDPOS Retail OS. Your data is safe and will be restored immediately after payment.
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
