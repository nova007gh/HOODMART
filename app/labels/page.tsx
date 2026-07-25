'use client'

import { useEffect, useState } from 'react'
import { AuthGuard, PermissionGuard } from '@/components/auth-guard'
import { DashboardLayout } from '@/components/layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { store, Product, money } from '@/lib/store'
import { Tag, Printer } from 'lucide-react'

export default function LabelsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [productId, setProductId] = useState('')
  const [customName, setCustomName] = useState('')
  const [customPrice, setCustomPrice] = useState('')
  const [qty, setQty] = useState(1)
  const [labels, setLabels] = useState<{ name: string; price: number }[]>([])

  useEffect(() => { setProducts(store.getProducts()) }, [])

  const generate = (e: React.FormEvent) => {
    e.preventDefault()
    let name = customName
    let price = parseFloat(customPrice) || 0
    if (productId) {
      const p = products.find((x) => x.id === productId)
      if (p) { name = p.name; price = p.price }
    }
    name = name.trim() || 'Item'
    const generated = Array.from({ length: Math.max(1, qty) }, () => ({ name, price }))
    setLabels(generated)
  }

  const print = () => window.print()

  return (
    <AuthGuard>
      <PermissionGuard permission="manage_products">
      <DashboardLayout>
        <div className="no-print">
          <Card className="glass-card mb-4">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2"><Tag className="h-5 w-5 text-yellow-500" /> Label Printer</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <form onSubmit={generate} className="grid grid-cols-1 sm:grid-cols-5 gap-2 items-end">
                <select value={productId} onChange={(e) => setProductId(e.target.value)}>
                  <option value="">-- custom --</option>
                  {products.map((p) => <option key={p.id} value={p.id}>{p.name} - {money(p.price)}</option>)}
                </select>
                <input value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder="Custom name" />
                <input value={customPrice} onChange={(e) => setCustomPrice(e.target.value)} placeholder="Custom price" type="number" step="0.01" min="0" />
                <input value={qty} onChange={(e) => setQty(parseInt(e.target.value || '1', 10))} placeholder="Qty" type="number" min="1" />
                <div className="flex gap-2">
                  <Button type="submit" className="gold-gradient text-black">Generate</Button>
                  <Button type="button" onClick={print} variant="outline" className="border-zinc-700 text-zinc-300"><Printer className="h-4 w-4" /></Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        {labels.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {labels.map((l, i) => (
              <div key={i} className="border-2 border-dashed border-zinc-600 rounded-lg p-6 text-center bg-zinc-900">
                <p className="font-bold text-lg truncate">{l.name}</p>
                <p className="text-2xl font-bold gold-text my-2">{money(l.price)}</p>
                <p className="font-mono tracking-widest text-zinc-400">*{l.name.replace(/\s/g, '').toUpperCase().slice(0, 12)}*</p>
              </div>
            ))}
          </div>
        )}
      </DashboardLayout>
      </PermissionGuard>
    </AuthGuard>
  )
}
