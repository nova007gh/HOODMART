'use client'

import { useEffect, useMemo, useState } from 'react'
import { AuthGuard } from '@/components/auth-guard'
import { DashboardLayout } from '@/components/layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { store, Product, Sale, money, formatDate } from '@/lib/store'
import { useAuth } from '@/hooks/useAuth'
import { hasPermission } from '@/lib/auth'
import { pullTable } from '@/lib/fresh-data'
import {
  ShoppingCart, Package, TrendingUp, DollarSign, BarChart3,
  AlertTriangle, Calendar, ArrowUpRight, ArrowDownRight,
  CreditCard, Brain, ChevronLeft, ChevronRight, Users,
  Wallet, Activity, Search, Gift, Smartphone, Receipt, Package as PackageIcon, User
} from 'lucide-react'
import Link from 'next/link'

function last7Days() {
  const days: string[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    days.push(d.toISOString().slice(0, 10))
  }
  return days
}

function daysUntil(date?: string) {
  if (!date) return Infinity
  const parsed = new Date(date)
  if (isNaN(parsed.getTime())) return Infinity
  const year = parsed.getFullYear()
  if (year < 2000 || year > 2100) return Infinity
  return Math.ceil((parsed.getTime() - new Date().setHours(0, 0, 0, 0)) / (1000 * 60 * 60 * 24))
}

function GoldBar({ value, max, label, total, isCurrency }: { value: number; max: number; label: string; total?: number; isCurrency?: boolean }) {
  const pct = max > 0 ? Math.max(4, Math.round((value / max) * 100)) : 0
  const display = isCurrency && total ? money(total) : value.toString()
  return (
    <div className="flex flex-col items-center gap-2 flex-1 min-w-0 group">
      <div className="w-full flex-1 bg-zinc-800/30 rounded-t-lg relative flex items-end overflow-hidden border border-zinc-700/30">
        <div
          className="w-full rounded-t-md transition-all duration-700 ease-out relative"
          style={{
            height: `${pct}%`,
            background: 'linear-gradient(to top, #92600a 0%, #d4a017 40%, #f5c842 70%, #fff4c2 100%)',
            boxShadow: '0 0 16px rgba(245, 200, 66, 0.5), inset 0 1px 0 rgba(255,255,255,0.3)',
          }}
          title={display}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent rounded-t-md" />
          <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] font-bold text-yellow-200 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none bg-zinc-900/90 px-1.5 py-0.5 rounded">
            {display}
          </div>
        </div>
      </div>
      <p className="text-[10px] text-zinc-500 truncate w-full text-center group-hover:text-yellow-400 transition-colors">{label}</p>
    </div>
  )
}

