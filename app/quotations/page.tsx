'use client'

import { useEffect, useState, useMemo } from 'react'
import { AuthGuard } from '@/components/auth-guard'
import { DashboardLayout } from '@/components/layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { store, Quotation, Product, CartItem, money, formatDateTime } from '@/lib/store'
import { FileText, Plus, Search, Trash2, X, CheckCircle, ShoppingCart } from 'lucide-react'
import toast from 'react-hot-toast'

export default function QuotationsPage() {
  const [quotations, setQuotations] = useState<Quotation[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [viewQuote, setViewQuote] = useState<Quotation | null>(null)
  const [newQuote, setNewQuote] = useState({
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    notes: '',
  })
  const [cart, setCart] = useState<CartItem[]>([])
  const [productSearch, setProductSearch] = useState('')

  const reload = () => {
    setQuotations(store.getQuotations())
    setProducts(store.getProducts())
  }
  useEffect(() => { reload() }, [])

  const filtered = quotations.filter((q) =>
    q.quoteNumber.toLowerCase().includes(search.toLowerCase()) ||
    q.customerName.toLowerCase().includes(search.toLowerCase())
  )

  const cartSubtotal = cart.reduce((sum, i) => sum + i.price * i.qty, 0)
  const cartTotal = cartSubtotal

  const searchResults = useMemo(() => {
    const term = productSearch.toLowerCase()
    return products.filter((p) =>
      p.name.toLowerCase().includes(term) || (p.barcode || '').toLowerCase().includes(term)
    ).slice(0, 10)
  }, [products, productSearch])

  const addToCart = (p: Product) => {
    const existing = cart.find((c) => c.id === p.id)
    if (existing) {
      setCart(cart.map((c) => c.id === p.id ? { ...c, qty: c.qty + 1 } : c))
    } else {
      setCart([...cart, { ...p, qty: 1 }])
    }
  }

  const updateQty = (id: string, qty: number) => {
    if (qty <= 0) {
      setCart(cart.filter((c) => c.id !== id))
    } else {
      setCart(cart.map((c) => c.id === id ? { ...c, qty } : c))
    }
  }

  const handleCreate = () => {
    if (!newQuote.customerName) { toast.error('Enter customer name'); return }
    if (cart.length === 0) { toast.error('Add at least one product'); return }
    const q = store.addQuotation({
      customerName: newQuote.customerName,
      customerEmail: newQuote.customerEmail || undefined,
      customerPhone: newQuote.customerPhone || undefined,
      items: cart,
      subtotal: cartSubtotal,
      discount: 0,
      total: cartTotal,
      status: 'draft',
      validUntil: newQuote.validUntil,
      notes: newQuote.notes || undefined,
    })
    toast.success(`Quotation ${q.quoteNumber} created!`)
    setNewQuote({ customerName: '', customerEmail: '', customerPhone: '', validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), notes: '' })
    setCart([])
    setShowAdd(false)
    reload()
  }

  const handleStatusChange = (id: string, status: Quotation['status']) => {
    store.updateQuotation(id, { status })
    toast.success(`Quotation marked as ${status}`)
    reload()
  }

  const handleConvert = (id: string) => {
    if (!confirm('Convert this quotation to a sale?')) return
    const sale = store.convertQuotationToSale(id)
    if (sale) {
      toast.success(`Converted to sale! Receipt available in Sales.`)
      reload()
    } else {
      toast.error('Failed to convert')
    }
  }

  const handleDelete = (id: string) => {
    if (!confirm('Delete this quotation?')) return
    store.deleteQuotation(id)
    toast.success('Quotation deleted')
    reload()
  }

  const statusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'text-zinc-400 bg-zinc-500/10'
      case 'sent': return 'text-blue-400 bg-blue-500/10'
      case 'accepted': return 'text-green-400 bg-green-500/10'
      case 'rejected': return 'text-red-400 bg-red-500/10'
      case 'expired': return 'text-orange-400 bg-orange-500/10'
      default: return 'text-zinc-400 bg-zinc-500/10'
    }
  }

  return (
    <AuthGuard>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                <FileText className="h-6 w-6 text-yellow-500" />
                Quotations
              </h1>
              <p className="text-zinc-400 text-sm mt-1">Create quotes for customers and convert to sales</p>
            </div>
            <Button onClick={() => setShowAdd(!showAdd)} className="gold-gradient text-black">
              <Plus className="h-4 w-4 mr-2" />
              New Quotation
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <Card className="glass-card border-zinc-700/50">
              <CardContent className="pt-6">
                <p className="text-sm text-zinc-400">Total</p>
                <p className="text-2xl font-bold text-white">{quotations.length}</p>
              </CardContent>
            </Card>
            <Card className="glass-card border-zinc-700/50">
              <CardContent className="pt-6">
                <p className="text-sm text-zinc-400">Draft</p>
                <p className="text-2xl font-bold text-zinc-400">{quotations.filter((q) => q.status === 'draft').length}</p>
              </CardContent>
            </Card>
            <Card className="glass-card border-zinc-700/50">
              <CardContent className="pt-6">
                <p className="text-sm text-zinc-400">Accepted</p>
                <p className="text-2xl font-bold text-green-400">{quotations.filter((q) => q.status === 'accepted').length}</p>
              </CardContent>
            </Card>
            <Card className="glass-card border-zinc-700/50">
              <CardContent className="pt-6">
                <p className="text-sm text-zinc-400">Total Value</p>
                <p className="text-2xl font-bold text-yellow-500">{money(quotations.reduce((s, q) => s + q.total, 0))}</p>
              </CardContent>
            </Card>
          </div>

          {showAdd && (
            <Card className="glass-card border-zinc-700/50">
              <CardHeader>
                <CardTitle className="text-white">Create New Quotation</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-zinc-300">Customer Name *</Label>
                    <Input value={newQuote.customerName} onChange={(e) => setNewQuote({ ...newQuote, customerName: e.target.value })} placeholder="John Doe" className="bg-zinc-800 border-zinc-700 text-white" />
                  </div>
                  <div>
                    <Label className="text-zinc-300">Customer Email</Label>
                    <Input value={newQuote.customerEmail} onChange={(e) => setNewQuote({ ...newQuote, customerEmail: e.target.value })} placeholder="john@email.com" className="bg-zinc-800 border-zinc-700 text-white" />
                  </div>
                  <div>
                    <Label className="text-zinc-300">Customer Phone</Label>
                    <Input value={newQuote.customerPhone} onChange={(e) => setNewQuote({ ...newQuote, customerPhone: e.target.value })} placeholder="0244-123-456" className="bg-zinc-800 border-zinc-700 text-white" />
                  </div>
                  <div>
                    <Label className="text-zinc-300">Valid Until</Label>
                    <Input type="date" value={newQuote.validUntil} onChange={(e) => setNewQuote({ ...newQuote, validUntil: e.target.value })} className="bg-zinc-800 border-zinc-700 text-white" />
                  </div>
                </div>

                <div className="border-t border-zinc-800 pt-4">
                  <Label className="text-zinc-300">Add Products</Label>
                  <Input value={productSearch} onChange={(e) => setProductSearch(e.target.value)} placeholder="Search products..." className="bg-zinc-800 border-zinc-700 text-white mb-2" />
                  {productSearch && searchResults.length > 0 && (
                    <div className="border border-zinc-700 rounded-md max-h-40 overflow-y-auto">
                      {searchResults.map((p) => (
                        <button key={p.id} onClick={() => { addToCart(p); setProductSearch('') }} className="w-full text-left p-2 hover:bg-zinc-800 text-sm text-white">
                          {p.name} — {money(p.price)}
                        </button>
                      ))}
                    </div>
                  )}

                  {cart.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {cart.map((item) => (
                        <div key={item.id} className="flex items-center justify-between bg-zinc-800/50 rounded p-2">
                          <span className="text-white text-sm">{item.name}</span>
                          <div className="flex items-center gap-2">
                            <Input type="number" value={item.qty} onChange={(e) => updateQty(item.id, parseInt(e.target.value) || 0)} className="w-16 bg-zinc-800 border-zinc-700 text-white text-sm" />
                            <span className="text-zinc-400 text-sm">{money(item.price * item.qty)}</span>
                            <button onClick={() => updateQty(item.id, 0)} className="text-red-400"><X className="h-4 w-4" /></button>
                          </div>
                        </div>
                      ))}
                      <div className="flex justify-between pt-2 border-t border-zinc-800">
                        <span className="text-white font-semibold">Total</span>
                        <span className="text-yellow-500 font-bold">{money(cartTotal)}</span>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <Label className="text-zinc-300">Notes</Label>
                  <Input value={newQuote.notes} onChange={(e) => setNewQuote({ ...newQuote, notes: e.target.value })} placeholder="Optional notes for the customer" className="bg-zinc-800 border-zinc-700 text-white" />
                </div>

                <div className="flex gap-2">
                  <Button onClick={handleCreate} className="gold-gradient text-black">Create Quotation</Button>
                  <Button onClick={() => setShowAdd(false)} variant="outline" className="border-zinc-700 text-zinc-300">Cancel</Button>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-zinc-500" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by quote number or customer..." className="bg-zinc-800 border-zinc-700 text-white max-w-sm" />
          </div>

          <Card className="glass-card border-zinc-700/50">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-zinc-800">
                    <tr className="text-left text-zinc-400">
                      <th className="p-3">Quote #</th>
                      <th className="p-3">Customer</th>
                      <th className="p-3">Items</th>
                      <th className="p-3">Total</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Valid Until</th>
                      <th className="p-3">Created</th>
                      <th className="p-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 ? (
                      <tr><td colSpan={8} className="p-8 text-center text-zinc-500">No quotations yet. Create one to get started.</td></tr>
                    ) : filtered.map((q) => (
                      <tr key={q.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                        <td className="p-3 font-mono text-yellow-500">{q.quoteNumber}</td>
                        <td className="p-3 text-white">{q.customerName}</td>
                        <td className="p-3 text-zinc-400">{q.items.length} item(s)</td>
                        <td className="p-3 text-white font-semibold">{money(q.total)}</td>
                        <td className="p-3">
                          <select value={q.status} onChange={(e) => handleStatusChange(q.id, e.target.value as Quotation['status'])} className={`px-2 py-1 rounded text-xs ${statusColor(q.status)} bg-transparent border-0`}>
                            <option value="draft">draft</option>
                            <option value="sent">sent</option>
                            <option value="accepted">accepted</option>
                            <option value="rejected">rejected</option>
                            <option value="expired">expired</option>
                          </select>
                        </td>
                        <td className="p-3 text-zinc-400">{q.validUntil}</td>
                        <td className="p-3 text-zinc-400">{formatDateTime(q.createdAt)}</td>
                        <td className="p-3">
                          <div className="flex gap-1">
                            <button onClick={() => setViewQuote(q)} className="p-1 text-blue-400 hover:text-blue-300" title="View">
                              <FileText className="h-4 w-4" />
                            </button>
                            {q.status !== 'accepted' && (
                              <button onClick={() => handleConvert(q.id)} className="p-1 text-green-400 hover:text-green-300" title="Convert to Sale">
                                <ShoppingCart className="h-4 w-4" />
                              </button>
                            )}
                            <button onClick={() => handleDelete(q.id)} className="p-1 text-red-400 hover:text-red-300" title="Delete">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {viewQuote && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setViewQuote(null)}>
              <Card className="glass-card border-zinc-700/50 w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
                <CardHeader>
                  <CardTitle className="text-white flex items-center justify-between">
                    Quotation {viewQuote.quoteNumber}
                    <button onClick={() => setViewQuote(null)}><X className="h-5 w-5 text-zinc-400" /></button>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div><span className="text-zinc-400">Customer:</span> <span className="text-white">{viewQuote.customerName}</span></div>
                    <div><span className="text-zinc-400">Status:</span> <span className={`px-2 py-0.5 rounded text-xs ${statusColor(viewQuote.status)}`}>{viewQuote.status}</span></div>
                    <div><span className="text-zinc-400">Email:</span> <span className="text-white">{viewQuote.customerEmail || '—'}</span></div>
                    <div><span className="text-zinc-400">Phone:</span> <span className="text-white">{viewQuote.customerPhone || '—'}</span></div>
                    <div><span className="text-zinc-400">Valid Until:</span> <span className="text-white">{viewQuote.validUntil}</span></div>
                    <div><span className="text-zinc-400">Created:</span> <span className="text-white">{formatDateTime(viewQuote.createdAt)}</span></div>
                  </div>
                  <div className="border-t border-zinc-800 pt-3">
                    <p className="text-zinc-400 text-sm mb-2">Items</p>
                    <div className="space-y-2">
                      {viewQuote.items.map((item) => (
                        <div key={item.id} className="flex justify-between text-sm">
                          <span className="text-white">{item.name} × {item.qty}</span>
                          <span className="text-zinc-300">{money(item.price * item.qty)}</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-between pt-2 mt-2 border-t border-zinc-800">
                      <span className="text-white font-semibold">Total</span>
                      <span className="text-yellow-500 font-bold">{money(viewQuote.total)}</span>
                    </div>
                  </div>
                  {viewQuote.notes && (
                    <div className="text-sm text-zinc-400"><span className="font-semibold">Notes:</span> {viewQuote.notes}</div>
                  )}
                  {viewQuote.status !== 'accepted' && (
                    <Button onClick={() => { handleConvert(viewQuote.id); setViewQuote(null) }} className="gold-gradient text-black w-full">
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Convert to Sale
                    </Button>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </DashboardLayout>
    </AuthGuard>
  )
}
