'use client'

import { useEffect, useMemo, useState } from 'react'
import { AuthGuard } from '@/components/auth-guard'
import { DashboardLayout } from '@/components/layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { store, Sale, money } from '@/lib/store'
import { pullTable } from '@/lib/fresh-data'
import * as sync from '@/lib/sync'
import { notifications } from '@/lib/notifications'
import { Undo2, Receipt, Search, ChevronLeft, ChevronRight, Calendar, User, Package } from 'lucide-react'
import { formatDateTime } from '@/lib/utils'
import toast from 'react-hot-toast'

type DateFilter = 'today' | 'yesterday' | 'week' | 'month' | 'all'

function startOfDay(d = new Date()): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function matchesFilter(sale: Sale, filter: DateFilter): boolean {
  if (filter === 'all') return true
  const saleDate = new Date(sale.timestamp)
  if (isNaN(saleDate.getTime())) return false
  const todayStart = startOfDay()
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

const PAGE_SIZE = 20

export default function ReturnsPage() {
  const [sales, setSales] = useState<Sale[]>([])
  const [search, setSearch] = useState('')
  const [dateFilter, setDateFilter] = useState<DateFilter>('all')
  const [page, setPage] = useState(1)
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    setSales(store.getSales())
    pullTable('sales').then(() => setSales(store.getSales()))
  }, [])

  // Sort newest first
  const sorted = useMemo(() => {
    return [...sales].sort((a, b) => {
      const ta = new Date(a.timestamp).getTime()
      const tb = new Date(b.timestamp).getTime()
      if (isNaN(ta) && isNaN(tb)) return 0
      if (isNaN(ta)) return 1
      if (isNaN(tb)) return -1
      return tb - ta
    })
  }, [sales])

  const filtered = useMemo(() => {
    const term = search.toLowerCase()
    return sorted
      .filter((s) => matchesFilter(s, dateFilter))
      .filter((s) =>
        !term ||
        String(s.id || '').toLowerCase().includes(term) ||
        String(s.userName || '').toLowerCase().includes(term) ||
        s.items.some((i) => String(i.name || '').toLowerCase().includes(term))
      )
  }, [sorted, search, dateFilter])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const safePage = Math.min(page, Math.max(1, totalPages))
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  // Reset to page 1 when filter/search changes
  useEffect(() => { setPage(1) }, [search, dateFilter])

  const filteredStats = useMemo(() => {
    const count = filtered.length
    const revenue = filtered.reduce((sum, x) => sum + x.total, 0)
    return { count, revenue }
  }, [filtered])

  const processReturn = (sale: Sale) => {
    if (!confirm(`Process return for sale #${sale.id.slice(0, 8)}?\n\n${sale.items.length} item(s) will be restocked. GHS ${sale.total.toFixed(2)} will be deducted from revenue.`)) return

    // Restock items
    const products = store.getProducts()
    for (const item of sale.items) {
      const p = products.find((x) => x.id === item.id)
      if (p) {
        p.stock = (p.stock ?? 0) + item.qty
      }
    }
    store.setProducts(products)

    // Remove the sale
    const all = store.getSales().filter((s) => s.id !== sale.id)
    store.setSales(all)
    setSales([...all])

    // Push changes to Supabase
    sale.items.forEach((item) => {
      const p = products.find((x) => x.id === item.id)
      if (p) sync.pushLocalChange('products', p)
    })
    sync.pushLocalChange('sales', { id: sale.id }, 'delete')

    // Update customer stats if linked
    if (sale.customerId) {
      const customers = store.getCustomers()
      const c = customers.find((x) => x.id === sale.customerId)
      if (c) {
        c.purchases = Math.max(0, (c.purchases || 0) - 1)
        c.total = Math.max(0, (c.total || 0) - sale.total)
        store.setCustomers(customers)
        sync.pushLocalChange('customers', c)
      }
    }

    // Log the return as an activity
    notifications.push(
      'return',
      'Return processed',
      `Sale #${sale.id.slice(0, 8)} returned — ${sale.items.length} item(s) restocked, GHS ${sale.total.toFixed(2)} refunded`,
      { amount: -sale.total, href: '/returns' }
    )

    toast.success(`Return processed — ${sale.items.length} item(s) restocked, GHS ${sale.total.toFixed(2)} refunded`)
  }

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
          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="card-gold"><CardContent className="p-4"><p className="text-zinc-400 text-sm">Sales Available for Return</p><p className="text-2xl font-bold gold-text">{filteredStats.count}</p></CardContent></Card>
            <Card className="card-gold"><CardContent className="p-4"><p className="text-zinc-400 text-sm">Total Value</p><p className="text-2xl font-bold gold-text">{money(filteredStats.revenue)}</p></CardContent></Card>
            <Card className="card-gold"><CardContent className="p-4"><p className="text-zinc-400 text-sm">Showing</p><p className="text-2xl font-bold gold-text">{pageItems.length} of {filteredStats.count}</p></CardContent></Card>
          </div>

          {/* Date filter buttons */}
          <div className="flex flex-wrap gap-2">
            {filterButtons.map((btn) => (
              <button
                key={btn.key}
                onClick={() => setDateFilter(btn.key)}
                className={`px-4 py-2 text-sm rounded-lg font-medium transition-all ${
                  dateFilter === btn.key
                    ? 'gold-gradient text-black'
                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white'
                }`}
              >
                {btn.label}
              </button>
            ))}
          </div>

          <Card className="glass-card">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <CardTitle className="text-white flex items-center gap-2">
                <Undo2 className="h-5 w-5 text-yellow-500" /> Returns
                {dateFilter !== 'all' && (
                  <span className="text-xs font-normal text-zinc-500">
                    ({filteredStats.count} {dateFilter === 'today' ? 'today' : dateFilter === 'yesterday' ? 'yesterday' : dateFilter === 'week' ? 'this week' : 'this month'})
                  </span>
                )}
              </CardTitle>
              <div className="relative max-w-xs">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-500" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search sale ID, cashier, item..." className="pl-9 bg-zinc-950 border-zinc-800 text-white placeholder:text-zinc-500" />
              </div>
            </CardHeader>
            <CardContent className="space-y-3 max-h-[600px] overflow-y-auto">
              {pageItems.length === 0 && (
                <p className="text-zinc-500 text-center py-8">No sales found{dateFilter !== 'all' ? ' for this period.' : '.'}</p>
              )}
              {pageItems.map((sale) => (
                <div key={sale.id} className="rounded-xl border border-zinc-800 bg-zinc-900/60 overflow-hidden">
                  <div className="flex items-center justify-between p-3">
                    <button
                      onClick={() => setExpanded(expanded === sale.id ? null : sale.id)}
                      className="flex items-center gap-3 text-left min-w-0 flex-1"
                      type="button"
                    >
                      <div className="h-10 w-10 rounded-lg bg-yellow-500/10 flex items-center justify-center shrink-0">
                        <Receipt className="h-5 w-5 text-yellow-500" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-white">#{sale.id.slice(0, 8)}</p>
                        <p className="text-xs text-zinc-400 flex items-center gap-2 flex-wrap">
                          <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {formatDateTime(sale.timestamp)}</span>
                          {sale.userName && <span className="flex items-center gap-1"><User className="h-3 w-3" /> {sale.userName}</span>}
                          <span>{sale.items.length} item{sale.items.length !== 1 ? 's' : ''}</span>
                        </p>
                      </div>
                    </button>
                    <div className="flex items-center gap-3 shrink-0">
                      <p className="text-sm font-bold gold-text">{money(sale.total)}</p>
                      <button
                        onClick={() => processReturn(sale)}
                        className="px-3 py-1.5 rounded-lg bg-red-900/30 text-red-400 text-xs font-medium hover:bg-red-900/50 transition"
                      >
                        Process Return
                      </button>
                    </div>
                  </div>
                  {expanded === sale.id && (
                    <div className="border-t border-zinc-800 px-3 py-2 space-y-1 bg-zinc-950/40">
                      {sale.items.map((item) => (
                        <div key={item.id + item.name} className="flex justify-between text-sm text-zinc-300">
                          <span className="flex items-center gap-2"><Package className="h-3 w-3 text-zinc-600" /> {item.name} x{item.qty}</span>
                          <span>{money(item.price * item.qty)}</span>
                        </div>
                      ))}
                      {sale.paymentMethod && <p className="text-xs text-zinc-500 pt-1 capitalize">Payment: {sale.paymentMethod}</p>}
                    </div>
                  )}
                </div>
              ))}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-3 border-t border-zinc-800">
                  <button
                    onClick={() => setPage(Math.max(1, safePage - 1))}
                    disabled={safePage <= 1}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="h-4 w-4" /> Prev
                  </button>
                  <span className="text-sm text-zinc-400">
                    Page {safePage} of {totalPages}
                  </span>
                  <button
                    onClick={() => setPage(Math.min(totalPages, safePage + 1))}
                    disabled={safePage >= totalPages}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Next <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    </AuthGuard>
  )
}