function KPICard({ icon: Icon, label, value, change, changeLabel, accent }: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  change?: number
  changeLabel?: string
  accent?: string
}) {
  const isPositive = (change ?? 0) >= 0
  return (
    <Card className="card-gold relative overflow-hidden group hover:border-yellow-500/30 transition-all">
      <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-yellow-500/5 to-transparent rounded-bl-full" />
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-3">
          <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${accent || 'bg-yellow-500/10'}`}>
            <Icon className={`h-5 w-5 ${accent ? 'text-white' : 'text-yellow-500'}`} />
          </div>
          {change !== undefined && (
            <div className={`flex items-center gap-0.5 text-xs font-semibold px-2 py-0.5 rounded-full ${
              isPositive ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
            }`}>
              {isPositive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
              {Math.abs(change)}%
            </div>
          )}
        </div>
        <p className="text-2xl font-bold text-white mb-0.5">{value}</p>
        <p className="text-xs text-zinc-500">{changeLabel || label}</p>
      </CardContent>
    </Card>
  )
}

function ProgressBar({ label, value, pct, color }: { label: string; value: string; pct: number; color: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-zinc-300">{label}</span>
        <span className="text-zinc-400 text-xs">{pct}%  {value}</span>
      </div>
      <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const [sales, setSales] = useState<Sale[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const { session } = useAuth()
  const user = session?.user ?? null

  const [lastSynced, setLastSynced] = useState<string>('')
  const [syncing, setSyncing] = useState(false)

  const reload = () => { setSales(store.getSales()); setProducts(store.getProducts()) }

  // Pull from the server-side sync API (bypasses RLS) and write to localStorage,
  // then reload. This is the key fix: the browser's anon key can't read from
  // Supabase because RLS blocks it, so we use a server-side endpoint with the
  // service role key instead.
  const pullAndReload = async () => {
    setSyncing(true)
    try {
      await Promise.all([pullTable('sales'), pullTable('products')])
      reload()
      setLastSynced(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
    } catch {
      /* ignore network errors */
    } finally {
      setSyncing(false)
    }
  }

  useEffect(() => {
    reload()
    // Pull from server immediately on mount so the admin sees the latest
    // sales from all cashier terminals right away.
    pullAndReload()
    // Refresh from local storage every 5s for instant updates on same-device sales.
    const interval = setInterval(reload, 5000)
    // Pull from server every 15s so sales from other devices appear quickly.
    const remoteInterval = setInterval(pullAndReload, 15000)
    // Also listen for cross-tab storage changes (sales made on other tabs)
    const onStorage = () => reload()
    window.addEventListener('storage', onStorage)
    return () => {
      clearInterval(interval)
      clearInterval(remoteInterval)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  const canManageProducts = hasPermission(user, 'manage_products')
  const canManageInventory = hasPermission(user, 'manage_inventory')
  const canViewReports = hasPermission(user, 'view_reports')
  const canProcessSales = hasPermission(user, 'process_sales')
  const isAdminUser = user?.role === 'admin'

  const today = new Date().toISOString().slice(0, 10)
  const todaySales = sales.filter((s) => s.timestamp.startsWith(today))
  const todayRevenue = todaySales.reduce((sum, s) => sum + s.total, 0)
  const todayItemsSold = todaySales.reduce((sum, s) => sum + s.items.reduce((a, i) => a + i.qty, 0), 0)
  const totalRevenue = sales.reduce((sum, s) => sum + s.total, 0)
  const avgOrder = sales.length ? totalRevenue / sales.length : 0
  const totalItems = products.reduce((sum, p) => sum + (p.stock ?? 0), 0)
  const inventoryValue = products.reduce((sum, p) => sum + (p.stock ?? 0) * (p.cost ?? p.price), 0)
  const lowStock = products.filter((p) => (p.stock ?? 0) < (p.minStock ?? 0))
  const [stockPage, setStockPage] = useState(0)
  const stockPageSize = 5
  const stockPageCount = Math.ceil(lowStock.length / stockPageSize)
  const stockCurrent = lowStock.slice(stockPage * stockPageSize, (stockPage + 1) * stockPageSize)
  const expiring = products.filter((p) => { const d = daysUntil(p.expiryDate); return d >= 0 && d <= 7 })
  const expired = products.filter((p) => daysUntil(p.expiryDate) < 0)

  const days = last7Days()
  const daily = useMemo(() => {
    return days.map((d) => {
      const daySales = sales.filter((s) => s.timestamp.startsWith(d))
      return { date: d, count: daySales.length, total: daySales.reduce((sum, s) => sum + s.total, 0) }
    })
  }, [sales])
  const maxDaily = Math.max(1, ...daily.map((d) => d.total))

  const last30Days = useMemo(() => {
    const d: string[] = []
    for (let i = 29; i >= 0; i--) {
      const dt = new Date()
      dt.setDate(dt.getDate() - i)
      d.push(dt.toISOString().slice(0, 10))
    }
    return d.map((date) => {
      const daySales = sales.filter((s) => s.timestamp.startsWith(date))
      return { date, count: daySales.length, total: daySales.reduce((sum, s) => sum + s.total, 0) }
    })
  }, [sales])
  const max30 = Math.max(1, ...last30Days.map((d) => d.total))
  const [chartRange, setChartRange] = useState<'7' | '30'>('7')
  const chartData = chartRange === '7' ? daily : last30Days
  const chartMax = chartRange === '7' ? maxDaily : max30

  const topProducts = useMemo(() => {
    const map = new Map<string, { name: string; qty: number; total: number }>()
    sales.forEach((s) => s.items.forEach((i) => {
      const cur = map.get(i.id) || { name: i.name, qty: 0, total: 0 }
      cur.qty += i.qty
      cur.total += i.price * i.qty
      map.set(i.id, cur)
    }))
    return Array.from(map.values()).sort((a, b) => b.qty - a.qty).slice(0, 5)
  }, [sales])
  const maxTop = Math.max(1, ...topProducts.map((p) => p.qty))

  // Payment method breakdown
  const paymentBreakdown = useMemo(() => {
    const map: Record<string, number> = {}
    sales.forEach((s) => {
      const method = s.paymentMethod || 'Cash'
      map[method] = (map[method] || 0) + s.total
    })
    const entries = Object.entries(map).sort((a, b) => b[1] - a[1])
    const total = entries.reduce((s, [, v]) => s + v, 0) || 1
    return entries.map(([method, amount]) => ({
      method,
      amount,
      pct: Math.round((amount / total) * 100),
    }))
  }, [sales])

  // Category breakdown (use first product category or 'Other')
  const categoryBreakdown = useMemo(() => {
    const map: Record<string, number> = {}
    sales.forEach((s) => s.items.forEach((item) => {
      const product = products.find((p) => p.id === item.id)
      const cat = product?.category || 'Other'
      map[cat] = (map[cat] || 0) + item.price * item.qty
    }))
    const entries = Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 6)
    const total = entries.reduce((s, [, v]) => s + v, 0) || 1
    return entries.map(([cat, amount]) => ({
      category: cat,
      amount,
      pct: Math.round((amount / total) * 100),
    }))
  }, [sales, products])

  // Unique customers
  const uniqueCustomers = useMemo(() => {
    const set = new Set<string>()
    sales.forEach((s) => { if (s.customer) set.add(s.customer) })
    return set.size
  }, [sales])

  // Gross profit estimate (sales - cost)
  const grossProfit = useMemo(() => {
    let cost = 0
    sales.forEach((s) => s.items.forEach((item) => {
      const product = products.find((p) => p.id === item.id)
      cost += (product?.cost ?? product?.price ?? item.price) * item.qty
    }))
    return totalRevenue - cost
  }, [sales, products, totalRevenue])

  // Week-over-week change calculations
  const weekChanges = useMemo(() => {
    const now = new Date()
    const thisWeekStart = new Date(now)
    thisWeekStart.setDate(now.getDate() - 7)
    const lastWeekStart = new Date(now)
    lastWeekStart.setDate(now.getDate() - 14)

    const thisWeek = sales.filter((s) => new Date(s.timestamp) >= thisWeekStart)
    const lastWeek = sales.filter((s) => {
      const d = new Date(s.timestamp)
      return d >= lastWeekStart && d < thisWeekStart
    })

    const thisRevenue = thisWeek.reduce((s, sale) => s + sale.total, 0)
    const lastRevenue = lastWeek.reduce((s, sale) => s + sale.total, 0)

    const thisCustomers = new Set(thisWeek.filter((s) => s.customer).map((s) => s.customer)).size
    const lastCustomers = new Set(lastWeek.filter((s) => s.customer).map((s) => s.customer)).size

    const pct = (cur: number, prev: number) => {
      if (prev === 0 && cur === 0) return undefined
      if (prev === 0) return 100
      return Math.round(((cur - prev) / prev) * 100 * 10) / 10
    }

    return {
      revenue: pct(thisRevenue, lastRevenue),
      orders: pct(thisWeek.length, lastWeek.length),
      customers: pct(thisCustomers, lastCustomers),
      profit: grossProfit > 0 ? pct(thisRevenue, lastRevenue) : grossProfit < 0 ? -100 : undefined,
    }
  }, [sales, grossProfit])

  const categoryColors = ['bg-yellow-500', 'bg-green-500', 'bg-blue-500', 'bg-purple-500', 'bg-orange-500', 'bg-pink-500']
  const paymentColors = ['bg-green-500', 'bg-yellow-500', 'bg-blue-500', 'bg-purple-500']

  return (
    <AuthGuard>
      <DashboardLayout>
        {/* Header */}
        <div className="mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white">Dashboard</h1>
            <p className="text-zinc-400">Welcome back! Here&apos;s your business overview.</p>
          </div>
          <div className="flex items-center gap-2">
            {canViewReports && (
              <Button asChild variant="outline" className="border-yellow-500/40 text-yellow-500 hover:bg-yellow-500/10 hover:text-yellow-400 font-bold">
                <Link href="/dashboard/assistant"><Brain className="h-4 w-4 mr-2" /> AI Insights</Link>
              </Button>
            )}
            {canProcessSales && (
              <Button asChild className="gold-gradient text-black font-bold">
                <Link href="/pos"><ShoppingCart className="h-4 w-4 mr-2" /> New Sale</Link>
              </Button>
            )}
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {canViewReports && (
            <>
              <KPICard icon={DollarSign} label="Total Sales" value={money(totalRevenue)} change={weekChanges.revenue} changeLabel={`${sales.length} transactions (all-time)`} />
              <KPICard icon={ShoppingCart} label="Total Orders" value={sales.length.toLocaleString()} change={weekChanges.orders} changeLabel="All time orders" />
              <KPICard icon={Users} label="Customers" value={uniqueCustomers.toLocaleString()} change={weekChanges.customers} changeLabel="Unique customers" />
              <KPICard icon={Wallet} label="Net Profit" value={money(grossProfit)} change={weekChanges.profit} changeLabel="Estimated margin" accent="bg-green-500/10" />
            </>
          )}
        </div>

        {/* Today's Sales — separated from all-time general sales */}
        {canViewReports && (
          <Card className="glass-card border-yellow-500/20 mb-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-yellow-500/10 to-transparent rounded-bl-full" />
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-yellow-500/10">
                    <Receipt className="h-5 w-5 text-yellow-500" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">Today&apos;s Sales</h2>
                    <p className="text-xs text-zinc-500">{new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                  </div>
                </div>
                <button
                  onClick={pullAndReload}
                  disabled={syncing}
                  className="text-xs text-zinc-400 hover:text-yellow-400 transition-colors flex items-center gap-1 disabled:opacity-50"
                >
                  <Activity className={`h-3 w-3 ${syncing ? 'animate-spin' : ''}`} />
                  {syncing ? 'Syncing...' : 'Refresh'}
                </button>
                {lastSynced && (
                  <span className="text-xs text-zinc-600 ml-2">Last synced: {lastSynced}</span>
                )}
              </div>

              {/* Summary stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800">
                  <p className="text-xs text-zinc-500 mb-1">Revenue Today</p>
                  <p className="text-2xl font-bold gold-text">{money(todayRevenue)}</p>
                </div>
                <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800">
                  <p className="text-xs text-zinc-500 mb-1">Transactions</p>
                  <p className="text-2xl font-bold text-white">{todaySales.length}</p>
                </div>
                <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800">
                  <p className="text-xs text-zinc-500 mb-1">Items Sold</p>
                  <p className="text-2xl font-bold text-white">{todayItemsSold}</p>
                </div>
                <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800">
                  <p className="text-xs text-zinc-500 mb-1">Avg Sale</p>
                  <p className="text-2xl font-bold text-white">{todaySales.length ? money(todayRevenue / todaySales.length) : money(0)}</p>
                </div>
              </div>

              {/* Items sold today — full breakdown with item name, cashier, amount */}
              {todaySales.length > 0 && (
                <div className="border-t border-zinc-800 pt-4">
                  <h3 className="text-sm font-semibold text-zinc-300 mb-3 flex items-center gap-2">
                    <PackageIcon className="h-4 w-4 text-yellow-500" /> Items Sold Today
                  </h3>
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {/* Per-sale breakdown: each sale shows cashier, time, and every item */}
                    {todaySales.map((sale) => (
                      <div key={sale.id} className="rounded-lg bg-zinc-900/60 border border-zinc-800 overflow-hidden">
                        {/* Sale header: cashier + time + total */}
                        <div className="flex items-center justify-between px-3 py-2 bg-zinc-900/80 border-b border-zinc-800">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="h-6 w-6 rounded-full bg-yellow-500/10 flex items-center justify-center shrink-0">
                              <User className="h-3 w-3 text-yellow-500" />
                            </div>
                            <span className="text-sm font-medium text-white truncate">{sale.userName || 'Walk-in'}</span>
                            <span className="text-xs text-zinc-500">{new Date(sale.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            <span className="text-xs text-zinc-600 capitalize">· {sale.paymentMethod}</span>
                          </div>
                          <span className="text-sm font-bold gold-text shrink-0">{money(sale.total)}</span>
                        </div>
                        {/* Item list for this sale */}
                        <div className="px-3 py-2 space-y-1">
                          {sale.items.map((item) => (
                            <div key={item.id + item.name} className="flex items-center justify-between text-sm">
                              <div className="flex items-center gap-2 min-w-0">
                                <PackageIcon className="h-3 w-3 text-zinc-600 shrink-0" />
                                <span className="text-zinc-200 truncate">{item.name}</span>
                                <span className="text-zinc-500 text-xs shrink-0">×{item.qty}</span>
                              </div>
                              <span className="text-zinc-300 shrink-0">{money(item.price * item.qty)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {todaySales.length === 0 && (
                <div className="mt-4 text-center py-8 border-t border-zinc-800">
                  <Receipt className="h-8 w-8 text-zinc-700 mx-auto mb-2" />
                  <p className="text-sm text-zinc-500">No sales recorded today yet.</p>
                  <p className="text-xs text-zinc-600 mt-1">Sales will appear here automatically as they happen.</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Sales Chart + Top Products */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {canViewReports && (
            <Card className="glass-card border-yellow-500/10 lg:col-span-2">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-white"><BarChart3 className="h-5 w-5 text-yellow-500" /> Sales Overview</CardTitle>
                <div className="flex gap-1">
                  <button onClick={() => setChartRange('7')} className={`px-3 py-1 text-xs rounded-md font-medium transition-all ${chartRange === '7' ? 'gold-gradient text-black' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}>This Week</button>
                  <button onClick={() => setChartRange('30')} className={`px-3 py-1 text-xs rounded-md font-medium transition-all ${chartRange === '30' ? 'gold-gradient text-black' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}>30 Days</button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="h-56 flex items-end gap-1.5">
                  {chartData.map((d) => (
                    <GoldBar
                      key={d.date}
                      value={d.total}
                      max={chartMax}
                      label={chartRange === '7' ? new Date(d.date).toLocaleDateString(undefined, { weekday: 'short' }) : new Date(d.date).getDate().toString()}
                      total={d.total}
                      isCurrency
                    />
                  ))}
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-zinc-500">
                  <span>Period Total: <span className="text-yellow-400 font-bold">{money(chartData.reduce((s, d) => s + d.total, 0))}</span></span>
                  <span>{chartData.filter((d) => d.count > 0).length} active days</span>
                </div>
              </CardContent>
            </Card>
          )}

          {canViewReports && (
            <Card className="glass-card border-yellow-500/10">
              <CardHeader><CardTitle className="flex items-center gap-2 text-white"><TrendingUp className="h-5 w-5 text-yellow-500" /> Top Products</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {topProducts.map((p, i) => (
                  <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800 hover:border-yellow-500/20 transition-colors">
                    <span className="text-xs font-bold text-yellow-500 w-5">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{p.name}</p>
                      <p className="text-xs text-zinc-500">{p.qty} sold</p>
                    </div>
                    <span className="text-sm font-bold text-yellow-400">{money(p.total)}</span>
                  </div>
                ))}
                {topProducts.length === 0 && <p className="text-zinc-500 text-sm text-center py-8">No sales yet.</p>}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sales Analytics Row */}
        {canViewReports && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            {/* Revenue by Category */}
            <Card className="glass-card">
              <CardHeader><CardTitle className="flex items-center gap-2 text-white"><BarChart3 className="h-4 w-4 text-yellow-500" /> Revenue by Category</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {categoryBreakdown.map((c, i) => (
                  <ProgressBar
                    key={c.category}
                    label={c.category}
                    value={money(c.amount)}
                    pct={c.pct}
                    color={categoryColors[i % categoryColors.length]}
                  />
                ))}
                {categoryBreakdown.length === 0 && <p className="text-zinc-500 text-sm text-center py-4">No category data yet.</p>}
              </CardContent>
            </Card>

            {/* Payment Methods */}
            <Card className="glass-card">
              <CardHeader><CardTitle className="flex items-center gap-2 text-white"><CreditCard className="h-4 w-4 text-yellow-500" /> Payment Methods</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {paymentBreakdown.map((p, i) => (
                  <div key={p.method} className="flex items-center gap-3">
                    <div className={`h-3 w-3 rounded-full ${paymentColors[i % paymentColors.length]}`} />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-zinc-300">{p.method}</span>
                        <span className="text-xs text-zinc-500">{p.pct}%</span>
                      </div>
                      <p className="text-xs text-zinc-500">{money(p.amount)}</p>
                    </div>
                  </div>
                ))}
                {paymentBreakdown.length === 0 && <p className="text-zinc-500 text-sm text-center py-4">No payment data yet.</p>}
              </CardContent>
            </Card>

            {/* Key Performance Metrics */}
            <Card className="glass-card">
              <CardHeader><CardTitle className="flex items-center gap-2 text-white"><Activity className="h-4 w-4 text-yellow-500" /> Key Metrics</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-900/60 border border-zinc-800">
                  <div>
                    <p className="text-xs text-zinc-500">Avg Order Value</p>
                    <p className="text-lg font-bold text-white">{money(avgOrder)}</p>
                  </div>
                  {weekChanges.revenue !== undefined ? (
                    <span className={`text-xs px-2 py-0.5 rounded-full ${weekChanges.revenue >= 0 ? 'text-green-400 bg-green-500/10' : 'text-red-400 bg-red-500/10'}`}>{weekChanges.revenue >= 0 ? '+' : ''}{weekChanges.revenue}%</span>
                  ) : <span className="text-xs text-zinc-600 bg-zinc-800 px-2 py-0.5 rounded-full">—</span>}
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-900/60 border border-zinc-800">
                  <div>
                    <p className="text-xs text-zinc-500">Items per Order</p>
                    <p className="text-lg font-bold text-white">{sales.length ? (sales.reduce((s, sale) => s + sale.items.length, 0) / sales.length).toFixed(1) : '0'}</p>
                  </div>
                  <span className="text-xs text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded-full">{sales.length ? 'avg' : '—'}</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-900/60 border border-zinc-800">
                  <div>
                    <p className="text-xs text-zinc-500">Today&apos;s Revenue</p>
                    <p className="text-lg font-bold text-white">{money(todayRevenue)}</p>
                  </div>
                  <span className="text-xs text-yellow-400 bg-yellow-500/10 px-2 py-0.5 rounded-full">{todaySales.length} orders</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-900/60 border border-zinc-800">
                  <div>
                    <p className="text-xs text-zinc-500">Inventory Value</p>
                    <p className="text-lg font-bold text-white">{money(inventoryValue)}</p>
                  </div>
                  <span className="text-xs text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full">{totalItems} items</span>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Recent Orders + Low Stock + Expiry */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <Card className="glass-card lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-white"><CreditCard className="h-4 w-4 text-yellow-500" /> Recent Orders</CardTitle>
              <Button asChild variant="ghost" size="sm" className="text-yellow-500 hover:text-yellow-400 text-xs">
                <Link href="/sales">View All</Link>
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-zinc-500 border-b border-zinc-800">
                      <th className="px-6 py-2 font-medium">Order ID</th>
                      <th className="px-6 py-2 font-medium">Customer</th>
                      <th className="px-6 py-2 font-medium">Amount</th>
                      <th className="px-6 py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sales.slice(0, 6).map((sale, i) => (
                      <tr key={sale.id} className="border-b border-zinc-900 hover:bg-zinc-900/50 transition-colors">
                        <td className="px-6 py-3 text-yellow-400 font-mono text-xs">#{sale.id.slice(0, 8).toUpperCase()}</td>
                        <td className="px-6 py-3 text-white">{sale.customer || 'Walk-in'}</td>
                        <td className="px-6 py-3 text-zinc-300 font-medium">{money(sale.total)}</td>
                        <td className="px-6 py-3">
                          <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/30">Completed</span>
                        </td>
                      </tr>
                    ))}
                    {sales.length === 0 && (
                      <tr><td colSpan={4} className="px-6 py-8 text-center text-zinc-600">No orders yet.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {canManageInventory && (
            <Card className="glass-card border-red-500/10">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-white"><AlertTriangle className="h-4 w-4 text-red-500" /> Low Stock Alerts</CardTitle>
                <Button asChild variant="ghost" size="sm" className="text-yellow-500 hover:text-yellow-400 text-xs">
                  <Link href="/inventory">View All</Link>
                </Button>
              </CardHeader>
              <CardContent className="space-y-2">
                {stockCurrent.map((p) => (
                  <div key={p.id} className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800 hover:border-red-500/30 transition-colors">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm text-white truncate">{p.name}</p>
                      <p className="text-xs text-zinc-500">Min: {p.minStock} &middot; <span className="text-red-400 font-bold">{p.stock} left</span></p>
                    </div>
                    <Button variant="outline" size="sm" className="text-xs border-red-500/30 text-red-400 hover:bg-red-500/10 h-7 px-2">
                      Restock
                    </Button>
                  </div>
                ))}
                {lowStock.length === 0 && <p className="text-zinc-500 text-sm text-center py-4">All stock levels healthy.</p>}
                {stockPageCount > 1 && (
                  <div className="flex items-center justify-between pt-2 border-t border-zinc-800">
                    <button onClick={() => setStockPage((p) => Math.max(0, p - 1))} disabled={stockPage === 0} className="p-1.5 rounded-md bg-zinc-800 text-zinc-400 hover:text-yellow-500 disabled:opacity-30 transition-all"><ChevronLeft className="h-4 w-4" /></button>
                    <span className="text-xs text-zinc-500">{stockPage + 1}/{stockPageCount}</span>
                    <button onClick={() => setStockPage((p) => Math.min(stockPageCount - 1, p + 1))} disabled={stockPage >= stockPageCount - 1} className="p-1.5 rounded-md bg-zinc-800 text-zinc-400 hover:text-yellow-500 disabled:opacity-30 transition-all"><ChevronRight className="h-4 w-4" /></button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* AI Intelligence Card */}
        {canViewReports && (
          <Card className="glass-card border-yellow-500/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-yellow-500">
                <Brain className="h-5 w-5" /> HOODMART Intelligence
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-zinc-400 mb-4">AI-powered insights from your live business data.</p>
              <div className="flex flex-wrap gap-2">
                <Button asChild className="gold-gradient text-black font-bold text-sm">
                  <Link href="/dashboard/assistant"><Brain className="h-4 w-4 mr-2" /> Open AI Assistant</Link>
                </Button>
                <Button asChild variant="outline" className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 text-sm">
                  <Link href="/dashboard/assistant">What are today&apos;s sales?</Link>
                </Button>
                <Button asChild variant="outline" className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 text-sm">
                  <Link href="/dashboard/assistant">Which products should I restock?</Link>
                </Button>
                <Button asChild variant="outline" className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 text-sm">
                  <Link href="/dashboard/assistant">Give me a business summary</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </DashboardLayout>
    </AuthGuard>
  )
}
