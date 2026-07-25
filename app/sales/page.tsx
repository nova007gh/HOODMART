'use client'

import { useEffect, useMemo, useState } from 'react'
import { AuthGuard } from '@/components/auth-guard'
import { DashboardLayout } from '@/components/layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { store, Sale, money } from '@/lib/store'
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
} from 'lucide-react'

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
  const [stats, setStats] = useState({ count: 0, revenue: 0, avg: 0 })

  useEffect(() => {
    const s = store.getSales()
    setSales(s)
    const revenue = s.reduce((sum, x) => sum + x.total, 0)
    setStats({ count: s.length, revenue, avg: s.length ? revenue / s.length : 0 })
  }, [])

  const filtered = useMemo(() => {
    const term = search.toLowerCase()
    return sales.filter((s) =>
      String(s.id || '').toLowerCase().includes(term) ||
      String(s.userName || '').toLowerCase().includes(term) ||
      s.items.some((i) => String(i.name || '').toLowerCase().includes(term))
    )
  }, [sales, search])

  return (
    <AuthGuard>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="card-gold"><CardContent className="p-4"><p className="text-zinc-400 text-sm">Total Sales</p><p className="text-2xl font-bold gold-text">{stats.count}</p></CardContent></Card>
            <Card className="card-gold"><CardContent className="p-4"><p className="text-zinc-400 text-sm">Revenue</p><p className="text-2xl font-bold gold-text">{money(stats.revenue)}</p></CardContent></Card>
            <Card className="card-gold"><CardContent className="p-4"><p className="text-zinc-400 text-sm">Avg Sale</p><p className="text-2xl font-bold gold-text">{money(stats.avg)}</p></CardContent></Card>
          </div>

          <Card className="glass-card">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <CardTitle className="text-white flex items-center gap-2"><CreditCard className="h-5 w-5 text-yellow-500" /> Sales History</CardTitle>
              <div className="relative max-w-xs">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-500" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search sale, employee, item..." className="pl-9 bg-zinc-950 border-zinc-800 text-white placeholder:text-zinc-500" />
              </div>
            </CardHeader>
            <CardContent className="space-y-3 max-h-[600px] overflow-y-auto">
              {filtered.length === 0 && <p className="text-zinc-500">No sales found.</p>}
              {filtered.map((sale) => <SaleCard key={sale.id} sale={sale} />)}
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    </AuthGuard>
  )
}
