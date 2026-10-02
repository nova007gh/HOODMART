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
  Calendar,
  Crown,
  Zap,
  Activity,
  CreditCard,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
  UserPlus,
  Percent,
  RotateCcw,
  LogIn,
  Database,
  ShoppingCart,
  Plus,
  X,
  CalendarClock,
  KeyRound,
  Copy,
  Store,
} from 'lucide-react'
import { PLAN_PRICE_GHS, PlanKey } from '@/lib/subscription'

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
  subscription_provider: string | null
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

interface LoginRow {
  email: string
  lastSignInAt: string | null
  store_id: string | null
  storeName: string | null
  role: string | null
}

interface SaleFeedRow {
  id: string
  store_id: string
  storeName: string
  cashier: string
  total: number
  timestamp: string
}

interface StoreSeries {
  store_id: string
  storeName: string
  points: { key: string; total: number; count: number }[]
}

interface UsageRow {
  store_id: string
  storeName: string
  products: number
  sales: number
  customers: number
  employees: number
  activities: number
}

interface ActivityData {
  logins: LoginRow[]
  recentSales: SaleFeedRow[]
  salesByDay: StoreSeries[]
  salesByWeek: StoreSeries[]
  salesByMonth: StoreSeries[]
  usage: UsageRow[]
}

const STORE_COLORS = [
  'from-yellow-600 to-yellow-400',
  'from-emerald-600 to-emerald-400',
  'from-sky-600 to-sky-400',
  'from-violet-600 to-violet-400',
]

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

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null
  const diffMs = new Date(dateStr).getTime() - Date.now()
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24))
}

function daysLabel(days: number | null): string {
  if (days === null) return '—'
  if (days < 0) return `${Math.abs(days)}d overdue`
  if (days === 0) return 'Today'
  if (days === 1) return '1 day left'
  return `${days} days left`
}

type StoreHealth = 'good' | 'warn' | 'critical'

function storeHealth(status: string, daysRemaining: number | null): StoreHealth {
  if (status === 'past_due' || status === 'expired' || status === 'canceled') return 'critical'
  if (daysRemaining !== null && daysRemaining <= 0) return 'critical'
  if (daysRemaining !== null && daysRemaining <= 7) return 'warn'
  return 'good'
}

const HEALTH_META: Record<StoreHealth, { label: string; dot: string; text: string; ring: string }> = {
  good: { label: 'Paid', dot: 'bg-emerald-400', text: 'text-emerald-400', ring: 'shadow-[0_0_8px_rgba(52,211,153,0.7)]' },
  warn: { label: 'Ending soon', dot: 'bg-amber-400', text: 'text-amber-400', ring: 'shadow-[0_0_8px_rgba(251,191,36,0.7)]' },
  critical: { label: 'Blocked', dot: 'bg-red-500', text: 'text-red-400', ring: 'shadow-[0_0_10px_rgba(239,68,68,0.9)]' },
}

function HealthDot({ health, size = 'h-2.5 w-2.5' }: { health: StoreHealth; size?: string }) {
  const meta = HEALTH_META[health]
  if (health === 'critical') {
    return (
      <span className={`relative inline-flex ${size} shrink-0`}>
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-60" />
        <span className={`relative inline-flex ${size} rounded-full ${meta.dot} ${meta.ring}`} />
      </span>
    )
  }
  return <span className={`inline-flex ${size} shrink-0 rounded-full ${meta.dot} ${meta.ring}`} />
}

