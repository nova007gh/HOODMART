'use client'

import { useEffect, useState } from 'react'
import { AuthGuard } from '@/components/auth-guard'
import { DashboardLayout } from '@/components/layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { store, Sale, money } from '@/lib/store'
import { Undo2, Receipt } from 'lucide-react'
import toast from 'react-hot-toast'

export default function ReturnsPage() {
  const [sales, setSales] = useState<Sale[]>([])
  useEffect(() => {
    setSales(store.getSales())
    // Pull from server so all sales are available for returns
    fetch('/api/sync?table=sales').then(res => res.json()).then(json => {
      if (json.data?.sales && Array.isArray(json.data.sales)) {
        localStorage.setItem('hoodmart_v2_sales', JSON.stringify(json.data.sales))
        setSales(store.getSales())
      }
    }).catch(() => {})
  }, [])

  const processReturn = (sale: Sale) => {
    const all = store.getSales().filter((s) => s.id !== sale.id)
    store.setSales(all)
    setSales(all)
    toast.success('Return processed and sale removed')
  }

  return (
    <AuthGuard>
      <DashboardLayout>
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2"><Undo2 className="h-5 w-5 text-yellow-500" /> Returns</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {sales.length === 0 && <p className="text-zinc-500">No sales to return.</p>}
            {sales.map((sale) => (
              <div key={sale.id} className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">{sale.id.slice(0, 8)}</p>
                  <p className="text-xs text-zinc-500">{sale.items.length} item(s) · {money(sale.total)}</p>
                </div>
                <button onClick={() => processReturn(sale)} className="px-3 py-1 rounded bg-red-900/30 text-red-400 text-xs hover:bg-red-900/50">Process Return</button>
              </div>
            ))}
          </CardContent>
        </Card>
      </DashboardLayout>
    </AuthGuard>
  )
}
