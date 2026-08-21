'use client'

import { useEffect, useMemo, useState } from 'react'
import { AuthGuard } from '@/components/auth-guard'
import { DashboardLayout } from '@/components/layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { store, Sale, money } from '@/lib/store'
import { pullTable } from '@/lib/fresh-data'
import { formatDateTime } from '@/lib/utils'
import {
  CreditCard,
  Search,
  Receipt,
  Calendar,
  User,
  ChevronDown,
  ChevronUp,
  Package,
  Percent,
  Wallet,
  TrendingUp,
  X,
} from 'lucide-react'

type DateFilter = 'today' | 'yesterday' | 'week' | 'month' | 'all' | 'custom'

function startOfDay(d = new Date()): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function matchesFilter(sale: Sale, filter: DateFilter, customDate?: string): boolean {
  if (filter === 'all') return true
  if (filter === 'custom' && customDate) {
    const saleDate = new Date(sale.timestamp)
    if (isNaN(saleDate.getTime())) return false
    const selected = new Date(customDate + 'T00:00:00')
    const nextDay = new Date(selected)
    nextDay.setDate(nextDay.getDate() + 1)
    return saleDate >= selected && saleDate < nextDay
  }
  const saleDate = new Date(sale.timestamp)
  if (isNaN(saleDate.getTime())) return false
  const now = new Date()
  const todayStart = startOfDay(now)
  if (filter === 'today') {
    const tomorrowStart = new Date(todayStart)
    tomorrowStart.setDate(tomorrowStart.getDate() + 1)
    return saleDate >= todayStart && saleDate < tomorrowStart
  }
  if (filter === 'yesterday') {
    const yesterdayStart = new Date(todayStart)
    yesterdayStart.setDate(yesterdayStart.getDate() - 1)
    return saleDate >= yesterdayStart && saleDate < todayStart
  }
  if (filter === 'week') {
    const weekStart = new Date(todayStart)
    weekStart.setDate(weekStart.getDate() - 7)
    return saleDate >= weekStart
  }
  if (filter === 'month') {
    const monthStart = new Date(todayStart)
    monthStart.setDate(monthStart.getDate() - 30)
    return saleDate >= monthStart
  }
  return true
}

