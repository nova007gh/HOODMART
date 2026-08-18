'use client'

import { useEffect, useState } from 'react'
import { AuthGuard, PermissionGuard } from '@/components/auth-guard'
import { DashboardLayout } from '@/components/layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { store, Discount, money } from '@/lib/store'
import { ensureFreshData } from '@/lib/fresh-data'
import { Tag, Percent, Banknote } from 'lucide-react'
import toast from 'react-hot-toast'

export default function DiscountsPage() {
  const [discounts, setDiscounts] = useState<Discount[]>([])
  const [editing, setEditing] = useState<Discount | null>(null)
  const [form, setForm] = useState({ name: '', type: 'percent' as 'percent' | 'fixed', value: '' })

  const reload = () => setDiscounts(store.getDiscounts())
  useEffect(() => { reload(); ensureFreshData().then(reload) }, [])

  const reset = () => { setEditing(null); setForm({ name: '', type: 'percent', value: '' }) }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const value = parseFloat(form.value)
    if (!form.name || isNaN(value) || value < 0) return
    if (editing) {
      store.updateDiscount(editing.id, { name: form.name, type: form.type, value })
      toast.success('Discount updated')
    } else {
      store.addDiscount({ name: form.name, type: form.type, value })
      toast.success('Discount added')
    }
    reset(); reload()
  }

  const edit = (d: Discount) => { setEditing(d); setForm({ name: d.name, type: d.type, value: d.value.toString() }) }

  const remove = (id: string) => { store.deleteDiscount(id); reload(); toast.success('Discount deleted') }

  return (
    <AuthGuard>
      <PermissionGuard permission="manage_discounts">
      <DashboardLayout>
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2"><Tag className="h-5 w-5 text-yellow-500" /> Discounts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-5 gap-2">
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Discount name" required />
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as 'percent' | 'fixed' })}>
                <option value="percent">Percentage (%)</option>
                <option value="fixed">Fixed amount</option>
              </select>
              <input value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} placeholder="Value" type="number" step="0.01" min="0" required />
              <div className="flex gap-2 sm:col-span-2">
                <Button type="submit" className="gold-gradient text-black">{editing ? 'Update' : 'Add'}</Button>
                {editing && <Button type="button" variant="outline" onClick={reset} className="border-zinc-700 text-zinc-300">Cancel</Button>}
              </div>
            </form>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {discounts.map((d) => (
                <Card key={d.id} className="card-gold">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <p className="font-bold text-lg">{d.name}</p>
                      <p className="text-sm text-zinc-400 flex items-center gap-1">
                        {d.type === 'percent' ? <Percent className="h-3 w-3" /> : <Banknote className="h-3 w-3" />}
                        {d.type === 'percent' ? `${d.value}%` : money(d.value)}
                      </p>
                    </div>
                    <div>
                      <button onClick={() => edit(d)} className="p-2 text-yellow-500 hover:text-yellow-400"><Tag className="h-4 w-4" /></button>
                      <button onClick={() => remove(d.id)} className="p-2 text-red-400 hover:text-red-300"><Tag className="h-4 w-4" /></button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      </DashboardLayout>
      </PermissionGuard>
    </AuthGuard>
  )
}