export default function OwnerDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [stores, setStores] = useState<StoreRow[]>([])
  const [payments, setPayments] = useState<PaymentRow[]>([])
  const [activity, setActivity] = useState<ActivityData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>('all')
  const [extendTarget, setExtendTarget] = useState<StoreRow | null>(null)
  const [renewTarget, setRenewTarget] = useState<StoreRow | null>(null)
  const [addStoreOpen, setAddStoreOpen] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true)
    setError(null)
    try {
      const [statsRes, storesRes, paymentsRes, activityRes] = await Promise.all([
        ownerFetch('/api/owner/stats'),
        ownerFetch('/api/owner/stores'),
        ownerFetch('/api/owner/payments'),
        ownerFetch('/api/owner/activity'),
      ])

      if (!statsRes.ok || !storesRes.ok || !paymentsRes.ok) {
        const failed = [statsRes, storesRes, paymentsRes].find((r) => !r.ok)
        setError(`Failed to load dashboard data. ${failed?.status === 500 ? 'Server configuration issue.' : 'Please try again.'}`)
        return
      }

      setStats(await statsRes.json())
      setStores((await storesRes.json()).stores)
      setPayments((await paymentsRes.json()).payments)
      if (activityRes.ok) setActivity(await activityRes.json())
      setLastRefreshed(new Date())
    } catch (err: any) {
      setError(err.message || 'Network error while loading dashboard.')
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

  // Plan distribution
  const planBreakdown = useMemo(() => {
    const counts: Record<string, number> = { basic: 0, pro: 0, free: 0 }
    stores.forEach((s) => {
      const plan = s.plan || 'free'
      counts[plan] = (counts[plan] || 0) + 1
    })
    return counts
  }, [stores])

  // Expiring soon (trial or subscription ending within 3 days)
  const expiringSoon = useMemo(() => {
    return stores
      .map((s) => {
        const endDate = s.subscription_status === 'trialing' ? s.trial_ends_at : s.current_period_end
        const days = daysUntil(endDate)
        return { ...s, daysRemaining: days, endDate }
      })
      .filter((s) => s.daysRemaining !== null && s.daysRemaining <= 7 && (s.subscription_status === 'trialing' || s.subscription_status === 'active'))
      .sort((a, b) => (a.daysRemaining ?? 0) - (b.daysRemaining ?? 0))
  }, [stores])

  // Renewals (successful payments in last 30 days)
  const recentRenewals = useMemo(() => {
    return payments
      .filter((p) => p.status === 'successful')
      .slice(0, 10)
  }, [payments])

  // Revenue chart data (last 14 days)
  const revenueChart = useMemo(() => {
    const days: { date: string; label: string; total: number }[] = []
    for (let i = 13; i >= 0; i--) {
      const dt = new Date()
      dt.setDate(dt.getDate() - i)
      const dateStr = dt.toISOString().slice(0, 10)
      const dayPayments = payments.filter((p) => p.status === 'successful' && p.created_at.startsWith(dateStr))
      days.push({
        date: dateStr,
        label: dt.toLocaleDateString(undefined, { weekday: 'short' }),
        total: dayPayments.reduce((sum, p) => sum + Number(p.amount), 0),
      })
    }
    return days
  }, [payments])

  const revenueChartMax = Math.max(1, ...revenueChart.map((d) => d.total))

  // Store enrichment with days remaining + health light
  const enrichedStores = useMemo(() => {
    return filteredStores.map((s) => {
      const endDate = s.subscription_status === 'trialing' ? s.trial_ends_at : s.current_period_end
      const daysRemaining = daysUntil(endDate)
      return { ...s, daysRemaining, health: storeHealth(s.subscription_status, daysRemaining) }
    })
  }, [filteredStores])

  // All stores needing attention (unfiltered), for the alert banner
  const attentionStores = useMemo(() => {
    return stores
      .map((s) => {
        const endDate = s.subscription_status === 'trialing' ? s.trial_ends_at : s.current_period_end
        const daysRemaining = daysUntil(endDate)
        return { ...s, daysRemaining, health: storeHealth(s.subscription_status, daysRemaining) }
      })
      .filter((s) => s.health !== 'good')
      .sort((a, b) => {
        if (a.health !== b.health) return a.health === 'critical' ? -1 : 1
        return (a.daysRemaining ?? 0) - (b.daysRemaining ?? 0)
      })
  }, [stores])

  const criticalCount = attentionStores.filter((s) => s.health === 'critical').length

  // New stores in last 7 days
  const newStoresThisWeek = useMemo(() => {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    return stores.filter((s) => new Date(s.created_at) >= weekAgo).length
  }, [stores])

  // Payment success rate (last 30 days)
  const paymentSuccessRate = useMemo(() => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const recent = payments.filter((p) => new Date(p.created_at) >= thirtyDaysAgo)
    if (recent.length === 0) return null
    const successful = recent.filter((p) => p.status === 'successful').length
    return Math.round((successful / recent.length) * 100)
  }, [payments])

  // Failed payments alert (last 30 days)
  const recentFailedPayments = useMemo(() => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    return payments.filter((p) => p.status === 'failed' && new Date(p.created_at) >= thirtyDaysAgo)
  }, [payments])

  // Weekly sales stacked by store (8 weeks)
  const weeklySales = useMemo(() => {
    const series = activity?.salesByWeek || []
    const keys = series[0]?.points.map((p) => p.key) || []
    const buckets = keys.map((key, i) => ({
      key,
      segments: series.map((s, si) => ({
        storeName: s.storeName,
        color: STORE_COLORS[si % STORE_COLORS.length],
        total: s.points[i]?.total || 0,
      })),
      total: series.reduce((sum, s) => sum + (s.points[i]?.total || 0), 0),
    }))
    return { buckets, max: Math.max(1, ...buckets.map((b) => b.total)) }
  }, [activity])

  // Monthly sales per store (6 months), newest first
  const monthlySales = useMemo(() => {
    const series = activity?.salesByMonth || []
    const keys = series[0]?.points.map((p) => p.key) || []
    return keys.map((key, i) => ({
      key,
      label: new Date(key + '-01T00:00:00Z').toLocaleDateString(undefined, { month: 'short', year: 'numeric' }),
      perStore: series.map((s) => ({ storeName: s.storeName, total: s.points[i]?.total || 0, count: s.points[i]?.count || 0 })),
      total: series.reduce((sum, s) => sum + (s.points[i]?.total || 0), 0),
    })).reverse()
  }, [activity])

  // Total rows across stores for the footprint share bars
  const totalRows = useMemo(() => {
    return (activity?.usage || []).reduce(
      (s, u) => s + u.products + u.sales + u.customers + u.employees + u.activities, 0
    )
  }, [activity])

  function exportCSV() {
    const header = 'Store,Email,Plan,Status,Trial Ends,Period End,Created\n'
    const rows = stores.map((s) =>
      [s.name, s.owner_email, s.plan, s.subscription_status, s.trial_ends_at || '', s.current_period_end || '', s.created_at].join(',')
    )
    const blob = new Blob([header + rows.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `hoodmart-stores-${new Date().toISOString().slice(0, 10)}.csv`
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

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-4">
        <AlertTriangle className="h-10 w-10 text-red-400" />
        <h2 className="text-xl font-bold text-white">Dashboard unavailable</h2>
        <p className="text-zinc-500 text-sm max-w-md text-center">{error}</p>
        <Button onClick={() => load(true)} className="gold-gradient text-black">
          <RefreshCw className="h-4 w-4 mr-2" /> Try Again
        </Button>
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
            size="sm"
            className="gold-gradient text-black font-semibold"
            onClick={() => setAddStoreOpen(true)}
          >
            <Plus className="h-4 w-4 mr-1" /> Add Store
          </Button>
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

      {notice && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-950/30 px-4 py-2.5 text-sm text-emerald-300">
          <CheckCircle2 className="h-4 w-4 shrink-0" /> {notice}
        </div>
      )}

      {attentionStores.length > 0 && (
        <div
          className={`relative overflow-hidden rounded-xl border px-5 py-4 ${
            criticalCount > 0
              ? 'border-red-500/50 bg-gradient-to-r from-red-950/60 via-zinc-950 to-zinc-950'
              : 'border-amber-500/40 bg-gradient-to-r from-amber-950/40 via-zinc-950 to-zinc-950'
          }`}
        >
          <span className={`absolute inset-y-0 left-0 w-1 ${criticalCount > 0 ? 'bg-red-500 animate-pulse' : 'bg-amber-400'}`} />
          <div className="flex flex-wrap items-center justify-between gap-4 pl-2">
            <div className="flex items-center gap-3">
              <HealthDot health={criticalCount > 0 ? 'critical' : 'warn'} size="h-3 w-3" />
              <div>
                <p className="text-sm font-semibold text-white">
                  {criticalCount > 0
                    ? `${criticalCount} store${criticalCount === 1 ? ' is' : 's are'} blocked — payment overdue`
                    : `${attentionStores.length} subscription${attentionStores.length === 1 ? '' : 's'} ending within 7 days`}
                </p>
                <p className="text-xs text-zinc-500">Renew or extend access to keep stores selling.</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {attentionStores.slice(0, 4).map((s) => (
                <button
                  key={s.id}
                  onClick={() => setRenewTarget(s)}
                  className={`flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                    s.health === 'critical'
                      ? 'border-red-500/40 bg-red-500/10 text-red-300 hover:bg-red-500/20'
                      : 'border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20'
                  }`}
                >
                  <HealthDot health={s.health} size="h-1.5 w-1.5" />
                  {s.name} · {daysLabel(s.daysRemaining)}
                </button>
              ))}
              {attentionStores.length > 4 && (
                <span className="text-xs text-zinc-500">+{attentionStores.length - 4} more</span>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Building2} label="Total Stores" value={stats?.totalStores ?? 0} />
        <StatCard icon={Wallet} label="Est. MRR" value={`GHS ${(stats?.mrr ?? 0).toLocaleString()}`} accent="text-green-400" />
        <StatCard icon={CheckCircle2} label="Active" value={stats?.active ?? 0} accent="text-green-400" />
        <StatCard icon={Clock} label="Trialing" value={stats?.trialing ?? 0} accent="text-yellow-400" />
        <StatCard icon={AlertTriangle} label="Past Due" value={stats?.pastDue ?? 0} accent="text-orange-400" />
        <StatCard icon={XCircle} label="Expired" value={stats?.expired ?? 0} accent="text-red-400" />
        <StatCard icon={TrendingUp} label="Revenue (30d)" value={`GHS ${(stats?.revenue30d ?? 0).toLocaleString()}`} accent="text-green-400" />
        <StatCard icon={Receipt} label="Payments OK / Failed" value={`${stats?.successfulPayments30d ?? 0} / ${stats?.failedPayments30d ?? 0}`} accent="text-zinc-300" />
        <StatCard icon={UserPlus} label="New Stores (7d)" value={newStoresThisWeek} accent="text-yellow-400" />
        <StatCard icon={Percent} label="Payment Success" value={paymentSuccessRate !== null ? `${paymentSuccessRate}%` : '—'} accent={paymentSuccessRate !== null && paymentSuccessRate >= 90 ? 'text-green-400' : paymentSuccessRate !== null ? 'text-yellow-400' : 'text-zinc-400'} />
      </div>

      {/* Plan Distribution + Revenue Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Plan Distribution */}
        <Card className="bg-zinc-950 border-zinc-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-white text-sm flex items-center gap-2">
              <Crown className="h-4 w-4 text-yellow-500" /> Plan Distribution
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-900/60 border border-zinc-800">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-yellow-500" />
                <span className="text-sm text-zinc-300">Basic (GHS 150)</span>
              </div>
              <span className="text-lg font-bold text-white">{planBreakdown.basic || 0}</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-900/60 border border-zinc-800">
              <div className="flex items-center gap-2">
                <Crown className="h-4 w-4 text-yellow-500" />
                <span className="text-sm text-zinc-300">Pro (GHS 300)</span>
              </div>
              <span className="text-lg font-bold text-white">{planBreakdown.pro || 0}</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-900/60 border border-zinc-800">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-zinc-500" />
                <span className="text-sm text-zinc-300">Free / Trial</span>
              </div>
              <span className="text-lg font-bold text-white">{planBreakdown.free || 0}</span>
            </div>
          </CardContent>
        </Card>

        {/* Revenue Chart */}
        <Card className="bg-zinc-950 border-zinc-800 lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-white text-sm flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-yellow-500" /> Revenue (14 days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-40 flex items-end gap-1.5">
              {revenueChart.map((d) => (
                <div key={d.date} className="flex-1 flex flex-col items-center gap-1 group">
                  <div className="w-full flex items-end justify-center" style={{ height: '140px' }}>
                    <div
                      className="w-full max-w-[24px] rounded-t bg-gradient-to-t from-yellow-600 to-yellow-400 transition-all hover:from-yellow-500 hover:to-yellow-300"
                      style={{ height: `${Math.max(2, (d.total / revenueChartMax) * 140)}px` }}
                      title={`GHS ${d.total}`}
                    />
                  </div>
                  <span className="text-[10px] text-zinc-600">{d.label}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-zinc-500">
              <span>Total: <span className="text-yellow-400 font-semibold">GHS {revenueChart.reduce((s, d) => s + d.total, 0).toLocaleString()}</span></span>
              <span>{revenueChart.filter((d) => d.total > 0).length} active days</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Live Activity: recent sales + sign-ins */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="bg-zinc-950 border-zinc-800 lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-white text-sm flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-emerald-400" /> Recent Sales
              <span className="text-xs text-zinc-500 font-normal">across all stores</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-zinc-900">
              {(activity?.recentSales || []).slice(0, 12).map((s) => (
                <div key={s.id} className="flex items-center gap-3 px-6 py-2.5 hover:bg-zinc-900/50 transition-colors">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-xs font-bold text-emerald-400">
                    {(s.cashier?.[0] || '?').toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-white">{s.cashier}</p>
                    <p className="text-xs text-zinc-500">{s.storeName}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold text-yellow-400">GHS {s.total.toLocaleString()}</p>
                    <p className="text-[11px] text-zinc-600">{s.timestamp ? timeAgo(s.timestamp) : '—'}</p>
                  </div>
                </div>
              ))}
              {!activity?.recentSales?.length && (
                <p className="px-6 py-8 text-center text-sm text-zinc-600">No sales recorded yet.</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-950 border-zinc-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-white text-sm flex items-center gap-2">
              <LogIn className="h-4 w-4 text-sky-400" /> Sign-in Activity
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-zinc-900">
              {(activity?.logins || []).map((l) => {
                const mins = l.lastSignInAt ? (Date.now() - new Date(l.lastSignInAt).getTime()) / 60000 : Infinity
                const online = mins < 30
                return (
                  <div key={l.email} className="flex items-center gap-3 px-6 py-2.5">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${online ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]' : 'bg-zinc-700'}`} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-white">{l.email}</p>
                      <p className="text-xs text-zinc-500">
                        {l.storeName || 'No store'}{l.role ? ` · ${l.role}` : ''}
                      </p>
                    </div>
                    <p className="shrink-0 text-[11px] text-zinc-600">{l.lastSignInAt ? timeAgo(l.lastSignInAt) : 'never'}</p>
                  </div>
                )
              })}
              {!activity?.logins?.length && (
                <p className="px-6 py-8 text-center text-sm text-zinc-600">No sign-ins recorded.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sales by Store: weekly stacked chart + monthly table */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="bg-zinc-950 border-zinc-800 lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-white text-sm flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-yellow-500" /> Weekly Sales by Store
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-44 flex items-end gap-2">
              {weeklySales.buckets.map((w) => (
                <div key={w.key} className="flex-1 flex flex-col items-center justify-end gap-1 h-full">
                  <div
                    className="w-full max-w-[28px] flex flex-col-reverse rounded-t overflow-hidden"
                    style={{ height: `${Math.max(2, (w.total / weeklySales.max) * 160)}px` }}
                    title={`GHS ${w.total.toLocaleString()}`}
                  >
                    {w.segments.map((seg, i) => (
                      <div
                        key={i}
                        className={`w-full bg-gradient-to-t ${seg.color}`}
                        style={{ height: `${w.total ? (seg.total / w.total) * 100 : 0}%` }}
                        title={`${seg.storeName}: GHS ${seg.total.toLocaleString()}`}
                      />
                    ))}
                  </div>
                  <span className="text-[10px] text-zinc-600">
                    {new Date(w.key + 'T00:00:00Z').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-zinc-500">
              {(activity?.salesByWeek || []).map((s, i) => (
                <span key={s.store_id} className="flex items-center gap-1.5">
                  <span className={`h-2.5 w-2.5 rounded-sm bg-gradient-to-t ${STORE_COLORS[i % STORE_COLORS.length]}`} />
                  {s.storeName}
                </span>
              ))}
              <span className="ml-auto">
                Total: <span className="text-yellow-400 font-semibold">GHS {weeklySales.buckets.reduce((s, b) => s + b.total, 0).toLocaleString()}</span>
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-950 border-zinc-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-white text-sm flex items-center gap-2">
              <Calendar className="h-4 w-4 text-violet-400" /> Monthly Sales
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-zinc-900">
              {monthlySales.map((m) => (
                <div key={m.key} className="px-6 py-2.5">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-white">{m.label}</p>
                    <p className="text-sm font-semibold text-yellow-400">GHS {m.total.toLocaleString()}</p>
                  </div>
                  {m.perStore.map((ps, i) => (
                    <div key={i} className="mt-1 flex items-center justify-between text-[11px] text-zinc-500">
                      <span className="flex items-center gap-1.5">
                        <span className={`h-1.5 w-1.5 rounded-full bg-gradient-to-t ${STORE_COLORS[i % STORE_COLORS.length]}`} />
                        {ps.storeName}
                      </span>
                      <span>GHS {ps.total.toLocaleString()} · {ps.count} tx</span>
                    </div>
                  ))}
                </div>
              ))}
              {monthlySales.length === 0 && (
                <p className="px-6 py-8 text-center text-sm text-zinc-600">No sales data yet.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Data footprint / usage per store */}
      <Card className="bg-zinc-950 border-zinc-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-white text-sm flex items-center gap-2">
            <Database className="h-4 w-4 text-sky-400" /> Data Footprint by Store
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-zinc-500 border-b border-zinc-800">
                  <th className="px-6 py-2 font-medium">Store</th>
                  <th className="px-6 py-2 font-medium">Products</th>
                  <th className="px-6 py-2 font-medium">Sales</th>
                  <th className="px-6 py-2 font-medium">Customers</th>
                  <th className="px-6 py-2 font-medium">Employees</th>
                  <th className="px-6 py-2 font-medium">Activities</th>
                  <th className="px-6 py-2 font-medium w-40">Share</th>
                </tr>
              </thead>
              <tbody>
                {(activity?.usage || []).map((u) => {
                  const rows = u.products + u.sales + u.customers + u.employees + u.activities
                  const share = totalRows ? Math.round((rows / totalRows) * 100) : 0
                  return (
                    <tr key={u.store_id} className="border-b border-zinc-900 hover:bg-zinc-900/50">
                      <td className="px-6 py-3">
                        <Link href={`/owner/stores/${u.store_id}`} className="text-white hover:text-yellow-400 font-medium">
                          {u.storeName}
                        </Link>
                      </td>
                      <td className="px-6 py-3 text-zinc-300">{u.products.toLocaleString()}</td>
                      <td className="px-6 py-3 text-zinc-300">{u.sales.toLocaleString()}</td>
                      <td className="px-6 py-3 text-zinc-300">{u.customers.toLocaleString()}</td>
                      <td className="px-6 py-3 text-zinc-300">{u.employees.toLocaleString()}</td>
                      <td className="px-6 py-3 text-zinc-300">{u.activities.toLocaleString()}</td>
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 flex-1 rounded-full bg-zinc-800 overflow-hidden">
                            <div className="h-full rounded-full bg-gradient-to-r from-yellow-600 to-yellow-400" style={{ width: `${share}%` }} />
                          </div>
                          <span className="text-xs text-zinc-500 w-8">{share}%</span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {!activity?.usage?.length && (
                  <tr><td colSpan={7} className="px-6 py-8 text-center text-zinc-600">No usage data.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="px-6 py-3 text-[11px] text-zinc-600 border-t border-zinc-900">
            Supabase bills egress per project, not per store — row share approximates each store's data footprint.
          </p>
        </CardContent>
      </Card>

      {/* Expiring Soon Alerts */}
      {expiringSoon.length > 0 && (
        <Card className="bg-red-950/30 border-red-500/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-white text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-400" /> Expiring Soon
              <span className="text-xs text-red-400 font-normal">({expiringSoon.length})</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-zinc-500 border-b border-zinc-800">
                    <th className="px-6 py-2 font-medium">Store</th>
                    <th className="px-6 py-2 font-medium">Plan</th>
                    <th className="px-6 py-2 font-medium">Status</th>
                    <th className="px-6 py-2 font-medium">Ends</th>
                    <th className="px-6 py-2 font-medium">Days Left</th>
                  </tr>
                </thead>
                <tbody>
                  {expiringSoon.map((s) => (
                    <tr key={s.id} className="border-b border-zinc-900 hover:bg-zinc-900/50">
                      <td className="px-6 py-3">
                        <Link href={`/owner/stores/${s.id}`} className="text-white hover:text-yellow-400 font-medium">
                          {s.name}
                        </Link>
                        <div className="text-xs text-zinc-500">{s.owner_email}</div>
                      </td>
                      <td className="px-6 py-3 text-zinc-300 capitalize">{s.plan}</td>
                      <td className="px-6 py-3"><StatusBadge status={s.subscription_status} /></td>
                      <td className="px-6 py-3 text-zinc-400 text-xs">
                        {s.endDate ? new Date(s.endDate).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-6 py-3">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          (s.daysRemaining ?? 0) <= 0
                            ? 'bg-red-500/20 text-red-400'
                            : (s.daysRemaining ?? 0) <= 1
                            ? 'bg-orange-500/20 text-orange-400'
                            : 'bg-yellow-500/20 text-yellow-400'
                        }`}>
                          {daysLabel(s.daysRemaining)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Failed Payments Alert */}
      {recentFailedPayments.length > 0 && (
        <Card className="bg-red-950/30 border-red-500/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-white text-sm flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-400" /> Failed Payments (30d)
              <span className="text-xs text-red-400 font-normal">({recentFailedPayments.length})</span>
            </CardTitle>
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
                    <th className="px-6 py-2 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {recentFailedPayments.slice(0, 10).map((p) => (
                    <tr key={p.id} className="border-b border-zinc-900 hover:bg-zinc-900/50">
                      <td className="px-6 py-3 text-white">{p.storeName}</td>
                      <td className="px-6 py-3 text-zinc-300 capitalize">{p.plan}</td>
                      <td className="px-6 py-3 text-red-400 font-medium">{p.currency} {p.amount}</td>
                      <td className="px-6 py-3 text-zinc-400 capitalize">{p.provider}</td>
                      <td className="px-6 py-3 text-zinc-500 text-xs">{timeAgo(p.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

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
                  <th className="px-6 py-2 font-medium">Provider</th>
                  <th className="px-6 py-2 font-medium">Renews / Trial Ends</th>
                  <th className="px-6 py-2 font-medium">Days Left</th>
                  <th className="px-6 py-2 font-medium">Last Active</th>
                  <th className="px-6 py-2 font-medium">Joined</th>
                  <th className="px-6 py-2 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {enrichedStores.map((s) => (
                  <tr key={s.id} className="border-b border-zinc-900 hover:bg-zinc-900/50 transition-colors">
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-2.5">
                        <HealthDot health={s.health} />
                        <div>
                          <Link href={`/owner/stores/${s.id}`} className="text-white hover:text-yellow-400 font-medium">
                            {s.name}
                          </Link>
                          <div className="text-xs text-zinc-500">{s.owner_email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-3 text-zinc-300 capitalize">{s.plan}</td>
                    <td className="px-6 py-3">
                      <StatusBadge status={s.subscription_status} />
                    </td>
                    <td className="px-6 py-3 text-zinc-400 text-xs capitalize">
                      {s.subscription_provider || '—'}
                    </td>
                    <td className="px-6 py-3 text-zinc-400 text-xs">
                      {(s.subscription_status === 'trialing' ? s.trial_ends_at : s.current_period_end)
                        ? new Date((s.subscription_status === 'trialing' ? s.trial_ends_at : s.current_period_end) as string).toLocaleDateString()
                        : '—'}
                    </td>
                    <td className="px-6 py-3">
                      {s.daysRemaining !== null ? (
                        <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full ${
                          s.daysRemaining <= 0
                            ? 'bg-red-500/20 text-red-400 animate-pulse'
                            : s.daysRemaining <= 3
                            ? 'bg-orange-500/20 text-orange-400'
                            : s.daysRemaining <= 7
                            ? 'bg-yellow-500/20 text-yellow-400'
                            : 'bg-green-500/20 text-green-400'
                        }`}>
                          {daysLabel(s.daysRemaining)}
                        </span>
                      ) : <span className="text-xs text-zinc-600">—</span>}
                    </td>
                    <td className="px-6 py-3 text-zinc-400 text-xs">
                      {s.lastActiveAt ? timeAgo(s.lastActiveAt) : 'No activity'}
                    </td>
                    <td className="px-6 py-3 text-zinc-500 text-xs">
                      {s.created_at ? timeAgo(s.created_at) : '—'}
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          title="Extend access"
                          onClick={() => setExtendTarget(s)}
                          className="rounded-md border border-zinc-800 p-1.5 text-zinc-400 transition-colors hover:border-amber-500/40 hover:text-amber-400"
                        >
                          <CalendarClock className="h-3.5 w-3.5" />
                        </button>
                        <button
                          title="Record payment & renew"
                          onClick={() => setRenewTarget(s)}
                          className="rounded-md border border-zinc-800 p-1.5 text-zinc-400 transition-colors hover:border-emerald-500/40 hover:text-emerald-400"
                        >
                          <CreditCard className="h-3.5 w-3.5" />
                        </button>
                        <Link
                          href={`/owner/stores/${s.id}`}
                          title="Store details"
                          className="rounded-md border border-zinc-800 p-1.5 text-zinc-400 transition-colors hover:border-yellow-500/40 hover:text-yellow-400"
                        >
                          <ArrowUpRight className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
                {enrichedStores.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-6 py-8 text-center text-zinc-600">
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

      {/* Recent Renewals */}
      {recentRenewals.length > 0 && (
        <Card className="bg-zinc-950 border-zinc-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-white text-sm flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-green-400" /> Recent Renewals
              <span className="text-xs text-zinc-500 font-normal">({recentRenewals.length})</span>
            </CardTitle>
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
                    <th className="px-6 py-2 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {recentRenewals.map((p) => (
                    <tr key={p.id} className="border-b border-zinc-900 hover:bg-zinc-900/50">
                      <td className="px-6 py-3 text-white">{p.storeName}</td>
                      <td className="px-6 py-3 text-zinc-300 capitalize">{p.plan}</td>
                      <td className="px-6 py-3 text-green-400 font-medium">{p.currency} {p.amount}</td>
                      <td className="px-6 py-3 text-zinc-400 capitalize">{p.provider}</td>
                      <td className="px-6 py-3 text-zinc-500 text-xs">{timeAgo(p.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {extendTarget && (
        <ExtendModal
          store={extendTarget}
          onClose={() => setExtendTarget(null)}
          onDone={(msg) => {
            setExtendTarget(null)
            setNotice(msg)
            load(true)
          }}
        />
      )}
      {renewTarget && (
        <RenewModal
          store={renewTarget}
          onClose={() => setRenewTarget(null)}
          onDone={(msg) => {
            setRenewTarget(null)
            setNotice(msg)
            load(true)
          }}
        />
      )}
      {addStoreOpen && (
        <AddStoreModal
          onClose={() => setAddStoreOpen(false)}
          onDone={(msg) => {
            setAddStoreOpen(false)
            setNotice(msg)
            load(true)
          }}
        />
      )}
    </div>
  )
}

function ModalShell({
  icon: Icon,
  title,
  onClose,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl shadow-black/60"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
            <Icon className="h-4 w-4 text-yellow-500" /> {title}
          </h3>
          <button onClick={onClose} className="text-zinc-500 transition-colors hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-4 p-5">{children}</div>
      </div>
    </div>
  )
}

function ExtendModal({
  store,
  onClose,
  onDone,
}: {
  store: StoreRow
  onClose: () => void
  onDone: (msg: string) => void
}) {
  const [days, setDays] = useState('30')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const endDate = store.subscription_status === 'trialing' ? store.trial_ends_at : store.current_period_end

  async function submit(n: number) {
    if (!Number.isFinite(n) || n <= 0) {
      setError('Enter a valid number of days')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const payload: Record<string, any> = { extend_days: n }
      if (store.subscription_status !== 'trialing') payload.subscription_status = 'active'
      const res = await ownerFetch(`/api/owner/stores/${store.id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Extension failed')
      onDone(`Extended ${store.name} by ${n} day${n === 1 ? '' : 's'}`)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <ModalShell icon={CalendarClock} title={`Extend access — ${store.name}`} onClose={onClose}>
      <p className="text-xs text-zinc-500">
        Current end:{' '}
        <span className="text-zinc-300">{endDate ? new Date(endDate).toLocaleString() : 'none'}</span>
        {store.subscription_status !== 'trialing' && (
          <span className="block mt-1">Extending reactivates the subscription (status → active).</span>
        )}
      </p>
      <div className="grid grid-cols-4 gap-2">
        {[7, 14, 30, 90].map((n) => (
          <button
            key={n}
            onClick={() => submit(n)}
            disabled={busy}
            className="rounded-lg border border-zinc-800 bg-zinc-900 py-2 text-sm font-semibold text-zinc-300 transition-colors hover:border-yellow-500/40 hover:text-yellow-400 disabled:opacity-50"
          >
            +{n}d
          </button>
        ))}
      </div>
      <div className="flex items-end gap-2">
        <div className="flex-1 space-y-1">
          <label className="text-xs text-zinc-500">Custom days</label>
          <Input
            type="number"
            min={1}
            value={days}
            onChange={(e) => setDays(e.target.value)}
            className="bg-zinc-900 border-zinc-700 text-white h-9"
          />
        </div>
        <Button
          onClick={() => submit(Number(days))}
          disabled={busy}
          variant="outline"
          className="border-zinc-700 text-zinc-200 h-9"
        >
          {busy ? 'Working…' : 'Apply'}
        </Button>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </ModalShell>
  )
}

function RenewModal({
  store,
  onClose,
  onDone,
}: {
  store: StoreRow
  onClose: () => void
  onDone: (msg: string) => void
}) {
  const [plan, setPlan] = useState<PlanKey>(store.plan === 'basic' ? 'basic' : 'pro')
  const [days, setDays] = useState('30')
  const [amount, setAmount] = useState(String(PLAN_PRICE_GHS[store.plan === 'basic' ? 'basic' : 'pro']))
  const [provider, setProvider] = useState('manual')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function changePlan(p: PlanKey) {
    setPlan(p)
    setAmount(String(PLAN_PRICE_GHS[p]))
  }

  async function submit() {
    setBusy(true)
    setError(null)
    try {
      const res = await ownerFetch('/api/owner/payments', {
        method: 'POST',
        body: JSON.stringify({
          store_id: store.id,
          plan,
          provider,
          amount: Number(amount),
          status: 'successful',
          extend_days: Number(days),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Renewal failed')
      onDone(`Recorded GHS ${amount} for ${store.name} — renewed ${days} day(s)`)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <ModalShell icon={CreditCard} title={`Renew subscription — ${store.name}`} onClose={onClose}>
      <div className="grid grid-cols-2 gap-3">
        {(Object.keys(PLAN_PRICE_GHS) as PlanKey[]).map((p) => (
          <button
            key={p}
            onClick={() => changePlan(p)}
            className={`rounded-lg border p-3 text-left transition-colors ${
              plan === p
                ? 'border-yellow-500/50 bg-yellow-500/10'
                : 'border-zinc-800 bg-zinc-900 hover:border-zinc-700'
            }`}
          >
            <p className="text-sm font-semibold text-white capitalize">{p}</p>
            <p className="text-xs text-zinc-500">GHS {PLAN_PRICE_GHS[p]}/mo</p>
          </button>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1">
          <label className="text-xs text-zinc-500">Days</label>
          <Input
            type="number"
            min={1}
            value={days}
            onChange={(e) => setDays(e.target.value)}
            className="bg-zinc-900 border-zinc-700 text-white h-9"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-zinc-500">Amount (GHS)</label>
          <Input
            type="number"
            min={0}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="bg-zinc-900 border-zinc-700 text-white h-9"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-zinc-500">Provider</label>
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            className="w-full h-9 rounded-md border border-zinc-700 bg-zinc-900 text-white px-2 text-sm"
          >
            <option value="manual">manual</option>
            <option value="momo">momo</option>
            <option value="cash">cash</option>
            <option value="eganow">eganow</option>
          </select>
        </div>
      </div>
      <p className="text-[11px] text-zinc-600">
        Records a successful payment and pushes the paid-through date forward from today (or the
        current end, whichever is later).
      </p>
      <Button onClick={submit} disabled={busy} className="gold-gradient w-full text-black font-semibold">
        {busy ? 'Recording…' : 'Record payment & renew'}
      </Button>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </ModalShell>
  )
}

function AddStoreModal({ onClose, onDone }: { onClose: () => void; onDone: (msg: string) => void }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState(() => `Hood-${Math.random().toString(36).slice(2, 10)}`)
  const [plan, setPlan] = useState('pro')
  const [trialDays, setTrialDays] = useState('14')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null)

  async function submit() {
    setBusy(true)
    setError(null)
    try {
      const res = await ownerFetch('/api/owner/stores', {
        method: 'POST',
        body: JSON.stringify({
          name,
          owner_email: email,
          password,
          plan,
          trial_days: Number(trialDays),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Store creation failed')
      setCreated(data.credentials)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <ModalShell icon={Store} title="Add client store" onClose={onClose}>
      {created ? (
        <>
          <p className="text-sm text-zinc-300">
            Store created. Share these login credentials with the client:
          </p>
          <div className="space-y-2 rounded-lg border border-emerald-500/30 bg-emerald-950/20 p-3">
            {[
              ['Login URL', `${typeof window !== 'undefined' ? window.location.origin : ''}/login`],
              ['Email', created.email],
              ['Password', created.password],
            ].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between gap-3">
                <span className="text-xs text-zinc-500">{k}</span>
                <button
                  onClick={() => navigator.clipboard?.writeText(v)}
                  className="flex items-center gap-1.5 font-mono text-xs text-emerald-300 hover:text-emerald-200"
                  title="Copy"
                >
                  {v} <Copy className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
          <Button onClick={() => onDone(`Store "${name}" created`)} className="gold-gradient w-full text-black font-semibold">
            Done
          </Button>
        </>
      ) : (
        <>
          <div className="space-y-1">
            <label className="text-xs text-zinc-500">Store name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="bg-zinc-900 border-zinc-700 text-white h-9" placeholder="e.g. Adom Provisions" />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-zinc-500">Owner email</label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="bg-zinc-900 border-zinc-700 text-white h-9" placeholder="owner@shop.com" />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-zinc-500">Temp password</label>
            <div className="flex gap-2">
              <Input value={password} onChange={(e) => setPassword(e.target.value)} className="bg-zinc-900 border-zinc-700 text-white h-9 font-mono text-xs" />
              <Button
                variant="outline"
                size="sm"
                className="border-zinc-700 text-zinc-400 h-9"
                onClick={() => setPassword(`Hood-${Math.random().toString(36).slice(2, 10)}`)}
              >
                <KeyRound className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-zinc-500">Plan</label>
              <select value={plan} onChange={(e) => setPlan(e.target.value)} className="w-full h-9 rounded-md border border-zinc-700 bg-zinc-900 text-white px-2 text-sm">
                <option value="free">free</option>
                <option value="basic">basic (GHS 150)</option>
                <option value="pro">pro (GHS 300)</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-zinc-500">Trial days</label>
              <Input type="number" min={0} value={trialDays} onChange={(e) => setTrialDays(e.target.value)} className="bg-zinc-900 border-zinc-700 text-white h-9" />
            </div>
          </div>
          <Button onClick={submit} disabled={busy || !name.trim() || !email.trim()} className="gold-gradient w-full text-black font-semibold">
            {busy ? 'Creating…' : 'Create store'}
          </Button>
          {error && <p className="text-xs text-red-400">{error}</p>}
        </>
      )}
    </ModalShell>
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
    <Card className="group relative overflow-hidden bg-zinc-950 border-zinc-800 transition-colors hover:border-zinc-600">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-yellow-500/50 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
      <CardContent className="flex items-start justify-between p-4">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">{label}</p>
          <p className={`mt-1.5 text-2xl font-bold ${accent || 'text-white'}`}>{value}</p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/80 p-2 text-zinc-400 transition-colors group-hover:border-yellow-500/30 group-hover:text-yellow-400">
          <Icon className="h-4 w-4" />
        </div>
      </CardContent>
    </Card>
  )
}
