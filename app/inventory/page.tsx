'use client'

import { useEffect, useMemo, useState } from 'react'
import { AuthGuard, PermissionGuard } from '@/components/auth-guard'
import { DashboardLayout } from '@/components/layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { store, Product, money } from '@/lib/store'
import { pullTable } from '@/lib/fresh-data'
import * as sync from '@/lib/sync'
import { Package, Search, Plus, Minus, AlertTriangle, Calendar, Image as ImageIcon, Trash2, Archive, TrendingUp, ChevronLeft, ChevronRight } from 'lucide-react'
import toast from 'react-hot-toast'
import Link from 'next/link'

function daysUntil(date?: string) {
  if (!date) return Infinity
  const parsed = new Date(date)
  if (isNaN(parsed.getTime())) return Infinity
  const year = parsed.getFullYear()
  if (year < 2000 || year > 2100) return Infinity
  return Math.ceil((parsed.getTime() - new Date().setHours(0, 0, 0, 0)) / (1000 * 60 * 60 * 24))
}

function statusOf(p: Product) {
  const stock = p.stock ?? 0
  const min = p.minStock ?? 0
  const days = daysUntil(p.expiryDate)
  if (days !== Infinity && days < 0) return { label: 'Expired', class: 'text-red-400 bg-red-900/20 border-red-500/30' }
  if (stock < min) return { label: 'Low Stock', class: 'text-yellow-400 bg-yellow-900/20 border-yellow-500/30' }
  return { label: 'OK', class: 'text-green-400 bg-green-900/20 border-green-500/30' }
}

