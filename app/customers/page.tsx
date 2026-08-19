'use client'

import { useEffect, useMemo, useState } from 'react'
import { AuthGuard } from '@/components/auth-guard'
import { DashboardLayout } from '@/components/layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { store, Customer, Sale, money } from '@/lib/store'
import { pullTable } from '@/lib/fresh-data'
import { notifications } from '@/lib/notifications'
import { Users, Plus, Search, Phone, Mail, MapPin, Building2, Trash2, ShoppingBag, ChevronDown, ChevronUp, Package } from 'lucide-react'
import toast from 'react-hot-toast'

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [sales, setSales] = useState<Sale[]>([])
  const [search, setSearch] = useState('')
  const [form, setForm] = useState({ name: '', phone: '', email: '', address: '', companyName: '' })
  const [expanded, setExpanded] = useState<string | null>(null)

  const reload = () => {
    setCustomers([...store.getCustomers()])
    setSales([...store.getSales()])
  }
  useEffect(() => {
    reload()
    Promise.all([pullTable('customers'), pullTable('sales')]).then(reload)
  }, [])

  // Calculate real purchase stats from sales data
  const customerStats = useMemo(() => {
    const stats = new Map<string, { purchases: number; total: number; sales: Sale[] }>()
    for (const s of sales) {
      // Match by customerId or by customer email
      let matchedId: string | undefined = s.customerId
      if (!matchedId && s.customer) {
        const c = customers.find((c) => c.email?.toLowerCase() === s.customer?.toLowerCase())
        if (c) matchedId = c.id
      }
      if (matchedId) {
        if (!stats.has(matchedId)) stats.set(matchedId, { purchases: 0, total: 0, sales: [] })
        const st = stats.get(matchedId)!
        st.purchases++
        st.total += s.total || 0
        st.sales.push(s)
      }
    }
    return stats
  }, [sales, customers])

  const stats = useMemo(() => {
    let count = customers.length
    let purchases = 0
    let revenue = 0
    for (const c of customers) {
      const cs = customerStats.get(c.id)
      purchases += cs?.purchases || 0
      revenue += cs?.total || 0
    }
    return { count, purchases, revenue }
  }, [customers, customerStats])

  const filtered = useMemo(() => {
    const term = search.toLowerCase()
    return customers.filter((c) =>
      String(c.name || '').toLowerCase().includes(term) ||
      String(c.phone || '').toLowerCase().includes(term) ||
      String(c.email || '').toLowerCase().includes(term) ||
      String(c.companyName || '').toLowerCase().includes(term)
    )
  }, [customers, search])

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name) return toast.error('Name is required')
    store.addCustomer({ ...form, purchases: 0, total: 0 })
    notifications.push('customer', 'Customer added', `${form.name} was added to the customer list`, {
      href: '/customers',
    })
    setForm({ name: '', phone: '', email: '', address: '', companyName: '' })
    reload()
    toast.success('Customer added')
  }

  const remove = (id: string) => {
    store.deleteCustomer(id)
    reload()
    toast.success('Customer removed')
  }

  return (
    <AuthGuard>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="card-gold"><CardContent className="p-4"><p className="text-zinc-400 text-sm">Customers</p><p className="text-2xl font-bold gold-text">{stats.count}</p></CardContent></Card>
            <Card className="card-gold"><CardContent className="p-4"><p className="text-zinc-400 text-sm">Total Purchases</p><p className="text-2xl font-bold gold-text">{stats.purchases}</p></CardContent></Card>
            <Card className="card-gold"><CardContent className="p-4"><p className="text-zinc-400 text-sm">Total Revenue</p><p className="text-2xl font-bold gold-text">{money(stats.revenue)}</p></CardContent></Card>
          </div>

          <Card className="glass-card">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <CardTitle className="text-white flex items-center gap-2"><Users className="h-5 w-5 text-yellow-500" /> Customers</CardTitle>
              <div className="relative max-w-xs">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-500" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search customers..." className="pl-9 bg-zinc-950 border-zinc-800 text-white placeholder:text-zinc-500" />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Name" required className="bg-zinc-950 border-zinc-800 text-white" />
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Phone" className="bg-zinc-950 border-zinc-800 text-white" />
                <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Email" className="bg-zinc-950 border-zinc-800 text-white" />
                <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Address" className="bg-zinc-950 border-zinc-800 text-white" />
                <Input value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} placeholder="Company" className="bg-zinc-950 border-zinc-800 text-white" />
                <Button type="submit" className="gold-gradient text-black"><Plus className="h-4 w-4 mr-2" /> Add</Button>
              </form>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map((c) => {
                  const cs = customerStats.get(c.id)
                  const purchaseCount = cs?.purchases || 0
                  const totalSpent = cs?.total || 0
                  const customerSales = cs?.sales || []
                  const isExpanded = expanded === c.id

                  return (
                    <Card key={c.id} className="bg-zinc-900/60 border-zinc-800 p-4">
                      <div className="flex items-start justify-between">
                        <p className="font-semibold text-white">{c.name}</p>
                        <button onClick={() => remove(c.id)} className="text-zinc-500 hover:text-red-400"><Trash2 className="h-4 w-4" /></button>
                      </div>
                      <div className="mt-2 space-y-1 text-xs text-zinc-400">
                        {c.phone && <p className="flex items-center gap-2"><Phone className="h-3 w-3" /> {c.phone}</p>}
                        {c.email && <p className="flex items-center gap-2"><Mail className="h-3 w-3" /> {c.email}</p>}
                        {c.address && <p className="flex items-center gap-2"><MapPin className="h-3 w-3" /> {c.address}</p>}
                        {c.companyName && <p className="flex items-center gap-2"><Building2 className="h-3 w-3" /> {c.companyName}</p>}
                      </div>
                      <div className="mt-3 flex items-center justify-between text-xs text-zinc-300">
                        <span className="flex items-center gap-1"><ShoppingBag className="h-3 w-3 text-yellow-500" /> {purchaseCount} purchases</span>
                        <span className="font-bold gold-text">{money(totalSpent)}</span>
                      </div>
                      {purchaseCount > 0 && (
                        <button
                          onClick={() => setExpanded(isExpanded ? null : c.id)}
                          className="mt-2 w-full flex items-center justify-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 border-t border-zinc-800 pt-2"
                        >
                          {isExpanded ? <><ChevronUp className="h-3 w-3" /> Hide purchases</> : <><ChevronDown className="h-3 w-3" /> View purchases</>}
                        </button>
                      )}
                      {isExpanded && customerSales.length > 0 && (
                        <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
                          {customerSales
                            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                            .map((s) => (
                              <div key={s.id} className="text-xs border border-zinc-800 rounded p-2 bg-zinc-950/40">
                                <div className="flex justify-between">
                                  <span className="text-zinc-400">#{String(s.id).slice(0, 8)}</span>
                                  <span className="font-bold gold-text">{money(s.total)}</span>
                                </div>
                                <div className="text-zinc-500 mt-0.5">
                                  {new Date(s.timestamp).toLocaleDateString()} · {s.items.length} item{s.items.length !== 1 ? 's' : ''}
                                </div>
                                <div className="text-zinc-600 mt-1 flex flex-wrap gap-1">
                                  {s.items.slice(0, 3).map((item) => (
                                    <span key={item.id + item.name} className="flex items-center gap-0.5">
                                      <Package className="h-2.5 w-2.5" /> {item.name} x{item.qty}
                                    </span>
                                  ))}
                                  {s.items.length > 3 && <span>+{s.items.length - 3} more</span>}
                                </div>
                              </div>
                            ))}
                        </div>
                      )}
                    </Card>
                  )
                })}
                {filtered.length === 0 && <p className="text-zinc-500 col-span-full">No customers found.</p>}
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    </AuthGuard>
  )
}
