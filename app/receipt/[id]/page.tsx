'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { store, Sale, money } from '@/lib/store'
import { formatDateTime } from '@/lib/utils'

export default function ReceiptPage() {
  const { id } = useParams<{ id: string }>()
  const [sale, setSale] = useState<Sale | undefined>(undefined)

  useEffect(() => {
    const found = store.getSales().find((s) => s.id === id)
    setSale(found)
    const t = setTimeout(() => window.print(), 600)
    return () => clearTimeout(t)
  }, [id])

  if (!sale) {
    return (
      <div className="min-h-screen bg-white text-black flex items-center justify-center">
        <p className="text-zinc-600">Receipt not found.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-100 text-black p-4">
      <div className="receipt-page max-w-[80mm] mx-auto bg-white p-4 rounded shadow-lg">
        <h1 className="text-center font-bold text-xl tracking-wider">EMDPOS</h1>
        <p className="text-center text-xs text-zinc-600">{formatDateTime(sale.timestamp)}</p>
        <p className="text-center text-xs text-zinc-600 uppercase">{sale.paymentMethod}</p>
        {sale.branchId && <p className="text-center text-xs text-zinc-600">Branch: {sale.branchId}</p>}
        <p className="text-center text-xs text-zinc-600">Served by: {sale.userName || sale.userEmail || 'Unknown'}</p>

        <div className="border-t border-black my-3" />

        <div className="space-y-1 text-sm">
          {sale.items.map((item) => (
            <div key={item.id} className="flex justify-between">
              <span className="truncate flex-1">{item.name} x{item.qty}</span>
              <span>{money(item.price * item.qty)}</span>
            </div>
          ))}
        </div>

        <div className="border-t border-black my-3" />

        <div className="space-y-1 text-sm">
          <div className="flex justify-between"><span>Subtotal</span><span>{money(sale.subtotal)}</span></div>
          {sale.discount > 0 && <div className="flex justify-between"><span>Discount</span><span>-{money(sale.discount)}</span></div>}
          <div className="flex justify-between font-bold text-base"><span>Total</span><span>{money(sale.total)}</span></div>
        </div>

        <p className="text-center text-xs mt-6 text-zinc-600">Thank you for shopping with us!</p>
      </div>
    </div>
  )
}
