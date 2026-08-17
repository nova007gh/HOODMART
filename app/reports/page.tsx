'use client'

import { useEffect, useMemo, useState } from 'react'
import { AuthGuard, PermissionGuard } from '@/components/auth-guard'
import { DashboardLayout } from '@/components/layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { store, Sale, Product, money, formatDate } from '@/lib/store'
import { generateSalesPDF, generateInventoryPDF, downloadPDF, SalesReportData, InventoryReportData } from '@/lib/reports/pdf'
import { Calendar, FileText, Printer, TrendingUp, Package, DollarSign, BarChart3, Download, ListChecks, Lightbulb } from 'lucide-react'
import { formatDateTime } from '@/lib/utils'

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

  const insights = useMemo(() => {
    const tips: { text: string; tone: 'green' | 'yellow' | 'red' | 'neutral' }[] = []
    if (salesData.revenue === 0) {
      tips.push({ text: 'No sales recorded for this period. Run promotions or social media ads to boost traffic.', tone: 'red' })
    } else {
      if (salesData.topProducts.length > 0) {
        const top = salesData.topProducts[0]
        tips.push({ text: `Top seller is ${top.name} (${top.qty} sold, ${money(top.total)}). Increase stock and promote it.`, tone: 'green' })
      }
      if (salesData.avgOrderValue < 20) {
        tips.push({ text: 'Average order value is low. Bundle products or upsell higher-margin items at checkout.', tone: 'yellow' })
      }
      if (salesData.discounts > salesData.revenue * 0.2) {
        tips.push({ text: 'Discounts exceed 20% of revenue. Review your pricing and discount strategy.', tone: 'red' })
      } else if (salesData.discounts > 0) {
        tips.push({ text: 'Discounts are helping sales. Track which offers drive the most profit.', tone: 'green' })
      }
      const paymentMethods = Object.keys(salesData.byPayment)
      if (paymentMethods.length === 1 && salesData.byPayment['cash']) {
        tips.push({ text: 'Cash dominates payments. Add mobile/card options to reduce queues and increase convenience.', tone: 'yellow' })
      }
    }
    if (tips.length === 0) {
      tips.push({ text: 'Sales are steady. Keep monitoring top products and customer buying patterns.', tone: 'neutral' })
    }
    return tips
  }, [salesData])

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
        downloadPDF(doc, `HOODMART-Sales-Report-${start}-${end}.pdf`)
      } else {
        const doc = generateInventoryPDF(inventoryData)
        downloadPDF(doc, `HOODMART-Inventory-Report-${new Date().toISOString().slice(0, 10)}.pdf`)
      }
    } finally {
      setGenerating(false)
    }
  }

  return (
    <AuthGuard>
      <PermissionGuard permission="view_reports">
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

          {reportType === 'sales' && (
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2"><Lightbulb className="h-5 w-5 text-yellow-500" /> Report Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-zinc-400">
                  For <span className="text-white font-medium">{rangeLabel}</span>, your store recorded{' '}
                  <span className="text-white font-medium">{salesData.sales}</span> transaction{salesData.sales === 1 ? '' : 's'} totaling{' '}
                  <span className="gold-text font-semibold">{money(salesData.revenue)}</span> in revenue across{' '}
                  <span className="text-white font-medium">{salesData.itemsSold}</span> item{salesData.itemsSold === 1 ? '' : 's'} sold,
                  with an average order value of <span className="text-white font-medium">{money(salesData.avgOrderValue)}</span>
                  {salesData.discounts > 0 && <> and <span className="text-white font-medium">{money(salesData.discounts)}</span> given in discounts</>}.
                </p>
                <div className="space-y-2">
                  {insights.map((tip, i) => {
                    const toneClass =
                      tip.tone === 'green' ? 'border-green-500 text-green-400' :
                      tip.tone === 'yellow' ? 'border-yellow-500 text-yellow-400' :
                      tip.tone === 'red' ? 'border-red-500 text-red-400' :
                      'border-zinc-600 text-zinc-300'
                    return (
                      <div key={i} className={`pl-3 border-l-2 text-sm ${toneClass}`}>
                        {tip.text}
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {reportType === 'sales' && (
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2"><ListChecks className="h-5 w-5 text-yellow-500" /> Transaction Details</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-zinc-400 text-xs border-b border-zinc-800">
                        <th className="text-left py-2 px-3">Date & Time</th>
                        <th className="text-left py-2 px-3">Items</th>
                        <th className="text-left py-2 px-3">Payment</th>
                        <th className="text-right py-2 px-3">Discount</th>
                        <th className="text-right py-2 px-3">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSales.length === 0 && (
                        <tr><td colSpan={5} className="text-center py-6 text-zinc-500">No transactions recorded for this period.</td></tr>
                      )}
                      {filteredSales.map((s) => (
                        <tr key={s.id} className="border-b border-zinc-800/50">
                          <td className="py-2 px-3 text-zinc-300 whitespace-nowrap">{formatDateTime(s.timestamp)}</td>
                          <td className="py-2 px-3 text-zinc-400">{s.items.map((i) => `${i.qty}x ${i.name}`).join(', ')}</td>
                          <td className="py-2 px-3 text-zinc-400 capitalize">{s.paymentMethod || 'cash'}</td>
                          <td className="py-2 px-3 text-right text-zinc-400">{money(s.discount)}</td>
                          <td className="py-2 px-3 text-right text-white font-medium">{money(s.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                    {filteredSales.length > 0 && (
                      <tfoot>
                        <tr className="border-t border-yellow-500/30">
                          <td colSpan={4} className="py-3 px-3 text-right font-semibold text-white">Total ({filteredSales.length} transactions)</td>
                          <td className="py-3 px-3 text-right font-bold gold-text">{money(salesData.revenue)}</td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </CardContent>
            </Card>
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
                    <li>HOODMART logo and report title on a clean gold banner</li>
                    <li>Summary boxes for transactions, revenue, items sold, and average order value</li>
                    <li>Payment method breakdown</li>
                    <li>Sales by day</li>
                    <li>Top selling products</li>
                    <li>Business insights & recommendations</li>
                    <li>Full transaction list</li>
                  </ul>
                </div>
              )}
              {reportType === 'inventory' && (
                <div className="space-y-4">
                  <p className="text-zinc-400 text-sm">The PDF will include:</p>
                  <ul className="list-disc pl-5 text-sm text-zinc-300 space-y-1">
                    <li>HOODMART logo and report title on a clean gold banner</li>
                    <li>Summary boxes for total SKUs, total stock, and inventory value</li>
                    <li>Low stock items</li>
                    <li>Out of stock items</li>
                    <li>Expiring and expired products</li>
                    <li>Inventory statistics & recommendations</li>
                  </ul>
                </div>
              )}
              <div className="p-4 rounded-lg bg-zinc-900/50 border border-zinc-800 text-sm text-zinc-400">
                <p>Period: <span className="text-white font-medium">{rangeLabel}</span></p>
                <p>Pages: auto • Format: A4 PDF • Clean white background for easy printing • No external API required</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
      </PermissionGuard>
    </AuthGuard>
  )
}
