'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AuthGuard, PermissionGuard } from '@/components/auth-guard'
import { DashboardLayout } from '@/components/layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { store, Branch, Sale, money } from '@/lib/store'
import { Store, Plus, MapPin, TrendingUp, ShoppingCart, Users, ArrowRight } from 'lucide-react'
import toast from 'react-hot-toast'

function branchStats(branchId: string, sales: Sale[]) {
  const branchSales = sales.filter((s) => s.branchId === branchId)
  const revenue = branchSales.reduce((sum, s) => sum + s.total, 0)
  const items = branchSales.reduce((sum, s) => sum + s.items.reduce((a, i) => a + i.qty, 0), 0)
  const users = new Set(branchSales.map((s) => s.userEmail).filter(Boolean))
  const last = branchSales[0]?.timestamp
  return { revenue, items, transactions: branchSales.length, users: users.size, last }
}

export default function BranchesPage() {
  const [branches, setBranches] = useState<Branch[]>([])
  const [sales, setSales] = useState<Sale[]>([])
  const [form, setForm] = useState({ name: '', location: '' })

  const reload = () => { setBranches(store.getBranches()); setSales(store.getSales()) }
  useEffect(() => { reload() }, [])

  const stats = useMemo(() => {
    const map = new Map<string, ReturnType<typeof branchStats>>()
    branches.forEach((b) => map.set(b.id, branchStats(b.id, sales)))
    return map
  }, [branches, sales])

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name) return
    store.addBranch({ name: form.name, location: form.location, status: 'active' })
    setForm({ name: '', location: '' })
    reload()
    toast.success('Branch added')
  }

  const toggle = (id: string) => {
    const b = store.getBranch(id)
    if (!b) return
    store.updateBranch(id, { status: b.status === 'active' ? 'inactive' : 'active' })
    reload()
  }

  return (
    <AuthGuard>
      <PermissionGuard permission="manage_branches">
      <DashboardLayout>
        <div className="mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white">Branches</h1>
            <p className="text-zinc-400">Store locations, live activity, and sales performance.</p>
          </div>
        </div>

        <Card className="glass-card mb-6">
          <CardContent className="p-4">
            <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Branch name" required />
              <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Location" />
              <Button type="submit" className="gold-gradient text-black font-bold"><Plus className="h-4 w-4 mr-2" /> Add Branch</Button>
            </form>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {branches.map((b) => {
            const s = stats.get(b.id)!
            return (
              <Card key={b.id} className="card-gold group relative overflow-hidden">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Store className="h-5 w-5 text-yellow-500" />
                        <h3 className="text-lg font-bold text-white">{b.name}</h3>
                      </div>
                      <p className="text-sm text-zinc-400 flex items-center gap-1"><MapPin className="h-3 w-3" /> {b.location || 'No location'}</p>
                    </div>
                    <button onClick={() => toggle(b.id)} className={`text-xs px-2 py-1 rounded-full border ${b.status === 'active' ? 'bg-green-900/20 text-green-400 border-green-500/30' : 'bg-zinc-800 text-zinc-400 border-zinc-700'}`}>{b.status}</button>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="p-2 rounded bg-zinc-900/60 border border-zinc-800">
                      <p className="text-xs text-zinc-500 flex items-center gap-1"><TrendingUp className="h-3 w-3" /> Revenue</p>
                      <p className="font-bold text-yellow-400">{money(s.revenue)}</p>
                    </div>
                    <div className="p-2 rounded bg-zinc-900/60 border border-zinc-800">
                      <p className="text-xs text-zinc-500 flex items-center gap-1"><ShoppingCart className="h-3 w-3" /> Sales</p>
                      <p className="font-bold text-blue-400">{s.transactions}</p>
                    </div>
                    <div className="p-2 rounded bg-zinc-900/60 border border-zinc-800">
                      <p className="text-xs text-zinc-500 flex items-center gap-1"><Store className="h-3 w-3" /> Items Sold</p>
                      <p className="font-bold text-purple-400">{s.items}</p>
                    </div>
                    <div className="p-2 rounded bg-zinc-900/60 border border-zinc-800">
                      <p className="text-xs text-zinc-500 flex items-center gap-1"><Users className="h-3 w-3" /> Staff</p>
                      <p className="font-bold text-green-400">{s.users}</p>
                    </div>
                  </div>

                  <Button asChild className="w-full gold-gradient text-black font-bold group-hover:shadow-[0_0_20px_rgba(250,204,21,0.4)] transition-all">
                    <Link href={`/branches/${b.id}`}>View Details <ArrowRight className="h-4 w-4 ml-2" /></Link>
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </DashboardLayout>
      </PermissionGuard>
    </AuthGuard>
  )
}
