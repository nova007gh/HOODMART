'use client'

import { useEffect, useMemo, useState } from 'react'
import { AuthGuard } from '@/components/auth-guard'
import { DashboardLayout } from '@/components/layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { store, Product, Sale, money, formatDate } from '@/lib/store'
import { ShoppingCart, Package, TrendingUp, DollarSign, BarChart3, AlertTriangle, Calendar, ArrowUpRight, CreditCard, Brain } from 'lucide-react'
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

function Bar({ value, max, label, total }: { value: number; max: number; label: string; total?: number }) {
  const pct = max ? Math.round((value / max) * 100) : 0
  const display = total ? money(total) : value.toString()
  return (
    <div className="flex flex-col items-center gap-2 flex-1 min-w-0 group">
      <div className="w-full flex-1 bg-zinc-800/40 rounded-t-lg relative flex items-end">
        <div
          className="w-full rounded-t-lg transition-all duration-700 ease-out bg-gradient-to-t from-yellow-700 via-yellow-500 to-yellow-200 shadow-[0_0_12px_rgba(250,204,21,0.45)] group-hover:shadow-[0_0_28px_rgba(250,204,21,0.85)] relative"
          style={{ height: `${pct}%` }}
          title={display}
        >
          <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] font-bold text-yellow-300 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
            {display}
          </div>
        </div>
      </div>
      <p className="text-[10px] text-zinc-400 truncate w-full text-center group-hover:text-yellow-400 transition-colors">{label}</p>
    </div>
  )
}

export default function DashboardPage() {
  const [sales, setSales] = useState<Sale[]>([])
  const [products, setProducts] = useState<Product[]>([])

  useEffect(() => { setSales(store.getSales()); setProducts(store.getProducts()) }, [])

  const today = new Date().toISOString().slice(0, 10)
  const todaySales = sales.filter((s) => s.timestamp.startsWith(today))
  const todayRevenue = todaySales.reduce((sum, s) => sum + s.total, 0)
  const totalRevenue = sales.reduce((sum, s) => sum + s.total, 0)
  const avgOrder = sales.length ? totalRevenue / sales.length : 0
  const totalItems = products.reduce((sum, p) => sum + (p.stock ?? 0), 0)
  const inventoryValue = products.reduce((sum, p) => sum + (p.stock ?? 0) * (p.cost ?? p.price), 0)
  const lowStock = products.filter((p) => (p.stock ?? 0) < (p.minStock ?? 0))
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
            <p className="text-zinc-400">Live store performance, sales charts, and inventory insights.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" className="border-yellow-500/40 text-yellow-500 hover:bg-yellow-500/10 hover:text-yellow-400 font-bold">
              <Link href="/dashboard/assistant"><Brain className="h-4 w-4 mr-2" /> EMDPOS Intelligence</Link>
            </Button>
            <Button asChild className="gold-gradient text-black font-bold">
              <Link href="/pos"><ShoppingCart className="h-4 w-4 mr-2" /> New Sale</Link>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
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
          <Card className="card-gold">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-zinc-300 flex items-center gap-2"><Package className="h-4 w-4 text-blue-500" /> Inventory Value</CardTitle></CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-400">{money(inventoryValue)}</div>
              <p className="text-xs text-zinc-400">{totalItems} items in stock</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <Button asChild className="h-20 flex-col gap-2 gold-gradient text-black"><Link href="/pos"><ShoppingCart className="h-6 w-6" /><span>New Sale</span></Link></Button>
          <Button asChild variant="outline" className="h-20 flex-col gap-2 border-yellow-500/40 text-yellow-500 hover:bg-yellow-500/10 hover:border-yellow-500/50"><Link href="/dashboard/assistant"><Brain className="h-6 w-6" /><span>Intelligence</span></Link></Button>
          <Button asChild variant="outline" className="h-20 flex-col gap-2 border-zinc-700 text-zinc-200 hover:bg-zinc-800 hover:border-yellow-500/50"><Link href="/products"><ArrowUpRight className="h-6 w-6" /><span>Add Product</span></Link></Button>
          <Button asChild variant="outline" className="h-20 flex-col gap-2 border-zinc-700 text-zinc-200 hover:bg-zinc-800 hover:border-yellow-500/50"><Link href="/inventory"><Package className="h-6 w-6" /><span>Inventory</span></Link></Button>
          <Button asChild variant="outline" className="h-20 flex-col gap-2 border-zinc-700 text-zinc-200 hover:bg-zinc-800 hover:border-yellow-500/50"><Link href="/sales"><BarChart3 className="h-6 w-6" /><span>Sales</span></Link></Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <Card className="glass-card">
            <CardHeader><CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5 text-yellow-500" /> Sales Last 7 Days</CardTitle></CardHeader>
            <CardContent>
              <div className="h-48 flex items-end gap-3">
                {daily.map((d) => <Bar key={d.date} value={d.total} max={maxDaily} label={new Date(d.date).toLocaleDateString(undefined, { weekday: 'short' })} total={d.total} />)}
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader><CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5 text-yellow-500" /> Top Selling Products</CardTitle></CardHeader>
            <CardContent>
              <div className="h-48 flex items-end gap-3">
                {topProducts.map((p, i) => <Bar key={i} value={p.qty} max={maxTop} label={p.name} />)}
              </div>
              {topProducts.length === 0 && <p className="text-zinc-500 text-sm">No sales yet.</p>}
            </CardContent>
          </Card>
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

          <Card className="glass-card">
            <CardHeader><CardTitle className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-red-500" /> Low Stock Alert</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {lowStock.map((p) => (
                <div key={p.id} className="flex items-center justify-between p-2 rounded bg-zinc-900/60 border border-zinc-800">
                  <div>
                    <p className="font-medium text-sm">{p.name}</p>
                    <p className="text-xs text-zinc-500">Stock: {p.stock} / Min: {p.minStock}</p>
                  </div>
                  <span className="text-xs px-2 py-1 rounded-full bg-red-900/30 text-red-400">critical</span>
                </div>
              ))}
              {lowStock.length === 0 && <p className="text-zinc-500 text-sm">All stock levels healthy.</p>}
            </CardContent>
          </Card>

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
        </div>

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
      </DashboardLayout>
    </AuthGuard>
  )
}