export default function InventoryPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Product | null>(null)
  const [adjust, setAdjust] = useState<{ id: string; amount: string } | null>(null)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const PAGE_SIZE = 25

  const reload = () => setProducts([...store.getProducts()])
  useEffect(() => {
    reload()
    setLoading(true)
    pullTable('products').then(() => {
      reload()
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    const term = search.toLowerCase()
    return products.filter((p) =>
      String(p.name || '').toLowerCase().includes(term) ||
      String(p.barcode || '').toLowerCase().includes(term) ||
      String(p.category || '').toLowerCase().includes(term) ||
      String(p.supplier || '').toLowerCase().includes(term)
    )
  }, [products, search])

  // Pagination
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const safePage = Math.min(page, Math.max(1, totalPages))
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)
  useEffect(() => { setPage(1) }, [search])

  const lowStock = products.filter((p) => (p.stock ?? 0) < (p.minStock ?? 0))
  const expiring = products.filter((p) => { const d = daysUntil(p.expiryDate); return d !== Infinity && d >= 0 && d <= 7 })
  const expired = products.filter((p) => { const d = daysUntil(p.expiryDate); return d !== Infinity && d < 0 })
  const totalValue = products.reduce((sum, p) => sum + (p.stock ?? 0) * (p.cost ?? p.price), 0)

  const adjustStock = async (id: string, delta: number) => {
    const p = products.find((x) => x.id === id)
    if (!p) return
    const next = Math.max(0, (p.stock ?? 0) + delta)
    store.updateProduct(id, { stock: next })
    reload()
    toast.success(`${p.name} stock updated`)
    // Push to server and verify
    await sync.pushLocalChange('products', store.getProducts().find((x) => x.id === id))
  }

  const applyAdjust = async () => {
    if (!adjust) return
    const p = products.find((x) => x.id === adjust.id)
    if (!p) return
    const amount = parseInt(adjust.amount || '0', 10) || 0
    const next = Math.max(0, (p.stock ?? 0) + amount)
    store.updateProduct(adjust.id, { stock: next })
    reload()
    setAdjust(null)
    toast.success(`${p.name} restocked to ${next} units`)
    // Push to server and verify
    await sync.pushLocalChange('products', store.getProducts().find((x) => x.id === adjust?.id))
  }

  const deleteProduct = (id: string) => {
    if (!confirm('Delete this product?')) return
    store.deleteProduct(id)
    reload()
    toast.success('Product deleted')
  }

  return (
    <AuthGuard>
      <PermissionGuard permission="manage_inventory">
      <DashboardLayout>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-white">Inventory</h1>
            <p className="text-zinc-400">Track stock, expiry, and value across your store.</p>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="outline" className="border-zinc-700 text-zinc-300 hover:bg-zinc-800">
              <Link href="/products">Manage Products</Link>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card className="card-gold">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-zinc-300 flex items-center gap-2"><Package className="h-4 w-4 text-blue-500" /> Total Items</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold text-blue-400">{products.length}</div><p className="text-xs text-zinc-400">SKU count</p></CardContent>
          </Card>
          <Card className="card-gold">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-zinc-300 flex items-center gap-2"><TrendingUp className="h-4 w-4 text-yellow-500" /> Inventory Value</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold text-yellow-400">{money(totalValue)}</div><p className="text-xs text-zinc-400">At cost or price</p></CardContent>
          </Card>
          <Card className="card-gold">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-zinc-300 flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-red-500" /> Low Stock</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold text-red-400">{lowStock.length}</div><p className="text-xs text-zinc-400">Below minimum</p></CardContent>
          </Card>
          <Card className="card-gold">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-zinc-300 flex items-center gap-2"><Calendar className="h-4 w-4 text-yellow-500" /> Expiring</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold text-yellow-400">{expiring.length + expired.length}</div><p className="text-xs text-zinc-400">This week / expired</p></CardContent>
          </Card>
        </div>

        <Card className="glass-card mb-6">
          <CardContent className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-zinc-500" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search inventory..." className="w-full pl-10 bg-zinc-950 border border-zinc-800 text-white rounded-lg p-2 text-sm" />
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card overflow-hidden">
          {loading && (
            <div className="px-4 py-2 bg-yellow-500/10 border-b border-yellow-500/20 text-xs text-yellow-400 flex items-center gap-2">
              <div className="h-3 w-3 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
              Syncing latest inventory from server...
            </div>
          )}
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-900/80 text-zinc-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Product</th>
                  <th className="px-4 py-3 font-medium">Category</th>
                  <th className="px-4 py-3 font-medium">Supplier</th>
                  <th className="px-4 py-3 font-medium">Expiry</th>
                  <th className="px-4 py-3 font-medium text-center">In Stock</th>
                  <th className="px-4 py-3 font-medium text-center">Min</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {pageItems.map((p) => {
                  const status = statusOf(p)
                  const d = daysUntil(p.expiryDate)
                  return (
                    <tr key={p.id} className="hover:bg-zinc-900/40">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded bg-zinc-900 border border-zinc-800 flex items-center justify-center overflow-hidden shrink-0">
                            {p.image ? <img src={p.image} alt={p.name} className="h-full w-full object-cover" /> : <ImageIcon className="h-5 w-5 text-zinc-600" />}
                          </div>
                          <div>
                            <p className="font-medium text-white">{p.name}</p>
                            <p className="text-xs text-zinc-500">{p.barcode || 'No barcode'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-zinc-400">{p.category || '-'}</td>
                      <td className="px-4 py-3 text-zinc-400">{p.supplier || '-'}</td>
                      <td className="px-4 py-3 text-zinc-400">{p.expiryDate ? <span className={d !== Infinity && d < 0 ? 'text-red-400' : d !== Infinity && d <= 7 ? 'text-yellow-400' : ''}>{p.expiryDate}</span> : '-'}</td>
                      <td className="px-4 py-3 text-center font-bold text-white">{p.stock ?? 0}</td>
                      <td className="px-4 py-3 text-center text-zinc-500">{p.minStock ?? 0}</td>
                      <td className="px-4 py-3"><span className={`text-xs px-2 py-1 rounded border ${status.class}`}>{status.label}</span></td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => adjustStock(p.id, -1)} className="p-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300"><Minus className="h-3.5 w-3.5" /></button>
                          <button onClick={() => adjustStock(p.id, 1)} className="p-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300"><Plus className="h-3.5 w-3.5" /></button>
                          <Button size="sm" onClick={() => setAdjust({ id: p.id, amount: '' })} className="gold-gradient text-black text-xs">Restock</Button>
                          <Button size="sm" variant="outline" onClick={() => deleteProduct(p.id)} className="border-red-500/40 text-red-400 hover:bg-red-900/20 p-1.5"><Trash2 className="h-3.5 w-3.5" /></Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {pageItems.length === 0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-zinc-500">No inventory items found.</td></tr>}
              </tbody>
            </table>
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-800">
                <button
                  onClick={() => setPage(Math.max(1, safePage - 1))}
                  disabled={safePage <= 1}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="h-4 w-4" /> Prev
                </button>
                <span className="text-sm text-zinc-400">
                  Page {safePage} of {totalPages} · {filtered.length} items
                </span>
                <button
                  onClick={() => setPage(Math.min(totalPages, safePage + 1))}
                  disabled={safePage >= totalPages}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </CardContent>
        </Card>

        {adjust && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
            <Card className="w-full max-w-sm glass-card">
              <CardHeader className="border-b border-zinc-800"><CardTitle className="text-white flex items-center gap-2"><Archive className="h-5 w-5 text-yellow-500" /> Restock</CardTitle></CardHeader>
              <CardContent className="p-4 space-y-4">
                <p className="text-sm text-zinc-400">Add quantity to <span className="text-white font-medium">{products.find((p) => p.id === adjust.id)?.name}</span></p>
                <input type="number" min="1" value={adjust.amount} onChange={(e) => setAdjust({ ...adjust, amount: e.target.value })} placeholder="Quantity to add" autoFocus className="w-full bg-zinc-950 border border-zinc-800 text-white rounded p-2 text-sm" />
                <div className="flex gap-3">
                  <Button onClick={applyAdjust} className="flex-1 gold-gradient text-black font-bold">Add Stock</Button>
                  <Button onClick={() => setAdjust(null)} variant="outline" className="border-zinc-700 text-zinc-300 hover:bg-zinc-800">Cancel</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </DashboardLayout>
      </PermissionGuard>
    </AuthGuard>
  )
}
