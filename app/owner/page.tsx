'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ownerFetch } from '@/lib/owner-client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Building2,
  Wallet,
  Clock,
  AlertTriangle,
  XCircle,
  TrendingUp,
  Receipt,
} from 'lucide-react'

interface Stats {
  totalStores: number
  active: number
  trialing: number
  pastDue: number
  expired: number
  canceled: number
  mrr: number
  revenue30d: number
  successfulPayments30d: number
  failedPayments30d: number
}

interface StoreRow {
  id: string
  name: string
  owner_email: string
  plan: string
  subscription_status: string
  trial_ends_at: string | null
  current_period_end: string | null
  lastActiveAt: string | null
}

interface PaymentRow {
  id: string
  storeName: string
  provider: string
  amount: number
  currency: string
  plan: string
  status: string
  created_at: string
}

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-green-500/10 text-green-400 border-green-500/30',
  trialing: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
  past_due: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
  expired: 'bg-red-500/10 text-red-400 border-red-500/30',
  canceled: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/30',
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_STYLES[status] || STATUS_STYLES.canceled}`}>
      {status.replace('_', ' ')}
    </span>
  )
}

export default function OwnerDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [stores, setStores] = useState<StoreRow[]>([])
  const [payments, setPayments] = useState<PaymentRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [statsRes, storesRes, paymentsRes] = await Promise.all([
        ownerFetch('/api/owner/stats'),
        ownerFetch('/api/owner/stores'),
        ownerFetch('/api/owner/payments'),
      ])
      if (statsRes.ok) setStats(await statsRes.json())
      if (storesRes.ok) setStores((await storesRes.json()).stores)
      if (paymentsRes.ok) setPayments((await paymentsRes.json()).payments)
      setLoading(false)
    }
    load()
  }, [])

  if (loading) {
    return <div className="text-zinc-500 text-sm">Loading platform data…</div>
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Platform Overview</h1>
        <p className="text-zinc-500 text-sm">Subscriptions and transactions across every client store.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Building2} label="Total Stores" value={stats?.totalStores ?? 0} />
        <StatCard icon={Wallet} label="Est. MRR" value={`GHS ${stats?.mrr ?? 0}`} accent="text-green-400" />
        <StatCard icon={Clock} label="Trialing" value={stats?.trialing ?? 0} accent="text-yellow-400" />
        <StatCard icon={AlertTriangle} label="Past Due" value={stats?.pastDue ?? 0} accent="text-orange-400" />
        <StatCard icon={XCircle} label="Expired" value={stats?.expired ?? 0} accent="text-red-400" />
        <StatCard icon={TrendingUp} label="Revenue (30d)" value={`GHS ${stats?.revenue30d ?? 0}`} accent="text-green-400" />
        <StatCard icon={Receipt} label="Payments OK (30d)" value={stats?.successfulPayments30d ?? 0} accent="text-green-400" />
        <StatCard icon={XCircle} label="Payments Failed (30d)" value={stats?.failedPayments30d ?? 0} accent="text-red-400" />
      </div>

      <Card className="bg-zinc-950 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-white text-base">Stores</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-zinc-500 border-b border-zinc-800">
                  <th className="px-6 py-2 font-medium">Store</th>
                  <th className="px-6 py-2 font-medium">Plan</th>
                  <th className="px-6 py-2 font-medium">Status</th>
                  <th className="px-6 py-2 font-medium">Renews / Trial Ends</th>
                  <th className="px-6 py-2 font-medium">Last Active</th>
                </tr>
              </thead>
              <tbody>
                {stores.map((s) => (
                  <tr key={s.id} className="border-b border-zinc-900 hover:bg-zinc-900/50 transition-colors">
                    <td className="px-6 py-3">
                      <Link href={`/owner/stores/${s.id}`} className="text-white hover:text-yellow-400 font-medium">
                        {s.name}
                      </Link>
                      <div className="text-xs text-zinc-500">{s.owner_email}</div>
                    </td>
                    <td className="px-6 py-3 text-zinc-300 capitalize">{s.plan}</td>
                    <td className="px-6 py-3">
                      <StatusBadge status={s.subscription_status} />
                    </td>
                    <td className="px-6 py-3 text-zinc-400 text-xs">
                      {(s.subscription_status === 'trialing' ? s.trial_ends_at : s.current_period_end)
                        ? new Date((s.subscription_status === 'trialing' ? s.trial_ends_at : s.current_period_end) as string).toLocaleDateString()
                        : '—'}
                    </td>
                    <td className="px-6 py-3 text-zinc-400 text-xs">
                      {s.lastActiveAt ? new Date(s.lastActiveAt).toLocaleString() : 'No activity yet'}
                    </td>
                  </tr>
                ))}
                {stores.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-zinc-600">
                      No stores yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-zinc-950 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-white text-base">Recent Transactions</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-zinc-500 border-b border-zinc-800">
                  <th className="px-6 py-2 font-medium">Store</th>
                  <th className="px-6 py-2 font-medium">Plan</th>
                  <th className="px-6 py-2 font-medium">Amount</th>
                  <th className="px-6 py-2 font-medium">Provider</th>
                  <th className="px-6 py-2 font-medium">Status</th>
                  <th className="px-6 py-2 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="border-b border-zinc-900 hover:bg-zinc-900/50 transition-colors">
                    <td className="px-6 py-3 text-white">{p.storeName}</td>
                    <td className="px-6 py-3 text-zinc-300 capitalize">{p.plan}</td>
                    <td className="px-6 py-3 text-zinc-300">
                      {p.currency} {p.amount}
                    </td>
                    <td className="px-6 py-3 text-zinc-400 capitalize">{p.provider}</td>
                    <td className="px-6 py-3">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full border ${
                          p.status === 'successful'
                            ? 'bg-green-500/10 text-green-400 border-green-500/30'
                            : p.status === 'failed'
                            ? 'bg-red-500/10 text-red-400 border-red-500/30'
                            : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30'
                        }`}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-zinc-500 text-xs">{new Date(p.created_at).toLocaleString()}</td>
                  </tr>
                ))}
                {payments.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-zinc-600">
                      No transactions yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string | number
  accent?: string
}) {
  return (
    <Card className="bg-zinc-950 border-zinc-800">
      <CardContent className="p-4 space-y-2">
        <div className="flex items-center gap-2 text-zinc-500 text-xs">
          <Icon className="h-4 w-4" />
          {label}
        </div>
        <p className={`text-xl font-bold ${accent || 'text-white'}`}>{value}</p>
      </CardContent>
    </Card>
  )
}
