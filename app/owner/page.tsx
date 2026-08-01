'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { ownerFetch } from '@/lib/owner-client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Building2,
  Wallet,
  Clock,
  AlertTriangle,
  XCircle,
  TrendingUp,
  Receipt,
  RefreshCw,
  Search,
  Download,
  CheckCircle2,
  Users,
  Filter,
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
  created_at: string
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

const STATUS_FILTERS = ['all', 'active', 'trialing', 'past_due', 'expired', 'canceled'] as const

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_STYLES[status] || STATUS_STYLES.canceled}`}>
      {status.replace('_', ' ')}
    </span>
  )
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString()
}

export default function OwnerDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [stores, setStores] = useState<StoreRow[]>([])
  const [payments, setPayments] = useState<PaymentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>('all')

  const load = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true)
    try {
      const [statsRes, storesRes, paymentsRes] = await Promise.all([
        ownerFetch('/api/owner/stats'),
        ownerFetch('/api/owner/stores'),
        ownerFetch('/api/owner/payments'),
      ])
      if (statsRes.ok) setStats(await statsRes.json())
      if (storesRes.ok) setStores((await storesRes.json()).stores)
      if (paymentsRes.ok) setPayments((await paymentsRes.json()).payments)
      setLastRefreshed(new Date())
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Auto-refresh every 60s
  useEffect(() => {
    const interval = setInterval(() => load(), 60000)
    return () => clearInterval(interval)
  }, [load])

  const filteredStores = useMemo(() => {
    let list = stores
    if (statusFilter !== 'all') list = list.filter((s) => s.subscription_status === statusFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter((s) => s.name.toLowerCase().includes(q) || s.owner_email.toLowerCase().includes(q))
    }
    return list
  }, [stores, statusFilter, search])

  const filteredPayments = useMemo(() => {
    if (paymentStatusFilter === 'all') return payments
    return payments.filter((p) => p.status === paymentStatusFilter)
  }, [payments, paymentStatusFilter])

  function exportCSV() {
    const header = 'Store,Email,Plan,Status,Trial Ends,Period End,Created\n'
    const rows = stores.map((s) =>
      [s.name, s.owner_email, s.plan, s.subscription_status, s.trial_ends_at || '', s.current_period_end || '', s.created_at].join(',')
    )
    const blob = new Blob([header + rows.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `emdpos-stores-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-6 w-6 text-yellow-500 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Platform Overview</h1>
          <p className="text-zinc-500 text-sm">
            Subscriptions and transactions across every client store.
            {lastRefreshed && <span className="ml-2 text-zinc-600">Updated {timeAgo(lastRefreshed.toISOString())}</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="border-zinc-700 text-zinc-400 hover:text-white"
            onClick={exportCSV}
          >
            <Download className="h-4 w-4 mr-1" /> Export
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="border-zinc-700 text-zinc-400 hover:text-white"
            onClick={() => load(true)}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Building2} label="Total Stores" value={stats?.totalStores ?? 0} />
        <StatCard icon={Wallet} label="Est. MRR" value={`GHS ${(stats?.mrr ?? 0).toLocaleString()}`} accent="text-green-400" />
        <StatCard icon={CheckCircle2} label="Active" value={stats?.active ?? 0} accent="text-green-400" />
        <StatCard icon={Clock} label="Trialing" value={stats?.trialing ?? 0} accent="text-yellow-400" />
        <StatCard icon={AlertTriangle} label="Past Due" value={stats?.pastDue ?? 0} accent="text-orange-400" />
        <StatCard icon={XCircle} label="Expired" value={stats?.expired ?? 0} accent="text-red-400" />
        <StatCard icon={TrendingUp} label="Revenue (30d)" value={`GHS ${(stats?.revenue30d ?? 0).toLocaleString()}`} accent="text-green-400" />
        <StatCard icon={Receipt} label="Payments OK / Failed" value={`${stats?.successfulPayments30d ?? 0} / ${stats?.failedPayments30d ?? 0}`} accent="text-zinc-300" />
      </div>

      <Card className="bg-zinc-950 border-zinc-800">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-white text-base flex items-center gap-2">
            <Users className="h-4 w-4 text-yellow-500" /> Stores
            <span className="text-xs text-zinc-500 font-normal ml-1">({filteredStores.length})</span>
          </CardTitle>
        </CardHeader>
        <div className="px-6 pb-3 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
            <Input
              placeholder="Search stores or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-zinc-900 border-zinc-700 text-white h-9"
            />
          </div>
          <div className="flex items-center gap-1">
            <Filter className="h-3.5 w-3.5 text-zinc-500" />
            {STATUS_FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                  statusFilter === f
                    ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30'
                    : 'text-zinc-500 border-zinc-800 hover:text-zinc-300'
                }`}
              >
                {f === 'all' ? 'All' : f.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>
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
                  <th className="px-6 py-2 font-medium">Joined</th>
                </tr>
              </thead>
              <tbody>
                {filteredStores.map((s) => (
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
                      {s.lastActiveAt ? timeAgo(s.lastActiveAt) : 'No activity'}
                    </td>
                    <td className="px-6 py-3 text-zinc-500 text-xs">
                      {s.created_at ? timeAgo(s.created_at) : '—'}
                    </td>
                  </tr>
                ))}
                {filteredStores.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-zinc-600">
                      {search || statusFilter !== 'all' ? 'No stores match your filter.' : 'No stores yet.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-zinc-950 border-zinc-800">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-white text-base flex items-center gap-2">
            <Receipt className="h-4 w-4 text-yellow-500" /> Recent Transactions
            <span className="text-xs text-zinc-500 font-normal ml-1">({filteredPayments.length})</span>
          </CardTitle>
          <div className="flex items-center gap-1">
            {['all', 'successful', 'pending', 'failed'].map((f) => (
              <button
                key={f}
                onClick={() => setPaymentStatusFilter(f)}
                className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                  paymentStatusFilter === f
                    ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30'
                    : 'text-zinc-500 border-zinc-800 hover:text-zinc-300'
                }`}
              >
                {f === 'all' ? 'All' : f}
              </button>
            ))}
          </div>
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
                {filteredPayments.map((p) => (
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
                    <td className="px-6 py-3 text-zinc-500 text-xs">{timeAgo(p.created_at)}</td>
                  </tr>
                ))}
                {filteredPayments.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-zinc-600">
                      {paymentStatusFilter !== 'all' ? 'No matching transactions.' : 'No transactions yet.'}
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