function SaleCard({ sale }: { sale: Sale }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 transition hover:bg-zinc-900">
      <button onClick={() => setOpen(!open)} className="w-full text-left" type="button">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-yellow-500/10 flex items-center justify-center">
              <Receipt className="h-5 w-5 text-yellow-500" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Sale #{sale.id}</p>
              <p className="text-xs text-zinc-400 flex items-center gap-1">
                <Calendar className="h-3 w-3" /> {formatDateTime(sale.timestamp)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-bold gold-text">{money(sale.total)}</p>
              <p className="text-xs text-zinc-400">{sale.items.length} item{sale.items.length !== 1 ? 's' : ''}</p>
            </div>
            {open ? <ChevronUp className="h-4 w-4 text-zinc-400" /> : <ChevronDown className="h-4 w-4 text-zinc-400" />}
          </div>
        </div>
      </button>
      {open && (
        <div className="mt-4 space-y-3 border-t border-zinc-800 pt-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
            {sale.userName && <div className="flex items-center gap-2 text-zinc-300"><User className="h-3 w-3 text-zinc-500" /> {sale.userName}</div>}
            {sale.customer && <div className="flex items-center gap-2 text-zinc-300"><User className="h-3 w-3 text-zinc-500" /> Customer #{sale.customer}</div>}
            {sale.paymentMethod && <div className="capitalize flex items-center gap-2 text-zinc-300"><Wallet className="h-3 w-3 text-zinc-500" /> {sale.paymentMethod}</div>}
          </div>
          <div className="space-y-1">
            {sale.items.map((item) => (
              <div key={item.id + item.name} className="flex justify-between text-sm text-zinc-300">
                <span className="flex items-center gap-2"><Package className="h-3 w-3 text-zinc-500" /> {item.name} x{item.qty}</span>
                <span>{money(item.price * item.qty)}</span>
              </div>
            ))}
          </div>
          {sale.discount > 0 && <p className="text-xs text-yellow-500 flex items-center gap-1"><Percent className="h-3 w-3" /> Discount: -{money(sale.discount)}</p>}
        </div>
      )}
    </div>
  )
}

export default function SalesPage() {
  const [sales, setSales] = useState<Sale[]>([])
  const [search, setSearch] = useState('')
  const [dateFilter, setDateFilter] = useState<DateFilter>('all')
  const [customDate, setCustomDate] = useState('')
  const [stats, setStats] = useState({ count: 0, revenue: 0, avg: 0 })

  const loadSales = () => {
    const s = store.getSales()
    // Sort by timestamp descending (newest first). Fall back to id for ties.
    const sorted = [...s].sort((a, b) => {
      const ta = new Date(a.timestamp).getTime()
      const tb = new Date(b.timestamp).getTime()
      if (isNaN(ta) && isNaN(tb)) return 0
      if (isNaN(ta)) return 1
      if (isNaN(tb)) return -1
      return tb - ta
    })
    setSales(sorted)
    const revenue = s.reduce((sum, x) => sum + x.total, 0)
    setStats({ count: s.length, revenue, avg: s.length ? revenue / s.length : 0 })
  }

  // Pull from server-side sync API (bypasses RLS) so the admin sees
  // sales from all cashier terminals, not just this device.
  const pullFromServer = async () => {
    const data = await pullTable('sales')
    if (data) loadSales()
  }

  useEffect(() => {
    loadSales()
    pullFromServer()
    const interval = setInterval(() => { loadSales(); pullFromServer() }, 15000)
    return () => clearInterval(interval)
  }, [])

  const filtered = useMemo(() => {
    const term = search.toLowerCase()
    return sales
      .filter((s) => matchesFilter(s, dateFilter, customDate))
      .filter((s) =>
        String(s.id || '').toLowerCase().includes(term) ||
        String(s.userName || '').toLowerCase().includes(term) ||
        s.items.some((i) => String(i.name || '').toLowerCase().includes(term))
      )
  }, [sales, search, dateFilter, customDate])

  // Stats for the currently selected date filter
  const filteredStats = useMemo(() => {
    const count = filtered.length
    const revenue = filtered.reduce((sum, x) => sum + x.total, 0)
    return { count, revenue, avg: count ? revenue / count : 0 }
  }, [filtered])

  const filterButtons: { key: DateFilter; label: string }[] = [
    { key: 'today', label: 'Today' },
    { key: 'yesterday', label: 'Yesterday' },
    { key: 'week', label: 'This Week' },
    { key: 'month', label: 'This Month' },
    { key: 'all', label: 'All Time' },
  ]

  return (
    <AuthGuard>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Date filter buttons + custom date picker */}
          <div className="flex flex-wrap items-center gap-2">
            {filterButtons.map((btn) => (
              <button
                key={btn.key}
                onClick={() => { setDateFilter(btn.key); setCustomDate('') }}
                className={`px-4 py-2 text-sm rounded-lg font-medium transition-all ${
                  dateFilter === btn.key
                    ? 'gold-gradient text-black'
                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white'
                }`}
              >
                {btn.label}
              </button>
            ))}
            <div className="flex items-center gap-2 ml-auto">
              <div className="relative">
                <Calendar className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-500 pointer-events-none" />
                <input
                  type="date"
                  value={customDate}
                  onChange={(e) => {
                    setCustomDate(e.target.value)
                    setDateFilter(e.target.value ? 'custom' : 'all')
                  }}
                  className="pl-9 pr-3 py-2 text-sm rounded-lg bg-zinc-800 border border-zinc-700 text-white placeholder:text-zinc-500 [color-scheme:dark]"
                />
              </div>
              {dateFilter === 'custom' && (
                <button
                  onClick={() => { setCustomDate(''); setDateFilter('all') }}
                  className="px-2 py-2 text-sm rounded-lg bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white"
                  title="Clear date"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {/* Stats — reflect the selected date filter */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="card-gold"><CardContent className="p-4"><p className="text-zinc-400 text-sm">{dateFilter === 'all' ? 'Total Sales' : 'Sales in Range'}</p><p className="text-2xl font-bold gold-text">{filteredStats.count}</p></CardContent></Card>
            <Card className="card-gold"><CardContent className="p-4"><p className="text-zinc-400 text-sm">{dateFilter === 'all' ? 'Revenue' : 'Revenue in Range'}</p><p className="text-2xl font-bold gold-text">{money(filteredStats.revenue)}</p></CardContent></Card>
            <Card className="card-gold"><CardContent className="p-4"><p className="text-zinc-400 text-sm">Avg Sale</p><p className="text-2xl font-bold gold-text">{money(filteredStats.avg)}</p></CardContent></Card>
          </div>

          <Card className="glass-card">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <CardTitle className="text-white flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-yellow-500" /> Sales History
                {dateFilter !== 'all' && (
                  <span className="text-xs font-normal text-zinc-500">
                    ({filteredStats.count} {dateFilter === 'today' ? 'today' : dateFilter === 'yesterday' ? 'yesterday' : dateFilter === 'week' ? 'this week' : dateFilter === 'month' ? 'this month' : dateFilter === 'custom' ? `on ${customDate}` : ''})
                  </span>
                )}
              </CardTitle>
              <div className="relative max-w-xs">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-500" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search sale, employee, item..." className="pl-9 bg-zinc-950 border-zinc-800 text-white placeholder:text-zinc-500" />
              </div>
            </CardHeader>
            <CardContent className="space-y-3 max-h-[600px] overflow-y-auto">
              {filtered.length === 0 && <p className="text-zinc-500 text-center py-8">No sales found{dateFilter !== 'all' ? ' for this period.' : '.'}</p>}
              {filtered.map((sale) => <SaleCard key={sale.id} sale={sale} />)}
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    </AuthGuard>
  )
}
