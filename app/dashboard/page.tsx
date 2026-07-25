'use client'

import { useEffect, useMemo, useState } from 'react'
import { AuthGuard } from '@/components/auth-guard'
import { DashboardLayout } from '@/components/layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { store, Product, Sale, money, formatDate } from '@/lib/store'
import { useAuth } from '@/hooks/useAuth'
import { hasPermission } from '@/lib/auth'
import { ShoppingCart, Package, TrendingUp, DollarSign, BarChart3, AlertTriangle, Calendar, ArrowUpRight, CreditCard, Brain, ChevronLeft, ChevronRight } from 'lucide-react'
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
  return Math.ceil((new Date(date).getTime() - new Date().setHours(0, 0, 0, 0)) / (1000 * 60 * 60 * 24))
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

export default function DashboardPage() {
  const [sales, setSales] = useState<Sale[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const { session } = useAuth()
  const user = session?.user ?? null

  useEffect(() => { setSales(store.getSales()); setProducts(store.getProducts()) }, []);

  const canManageProducts = hasPermission(user, 'manage_products')
  const canManageInventory = hasPermission(user, 'manage_inventory')
  const canViewReports = hasPermission(user, 'view_reports')
  const canProcessSales = hasPermission(user, 'process_sales')
  const isAdminUser = user?.role === 'admin'

  const today = new Date().toISOString().slice(0, 10)
  const todaySales = sales.filter((s) => s.timestamp.startsWith(today))
  const todayRevenue = todaySales.reduce((sum, s) => sum + s.total, 0)
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

  return (
    <AuthGuard>
      <DashboardLayout>
        <div className="mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white">Dashboard</h1>
            <p className="text-zinc-400">Welcome, {user?.name || 'User'} — <span className="capitalize text-yellow-500">{user?.role || 'user'}</span></p>
          </div>
          <div className="flex items-center gap-2">
            {canViewReports && (
              <Button asChild variant="outline" className="border-yellow-500/40 text-yellow-500 hover:bg-yellow-500/10 hover:text-yellow-400 font-bold">
                <Link href="/dashboard/assistant"><Brain className="h-4 w-4 mr-2" /> EMDPOS Intelligence</Link>
              </Button>
            )}
            {canProcessSales && (
              <Button asChild className="gold-gradient text-black font-bold">
                <Link href="/pos"><ShoppingCart className="h-4 w-4 mr-2" /> New Sale</Link>
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {canViewReports && (
            <>
              <Card className="card-gold">
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-zinc-300 flex items-center gap-2"><DollarSign className="h-4 w-4 text-yellow-500" /> Total Sales</CardTitle></CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold gold-text">{money(totalRevenue)}</div>
                  <p className="text-xs text-zinc-400">{sales.length} transactions</p>
                </CardContent>
              </Card>
              <Card className="card-gold">
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-zinc-300 flex items-center gap-2"><TrendingUp className="h-4 w-4 text-green-500" /> Today&apos;s Sales</CardTitle></CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-400">{money(todayRevenue)}</div>
                  <p className="text-xs text-zinc-400">{todaySales.length} transactions today</p>
                </CardContent>
              </Card>
              <Card className="card-gold">
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-zinc-300 flex items-center gap-2"><CreditCard className="h-4 w-4 text-purple-500" /> Avg Order</CardTitle></CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-purple-400">{money(avgOrder)}</div>
                  <p className="text-xs text-zinc-400">Per transaction</p>
                </CardContent>
              </Card>
            </>
          )}
          {canManageInventory && (
            <Card className="card-gold">
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-zinc-300 flex items-center gap-2"><Package className="h-4 w-4 text-blue-500" /> Inventory Value</CardTitle></CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-400">{money(inventoryValue)}</div>
                <p className="text-xs text-zinc-400">{totalItems} items in stock</p>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          {canProcessSales && (
            <Button asChild className="h-20 flex-col gap-2 gold-gradient text-black"><Link href="/pos"><ShoppingCart className="h-6 w-6" /><span>New Sale</span></Link></Button>
          )}
          {canViewReports && (
            <Button asChild variant="outline" className="h-20 flex-col gap-2 border-yellow-500/40 text-yellow-500 hover:bg-yellow-500/10 hover:border-yellow-500/50"><Link href="/dashboard/assistant"><Brain className="h-6 w-6" /><span>Intelligence</span></Link></Button>
          )}
          {canManageProducts && (
            <Button asChild variant="outline" className="h-20 flex-col gap-2 border-zinc-700 text-zinc-200 hover:bg-zinc-800 hover:border-yellow-500/50"><Link href="/products"><ArrowUpRight className="h-6 w-6" /><span>Add Product</span></Link></Button>
          )}
          {canManageInventory && (
            <Button asChild variant="outline" className="h-20 flex-col gap-2 border-zinc-700 text-zinc-200 hover:bg-zinc-800 hover:border-yellow-500/50"><Link href="/inventory"><Package className="h-6 w-6" /><span>Inventory</span></Link></Button>
          )}
          <Button asChild variant="outline" className="h-20 flex-col gap-2 border-zinc-700 text-zinc-200 hover:bg-zinc-800 hover:border-yellow-500/50"><Link href="/sales"><BarChart3 className="h-6 w-6" /><span>Sales</span></Link></Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {canViewReports && (
            <Card className="glass-card border-yellow-500/10">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-white"><BarChart3 className="h-5 w-5 text-yellow-500" /> Sales Chart</CardTitle>
                <div className="flex gap-1">
                  <button onClick={() => setChartRange('7')} className={`px-3 py-1 text-xs rounded-md font-medium transition-all ${chartRange === '7' ? 'gold-gradient text-black' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}>7D</button>
                  <button onClick={() => setChartRange('30')} className={`px-3 py-1 text-xs rounded-md font-medium transition-all ${chartRange === '30' ? 'gold-gradient text-black' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}>30D</button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="h-52 flex items-end gap-1.5">
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
                  <span>Total: <span className="text-yellow-400 font-bold">{money(chartData.reduce((s, d) => s + d.total, 0))}</span></span>
                  <span>{chartData.filter((d) => d.count > 0).length} active days</span>
                </div>
              </CardContent>
            </Card>
          )}

          {canViewReports && (
            <Card className="glass-card border-yellow-500/10">
              <CardHeader><CardTitle className="flex items-center gap-2 text-white"><TrendingUp className="h-5 w-5 text-yellow-500" /> Top Selling Products</CardTitle></CardHeader>
              <CardContent>
                <div className="h-52 flex items-end gap-3">
                  {topProducts.map((p, i) => <GoldBar key={i} value={p.qty} max={maxTop} label={p.name.length > 12 ? p.name.slice(0, 10) + '…' : p.name} />)}
                </div>
                {topProducts.length === 0 && <p className="text-zinc-500 text-sm">No sales yet.</p>}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="glass-card">
            <CardHeader><CardTitle>Recent Sales</CardTitle></CardHeader>
            <CardContent className="space-y-3 max-h-[400px] overflow-y-auto">
              {sales.slice(0, 10).map((sale) => (
                <div key={sale.id} className="flex items-center justify-between p-2 rounded bg-zinc-900/60 border border-zinc-800">
                  <div>
                    <p className="font-medium text-sm">{formatDate(sale.timestamp)}</p>
                    <p className="text-xs text-zinc-500">{sale.items.length} item(s) · {sale.paymentMethod}</p>
                  </div>
                  <span className="font-bold text-yellow-500">{money(sale.total)}</span>
                </div>
              ))}
              {sales.length === 0 && <p className="text-zinc-500 text-sm">No sales yet.</p>}
            </CardContent>
          </Card>

          {canManageInventory && (
            <Card className="glass-card border-red-500/10">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-white"><AlertTriangle className="h-4 w-4 text-red-500" /> Low Stock Alert</CardTitle>
                <span className="text-xs px-2 py-0.5 rounded-full bg-red-900/40 text-red-400 font-bold">{lowStock.length}</span>
              </CardHeader>
              <CardContent className="space-y-2">
                {stockCurrent.map((p) => (
                  <div key={p.id} className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800 hover:border-red-500/30 transition-colors">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm text-white truncate">{p.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-zinc-500">Stock: <span className="text-red-400 font-bold">{p.stock}</span> / Min: {p.minStock}</span>
                      </div>
                    </div>
                    <span className="text-xs px-2 py-1 rounded-full bg-red-900/30 text-red-400 border border-red-800/30">critical</span>
                  </div>
                ))}
                {lowStock.length === 0 && <p className="text-zinc-500 text-sm">All stock levels healthy.</p>}
                {stockPageCount > 1 && (
                  <div className="flex items-center justify-between pt-2 border-t border-zinc-800">
                    <button
                      onClick={() => setStockPage((p) => Math.max(0, p - 1))}
                      disabled={stockPage === 0}
                      className="p-1.5 rounded-md bg-zinc-800 text-zinc-400 hover:text-yellow-500 hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <span className="text-xs text-zinc-500">Page {stockPage + 1} of {stockPageCount}</span>
                    <button
                      onClick={() => setStockPage((p) => Math.min(stockPageCount - 1, p + 1))}
                      disabled={stockPage >= stockPageCount - 1}
                      className="p-1.5 rounded-md bg-zinc-800 text-zinc-400 hover:text-yellow-500 hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {canManageInventory && (
            <Card className="glass-card">
              <CardHeader><CardTitle className="flex items-center gap-2"><Calendar className="h-4 w-4 text-yellow-500" /> Expiry Alert</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {expiring.map((p) => (
                  <div key={p.id} className="flex items-center justify-between p-2 rounded bg-zinc-900/60 border border-zinc-800">
                    <div>
                      <p className="font-medium text-sm">{p.name}</p>
                      <p className="text-xs text-zinc-500">Expires {p.expiryDate}</p>
                    </div>
                    <span className="text-xs px-2 py-1 rounded-full bg-yellow-900/30 text-yellow-400">soon</span>
                  </div>
                ))}
                {expired.map((p) => (
                  <div key={p.id} className="flex items-center justify-between p-2 rounded bg-zinc-900/60 border border-zinc-800">
                    <div>
                      <p className="font-medium text-sm">{p.name}</p>
                      <p className="text-xs text-zinc-500">Expired {p.expiryDate}</p>
                    </div>
                    <span className="text-xs px-2 py-1 rounded-full bg-red-900/30 text-red-400">expired</span>
                  </div>
                ))}
                {expiring.length === 0 && expired.length === 0 && <p className="text-zinc-500 text-sm">No expiry alerts.</p>}
              </CardContent>
            </Card>
          )}
        </div>

        {canViewReports && (
          <Card className="glass-card border-yellow-500/20 mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-yellow-500">
                <Brain className="h-5 w-5" /> EMDPOS Intelligence
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-zinc-400 mb-4">Ask questions about your business and get AI-powered insights from your live data.</p>
              <div className="flex flex-wrap gap-2">
                <Button asChild className="gold-gradient text-black font-bold text-sm">
                  <Link href="/dashboard/assistant"><Brain className="h-4 w-4 mr-2" /> Open Assistant</Link>
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
