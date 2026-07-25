'use client'

import { useEffect, useMemo, useState } from 'react'
import { AuthGuard } from '@/components/auth-guard'
import { DashboardLayout } from '@/components/layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { store, Customer, money } from '@/lib/store'
import { Users, Plus, Search, Phone, Mail, MapPin, Building2, Trash2, ShoppingBag } from 'lucide-react'
import toast from 'react-hot-toast'

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [search, setSearch] = useState('')
  const [form, setForm] = useState({ name: '', phone: '', email: '', address: '', companyName: '' })
  useEffect(() => { setCustomers(store.getCustomers()) }, [])

  const stats = useMemo(() => {
    const purchases = customers.reduce((s, c) => s + c.purchases, 0)
    const revenue = customers.reduce((s, c) => s + c.total, 0)
    return { count: customers.length, purchases, revenue }
  }, [customers])

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
    setForm({ name: '', phone: '', email: '', address: '', companyName: '' })
    setCustomers(store.getCustomers())
    toast.success('Customer added')
  }

  const remove = (id: string) => {
    store.deleteCustomer(id)
    setCustomers(store.getCustomers())
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
                {filtered.map((c) => (
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
                    <div className="mt-3 flex gap-3 text-xs text-zinc-300">
                      <span className="flex items-center gap-1"><ShoppingBag className="h-3 w-3 text-yellow-500" /> {c.purchases}</span>
                      <span>{money(c.total)}</span>
                    </div>
                  </Card>
                ))}
                {filtered.length === 0 && <p className="text-zinc-500 col-span-full">No customers found.</p>}
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    </AuthGuard>
  )
}
