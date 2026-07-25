'use client'

import { useEffect, useMemo, useState } from 'react'
import { AuthGuard, PermissionGuard } from '@/components/auth-guard'
import { DashboardLayout } from '@/components/layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { store, Activity, Product } from '@/lib/store'
import { Activity as ActivityIcon, Search, Package, Calendar, User, TrendingUp, TrendingDown } from 'lucide-react'
import { formatDateTime } from '@/lib/utils'

export default function ActivitiesPage() {
  const [activities, setActivities] = useState<Activity[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [search, setSearch] = useState('')

  useEffect(() => {
    setActivities(store.getActivities())
    setProducts(store.getProducts())
  }, [])

  const productMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products])

  const stats = useMemo(() => {
    const ins = activities.reduce((sum, a) => sum + (a.quantity > 0 ? a.quantity : 0), 0)
    const outs = activities.reduce((sum, a) => sum + (a.quantity < 0 ? Math.abs(a.quantity) : 0), 0)
    return { total: activities.length, ins, outs }
  }, [activities])

  const filtered = useMemo(() => {
    const term = search.toLowerCase()
    return activities.filter((a) => {
      const product = productMap.get(a.itemId)
      return (
        String(product?.name || '').toLowerCase().includes(term) ||
        String(a.itemId || '').toLowerCase().includes(term) ||
        String(a.comment || '').toLowerCase().includes(term) ||
        String(a.user || '').toLowerCase().includes(term)
      )
    })
  }, [activities, search, productMap])

  return (
    <AuthGuard>
      <PermissionGuard permission="manage_inventory">
      <DashboardLayout>
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="card-gold"><CardContent className="p-4"><p className="text-zinc-400 text-sm">Total Activities</p><p className="text-2xl font-bold gold-text">{stats.total}</p></CardContent></Card>
            <Card className="card-gold"><CardContent className="p-4"><p className="text-zinc-400 text-sm flex items-center gap-2"><TrendingUp className="h-4 w-4 text-green-400" /> Stock In</p><p className="text-2xl font-bold gold-text">{stats.ins}</p></CardContent></Card>
            <Card className="card-gold"><CardContent className="p-4"><p className="text-zinc-400 text-sm flex items-center gap-2"><TrendingDown className="h-4 w-4 text-red-400" /> Stock Out</p><p className="text-2xl font-bold gold-text">{stats.outs}</p></CardContent></Card>
          </div>

          <Card className="glass-card">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <CardTitle className="text-white flex items-center gap-2"><ActivityIcon className="h-5 w-5 text-yellow-500" /> Inventory Activities</CardTitle>
              <div className="relative max-w-xs">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-500" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by item, comment, user..." className="pl-9 bg-zinc-950 border-zinc-800 text-white placeholder:text-zinc-500" />
              </div>
            </CardHeader>
            <CardContent className="max-h-[700px] overflow-y-auto space-y-2">
              {filtered.slice(0, 200).map((a) => {
                const product = productMap.get(a.itemId)
                const isIn = a.quantity > 0
                return (
                  <div key={a.id} className="flex items-center justify-between p-3 rounded-lg bg-zinc-900/60 border border-zinc-800">
                    <div className="flex items-center gap-3">
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center ${isIn ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                        <Package className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">{product?.name || `Item #${a.itemId}`}</p>
                        <p className="text-xs text-zinc-400 flex items-center gap-2 flex-wrap">
                          <span className="flex items-center gap-1"><ActivityIcon className="h-3 w-3" /> Qty: <span className={isIn ? 'text-green-400' : 'text-red-400'}>{a.quantity > 0 ? `+${a.quantity}` : a.quantity}</span></span>
                          <span className="flex items-center gap-1"><User className="h-3 w-3" /> {a.user || 'System'}</span>
                          <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {formatDateTime(a.date)}</span>
                        </p>
                      </div>
                    </div>
                    <p className="text-xs text-zinc-500 max-w-xs truncate text-right">{a.comment || 'Inventory update'}</p>
                  </div>
                )
              })}
              {filtered.length === 0 && <p className="text-zinc-500">No activities found.</p>}
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
      </PermissionGuard>
    </AuthGuard>
  )
}
