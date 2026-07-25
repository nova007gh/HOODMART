'use client'

import { useEffect, useMemo, useState } from 'react'
import { AuthGuard } from '@/components/auth-guard'
import { DashboardLayout } from '@/components/layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { store, Sale, Product, money, formatDate } from '@/lib/store'
import { generateSalesPDF, generateInventoryPDF, downloadPDF, SalesReportData, InventoryReportData } from '@/lib/reports/pdf'
import { Calendar, FileText, Printer, TrendingUp, Package, DollarSign, BarChart3, Download } from 'lucide-react'

export default function ReportsPage() {
  const [sales, setSales] = useState<Sale[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [reportType, setReportType] = useState<'sales' | 'inventory'>('sales')
  const [rangeType, setRangeType] = useState<'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom'>('daily')
  const [start, setStart] = useState(() => new Date().toISOString().slice(0, 10))
  const [end, setEnd] = useState(() => new Date().toISOString().slice(0, 10))
  const [generating, setGenerating] = useState(false)

  useEffect(() => { setSales(store.getSales()); setProducts(store.getProducts()) }, [])

  const today = new Date().toISOString().slice(0, 10)

  useEffect(() => {
    const now = new Date()
    if (rangeType === 'daily') {
      setStart(today); setEnd(today)
    } else if (rangeType === 'weekly') {
      const d = new Date(); d.setDate(d.getDate() - 6)
      setStart(d.toISOString().slice(0, 10)); setEnd(today)
    } else if (rangeType === 'monthly') {
      const d = new Date(); d.setDate(1)
      setStart(d.toISOString().slice(0, 10)); setEnd(today)
    } else if (rangeType === 'yearly') {
      const d = new Date(); d.setMonth(0, 1)
      setStart(d.toISOString().slice(0, 10)); setEnd(today)
    }
  }, [rangeType, today])

  const rangeLabel = useMemo(() => {
    if (start === end) return formatDate(start)
    return `${formatDate(start)} – ${formatDate(end)}`
  }, [start, end])

  const filteredSales = useMemo(() => {
    return sales.filter((s) => s.timestamp.slice(0, 10) >= start && s.timestamp.slice(0, 10) <= end)
  }, [sales, start, end])

  const salesData = useMemo(() => {
    const total = filteredSales.reduce((sum, s) => sum + s.total, 0)
    const discounts = filteredSales.reduce((sum, s) => sum + s.discount, 0)
    const refunds = 0
    const items = filteredSales.reduce((sum, s) => sum + s.items.reduce((is, i) => is + i.qty, 0), 0)
    const byPayment: Record<string, number> = {}
    const byDay: Record<string, number> = {}
    const productMap = new Map<string, { name: string; qty: number; total: number }>()

    filteredSales.forEach((s) => {
      const day = s.timestamp.slice(0, 10)
      byDay[day] = (byDay[day] || 0) + s.total
      const pm = s.paymentMethod || 'cash'
      byPayment[pm] = (byPayment[pm] || 0) + s.total
      s.items.forEach((i) => {
        const cur = productMap.get(i.id) || { name: i.name, qty: 0, total: 0 }
        cur.qty += i.qty
        cur.total += i.price * i.qty
        productMap.set(i.id, cur)
      })
    })

    const topProducts = Array.from(productMap.values()).sort((a, b) => b.qty - a.qty).slice(0, 10)

    const data: SalesReportData = {
      label: rangeType.charAt(0).toUpperCase() + rangeType.slice(1),
      startDate: start,
      endDate: end,
      sales: filteredSales.length,
      revenue: total,
      itemsSold: items,
      avgOrderValue: filteredSales.length ? total / filteredSales.length : 0,
      discounts,
      refunds,
      byPayment,
      byDay,
      topProducts,
      transactions: filteredSales,
    }
    return data
  }, [filteredSales, rangeType, start, end])

  const inventoryData = useMemo((): InventoryReportData => {
    const totalStock = products.reduce((sum, p) => sum + (p.stock ?? 0), 0)
    const totalValue = products.reduce((sum, p) => sum + (p.stock ?? 0) * (p.cost ?? p.price), 0)
    const lowStock = products
      .filter((p) => (p.stock ?? 0) < (p.minStock ?? 0))
      .map((p) => ({ name: p.name, stock: p.stock ?? 0, minStock: p.minStock ?? 0 }))
    const outOfStock = products.filter((p) => (p.stock ?? 0) === 0).map((p) => ({ name: p.name }))
    const expiring: { name: string; expiryDate: string }[] = []
    const expired: { name: string; expiryDate: string }[] = []

    products.forEach((p) => {
      if (!p.expiryDate) return
      const days = Math.ceil((new Date(p.expiryDate).getTime() - new Date().setHours(0, 0, 0, 0)) / (1000 * 60 * 60 * 24))
      if (days >= 0 && days <= 7) expiring.push({ name: p.name, expiryDate: p.expiryDate })
      else if (days < 0) expired.push({ name: p.name, expiryDate: p.expiryDate })
    })

    return {
      label: 'Inventory',
      generatedAt: new Date().toISOString().slice(0, 10),
      totalSkus: products.length,
      totalStock,
      inventoryValue: totalValue,
      lowStock,
      outOfStock,
      expiring,
      expired,
    }
  }, [products])

  async function handlePrint() {
    setGenerating(true)
    try {
      if (reportType === 'sales') {
        const doc = generateSalesPDF(salesData)
        downloadPDF(doc, `EMDPOS-Sales-Report-${start}-${end}.pdf`)
      } else {
        const doc = generateInventoryPDF(inventoryData)
        downloadPDF(doc, `EMDPOS-Inventory-Report-${new Date().toISOString().slice(0, 10)}.pdf`)
      }
    } finally {
      setGenerating(false)
    }
  }

  return (
    <AuthGuard>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-white">Reports</h1>
              <p className="text-zinc-400 text-sm">Generate printable business reports with date ranges.</p>
            </div>
            <Button
              onClick={handlePrint}
              disabled={generating}
              className="gold-gradient text-black"
            >
              {generating ? <BarChart3 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
              {generating ? 'Preparing…' : 'Download PDF'}
            </Button>
          </div>

          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2"><FileText className="h-5 w-5 text-yellow-500" /> Report Options</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={reportType === 'sales' ? 'default' : 'outline'}
                  onClick={() => setReportType('sales')}
                  className={reportType === 'sales' ? 'gold-gradient text-black' : 'border-zinc-700 text-zinc-300 hover:bg-zinc-800'}
                >
                  <TrendingUp className="h-4 w-4 mr-2" /> Sales
                </Button>
                <Button
                  variant={reportType === 'inventory' ? 'default' : 'outline'}
                  onClick={() => setReportType('inventory')}
                  className={reportType === 'inventory' ? 'gold-gradient text-black' : 'border-zinc-700 text-zinc-300 hover:bg-zinc-800'}
                >
                  <Package className="h-4 w-4 mr-2" /> Inventory
                </Button>
              </div>

              <div className="flex flex-wrap gap-2">
                {(['daily', 'weekly', 'monthly', 'yearly', 'custom'] as const).map((t) => (
                  <Button
                    key={t}
                    variant={rangeType === t ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setRangeType(t)}
                    className={rangeType === t ? 'bg-zinc-800 text-yellow-500 border-yellow-500/50' : 'border-zinc-700 text-zinc-400 hover:bg-zinc-800'}
                  >
                    {t[0].toUpperCase() + t.slice(1)}
                  </Button>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row gap-3 items-end">
                <div className="space-y-1">
                  <label className="text-xs text-zinc-500">Start date</label>
                  <input
                    type="date"
                    value={start}
                    onChange={(e) => { setStart(e.target.value); setRangeType('custom') }}
                    className="bg-zinc-900 border border-zinc-700 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-yellow-500/50"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-zinc-500">End date</label>
                  <input
                    type="date"
                    value={end}
                    onChange={(e) => { setEnd(e.target.value); setRangeType('custom') }}
                    className="bg-zinc-900 border border-zinc-700 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-yellow-500/50"
                  />
                </div>
                <p className="text-sm text-yellow-500 font-medium">{rangeLabel}</p>
              </div>
            </CardContent>
          </Card>

          {reportType === 'sales' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="card-gold"><CardContent className="p-4"><DollarSign className="h-6 w-6 text-yellow-500 mb-2" /><p className="text-sm text-zinc-400">Revenue</p><p className="text-2xl font-bold gold-text">{money(salesData.revenue)}</p></CardContent></Card>
              <Card className="card-gold"><CardContent className="p-4"><BarChart3 className="h-6 w-6 text-blue-500 mb-2" /><p className="text-sm text-zinc-400">Transactions</p><p className="text-2xl font-bold text-blue-400">{salesData.sales}</p></CardContent></Card>
              <Card className="card-gold"><CardContent className="p-4"><Package className="h-6 w-6 text-green-500 mb-2" /><p className="text-sm text-zinc-400">Items Sold</p><p className="text-2xl font-bold text-green-400">{salesData.itemsSold}</p></CardContent></Card>
              <Card className="card-gold"><CardContent className="p-4"><TrendingUp className="h-6 w-6 text-purple-500 mb-2" /><p className="text-sm text-zinc-400">Avg Sale</p><p className="text-2xl font-bold text-purple-400">{money(salesData.avgOrderValue)}</p></CardContent></Card>
            </div>
          )}

          {reportType === 'inventory' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="card-gold"><CardContent className="p-4"><Package className="h-6 w-6 text-yellow-500 mb-2" /><p className="text-sm text-zinc-400">Total SKUs</p><p className="text-2xl font-bold gold-text">{inventoryData.totalSkus}</p></CardContent></Card>
              <Card className="card-gold"><CardContent className="p-4"><BarChart3 className="h-6 w-6 text-blue-500 mb-2" /><p className="text-sm text-zinc-400">Total Stock</p><p className="text-2xl font-bold text-blue-400">{inventoryData.totalStock}</p></CardContent></Card>
              <Card className="card-gold"><CardContent className="p-4"><DollarSign className="h-6 w-6 text-green-500 mb-2" /><p className="text-sm text-zinc-400">Inventory Value</p><p className="text-2xl font-bold text-green-400">{money(inventoryData.inventoryValue)}</p></CardContent></Card>
            </div>
          )}

          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2"><Printer className="h-5 w-5 text-yellow-500" /> Report Preview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {reportType === 'sales' && (
                <div className="space-y-4">
                  <p className="text-zinc-400 text-sm">The PDF will include:</p>
                  <ul className="list-disc pl-5 text-sm text-zinc-300 space-y-1">
                    <li>EMDPOS logo and report title</li>
                    <li>Summary boxes for transactions, revenue, items sold, and average order value</li>
                    <li>Payment method breakdown</li>
                    <li>Sales by day</li>
                    <li>Top selling products</li>
                  </ul>
                </div>
              )}
              {reportType === 'inventory' && (
                <div className="space-y-4">
                  <p className="text-zinc-400 text-sm">The PDF will include:</p>
                  <ul className="list-disc pl-5 text-sm text-zinc-300 space-y-1">
                    <li>EMDPOS logo and report title</li>
                    <li>Summary boxes for total SKUs, total stock, and inventory value</li>
                    <li>Low stock items</li>
                    <li>Out of stock items</li>
                    <li>Expiring and expired products</li>
                  </ul>
                </div>
              )}
              <div className="p-4 rounded-lg bg-zinc-900/50 border border-zinc-800 text-sm text-zinc-400">
                <p>Period: <span className="text-white font-medium">{rangeLabel}</span></p>
                <p>Pages: auto • Format: A4 PDF • No external API required</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    </AuthGuard>
  )
}
