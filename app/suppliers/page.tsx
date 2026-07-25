'use client'

import { useEffect, useMemo, useState } from 'react'
import { AuthGuard } from '@/components/auth-guard'
import { DashboardLayout } from '@/components/layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { store, Supplier } from '@/lib/store'
import { Truck, Search, Building2, Phone, Mail, MapPin, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [search, setSearch] = useState('')
  const [form, setForm] = useState({ name: '', companyName: '', agencyName: '', phone: '', email: '', address: '' })

  useEffect(() => { setSuppliers(store.getSuppliers()) }, [])

  const filtered = useMemo(() => {
    const term = search.toLowerCase()
    return suppliers.filter((s) =>
      s.name.toLowerCase().includes(term) ||
      (s.companyName || '').toLowerCase().includes(term) ||
      (s.agencyName || '').toLowerCase().includes(term)
    )
  }, [suppliers, search])

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name) return toast.error('Name is required')
    store.addSupplier({ ...form, deleted: false })
    setForm({ name: '', companyName: '', agencyName: '', phone: '', email: '', address: '' })
    setSuppliers(store.getSuppliers())
    toast.success('Supplier added')
  }

  const remove = (id: string) => {
    const list = suppliers.filter((s) => s.id !== id)
    store.setSuppliers(list)
    setSuppliers(list)
    toast.success('Supplier removed')
  }

  return (
    <AuthGuard>
      <DashboardLayout>
        <div className="space-y-6">
          <Card className="glass-card">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <CardTitle className="text-white flex items-center gap-2"><Truck className="h-5 w-5 text-yellow-500" /> Suppliers</CardTitle>
              <div className="relative max-w-xs">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-500" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search suppliers..." className="pl-9 bg-zinc-950 border-zinc-800 text-white placeholder:text-zinc-500" />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Contact name" required className="bg-zinc-950 border-zinc-800 text-white" />
                <Input value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} placeholder="Company" className="bg-zinc-950 border-zinc-800 text-white" />
                <Input value={form.agencyName} onChange={(e) => setForm({ ...form, agencyName: e.target.value })} placeholder="Agency" className="bg-zinc-950 border-zinc-800 text-white" />
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Phone" className="bg-zinc-950 border-zinc-800 text-white" />
                <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Email" className="bg-zinc-950 border-zinc-800 text-white" />
                <Button type="submit" className="gold-gradient text-black">Add</Button>
              </form>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map((s) => (
                  <Card key={s.id} className="bg-zinc-900/60 border-zinc-800 p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                          <Building2 className="h-5 w-5 text-yellow-500" />
                        </div>
                        <div>
                          <p className="font-semibold text-white">{s.name}</p>
                          <p className="text-xs text-zinc-400">{s.companyName || s.agencyName || 'Supplier'}</p>
                        </div>
                      </div>
                      <button onClick={() => remove(s.id)} className="text-zinc-500 hover:text-red-400"><Trash2 className="h-4 w-4" /></button>
                    </div>
                    <div className="mt-3 space-y-1 text-xs text-zinc-400">
                      {s.phone && <p className="flex items-center gap-2"><Phone className="h-3 w-3" /> {s.phone}</p>}
                      {s.email && <p className="flex items-center gap-2"><Mail className="h-3 w-3" /> {s.email}</p>}
                      {s.address && <p className="flex items-center gap-2"><MapPin className="h-3 w-3" /> {s.address}</p>}
                    </div>
                  </Card>
                ))}
                {filtered.length === 0 && <p className="text-zinc-500 col-span-full">No suppliers found.</p>}
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    </AuthGuard>
  )
}
