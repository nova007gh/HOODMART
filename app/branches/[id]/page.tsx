'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { AuthGuard, PermissionGuard } from '@/components/auth-guard'
import { DashboardLayout } from '@/components/layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { store, Branch, Sale, money, formatDate } from '@/lib/store'
import { ArrowLeft, Store, MapPin, TrendingUp, ShoppingCart, Users, Package, BarChart3 } from 'lucide-react'

function last7Days() {
  const days: string[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    days.push(d.toISOString().slice(0, 10))
  }
  return days
}

function Bar({ value, max, label, total }: { value: number; max: number; label: string; total?: number }) {
  const pct = max ? Math.round((value / max) * 100) : 0
  return (
    <div className="flex flex-col items-center gap-2 flex-1 min-w-0">
      <div className="w-full flex-1 bg-zinc-800/60 rounded-t-md relative overflow-hidden flex items-end">
        <div className="w-full gold-gradient rounded-t-md transition-all duration-500" style={{ height: `${pct}%` }} title={total ? money(total) : value.toString()} />
      </div>
      <p className="text-[10px] text-zinc-400 truncate w-full text-center">{label}</p>
    </div>
  )
}

export default function BranchDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [branch, setBranch] = useState<Branch | undefined>(undefined)
  const [sales, setSales] = useState<Sale[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { setBranch(store.getBranch(id)); setSales(store.getSales()); setLoading(false) }, [id])

  const branchSales = useMemo(() => sales.filter((s) => s.branchId === id).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()), [sales, id])
  const revenue = branchSales.reduce((sum, s) => sum + s.total, 0)
  const itemsSold = branchSales.reduce((sum, s) => sum + s.items.reduce((a, i) => a + i.qty, 0), 0)
  const activeUsers = useMemo(() => Array.from(new Set(branchSales.map((s) => s.userEmail).filter(Boolean) as string[])), [branchSales])
  const avgOrder = branchSales.length ? revenue / branchSales.length : 0

  const days = last7Days()
  const daily = useMemo(() => {
    return days.map((d) => {
      const daySales = branchSales.filter((s) => s.timestamp.startsWith(d))
      return { date: d, count: daySales.length, total: daySales.reduce((sum, s) => sum + s.total, 0) }
    })
  }, [branchSales])
  const maxDaily = Math.max(1, ...daily.map((d) => d.total))

  const topProducts = useMemo(() => {
    const map = new Map<string, { name: string; qty: number; total: number }>()
    branchSales.forEach((s) => s.items.forEach((i) => {
      const cur = map.get(i.id) || { name: i.name, qty: 0, total: 0 }
      cur.qty += i.qty
      cur.total += i.price * i.qty
      map.set(i.id, cur)
    }))
    return Array.from(map.values()).sort((a, b) => b.qty - a.qty).slice(0, 6)
  }, [branchSales])
  const maxTop = Math.max(1, ...topProducts.map((p) => p.qty))

  if (loading) return <p className="text-zinc-400 p-8">Loading...</p>
  if (!branch) return (
    <AuthGuard>
      <PermissionGuard permission="manage_branches">
      <DashboardLayout>
        <p className="text-zinc-400">Branch not found. <Button asChild variant="link"><Link href="/branches">Back</Link></Button></p>
      </DashboardLayout>
      </PermissionGuard>
    </AuthGuard>
  )

  return (
    <AuthGuard>
      <PermissionGuard permission="manage_branches">
      <DashboardLayout>
        <div className="mb-6 flex items-center gap-3">
          <Button asChild variant="outline" className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"><Link href="/branches"><ArrowLeft className="h-4 w-4 mr-1" /> Back</Link></Button>
        </div>

        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-12 w-12 gold-gradient rounded-lg flex items-center justify-center"><Store className="h-6 w-6 text-black" /></div>
            <div>
              <h1 className="text-3xl font-bold text-white">{branch.name}</h1>
              <p className="text-zinc-400 flex items-center gap-1"><MapPin className="h-4 w-4" /> {branch.location || 'No location'} · <span className={branch.status === 'active' ? 'text-green-400' : 'text-zinc-500'}>{branch.status}</span></p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card className="card-gold"><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-zinc-300 flex items-center gap-2"><TrendingUp className="h-4 w-4 text-yellow-500" /> Revenue</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold gold-text">{money(revenue)}</div></CardContent></Card>
          <Card className="card-gold"><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-zinc-300 flex items-center gap-2"><ShoppingCart className="h-4 w-4 text-blue-500" /> Transactions</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-blue-400">{branchSales.length}</div></CardContent></Card>
          <Card className="card-gold"><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-zinc-300 flex items-center gap-2"><Package className="h-4 w-4 text-purple-500" /> Items Sold</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-purple-400">{itemsSold}</div></CardContent></Card>
          <Card className="card-gold"><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-zinc-300 flex items-center gap-2"><Users className="h-4 w-4 text-green-500" /> Avg Order</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-green-400">{money(avgOrder)}</div></CardContent></Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <Card className="glass-card">
            <CardHeader><CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5 text-yellow-500" /> Sales Last 7 Days</CardTitle></CardHeader>
            <CardContent><div className="h-48 flex items-end gap-3">{daily.map((d) => <Bar key={d.date} value={d.total} max={maxDaily} label={new Date(d.date).toLocaleDateString(undefined, { weekday: 'short' })} total={d.total} />)}</div></CardContent>
          </Card>
          <Card className="glass-card">
            <CardHeader><CardTitle className="flex items-center gap-2"><Package className="h-5 w-5 text-yellow-500" /> Top Products</CardTitle></CardHeader>
            <CardContent><div className="h-48 flex items-end gap-3">{topProducts.map((p, i) => <Bar key={i} value={p.qty} max={maxTop} label={p.name} />)}</div></CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="glass-card lg:col-span-1">
            <CardHeader><CardTitle className="flex items-center gap-2"><Users className="h-4 w-4 text-green-500" /> Active Staff</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {activeUsers.length === 0 && <p className="text-zinc-500 text-sm">No sales recorded yet.</p>}
              {activeUsers.map((u) => <div key={u} className="p-2 rounded bg-zinc-900/60 border border-zinc-800 text-sm text-zinc-200">{u}</div>)}
            </CardContent>
          </Card>
          <Card className="glass-card lg:col-span-2">
            <CardHeader><CardTitle>Recent Transactions</CardTitle></CardHeader>
            <CardContent className="space-y-3 max-h-[400px] overflow-y-auto">
              {branchSales.slice(0, 15).map((s) => (
                <div key={s.id} className="flex items-center justify-between p-2 rounded bg-zinc-900/60 border border-zinc-800">
                  <div>
                    <p className="font-medium text-sm">{formatDate(s.timestamp)}</p>
                    <p className="text-xs text-zinc-500">{s.items.length} item(s) · {s.paymentMethod} · {s.userEmail || 'Unknown'}</p>
                  </div>
                  <span className="font-bold text-yellow-500">{money(s.total)}</span>
                </div>
              ))}
              {branchSales.length === 0 && <p className="text-zinc-500 text-sm">No transactions for this branch.</p>}
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
      </PermissionGuard>
    </AuthGuard>
  )
}
