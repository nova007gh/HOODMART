'use client'

import { useEffect, useMemo, useState } from 'react'
import { AuthGuard } from '@/components/auth-guard'
import { DashboardLayout } from '@/components/layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { store, Product, Discount, CartItem, computeTotals, money, Sale, Branch, formatDateTime } from '@/lib/store'
import { getSession, hasPermission, PERMISSIONS } from '@/lib/auth'
import { notifications, emailAdmin } from '@/lib/notifications'
import { Search, ShoppingCart, Plus, Minus, Trash2, CreditCard, Printer, X, Banknote, AlertTriangle, Image as ImageIcon, Calendar, Archive, FolderOpen, Building2, Mail, CheckCircle } from 'lucide-react'
import { POSAIAssistant } from '@/components/pos-ai-assistant'
import { CashierCard } from '@/components/cashier-card'
import { Pagination } from '@/components/pagination'
import toast from 'react-hot-toast'

export default function POSPage() {
  useEffect(() => {}, [])
  const [products, setProducts] = useState<Product[]>([])
  const [discounts, setDiscounts] = useState<Discount[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [search, setSearch] = useState('')
  const [discountId, setDiscountId] = useState('')
  const [showCart, setShowCart] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [newProduct, setNewProduct] = useState({ name: '', price: '', barcode: '' })
  const [receipt, setReceipt] = useState<Sale | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'mobile'>('cash')
  const [suspended, setSuspended] = useState(store.getSuspended())
  const [showSuspended, setShowSuspended] = useState(false)
  const [suspendName, setSuspendName] = useState('')
  const [branches, setBranches] = useState<Branch[]>([])
  const [branchId, setBranchId] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(60)
  const [canManageProducts, setCanManageProducts] = useState(false)
  const [salesTick, setSalesTick] = useState(0)

  const reload = () => { setProducts(store.getProducts()); setDiscounts(store.getDiscounts()); setBranches(store.getBranches()) }
  useEffect(() => { reload() }, [])
  useEffect(() => {
    setCanManageProducts(hasPermission(getSession()?.user ?? null, PERMISSIONS.MANAGE_PRODUCTS))
  }, [])
  useEffect(() => {
    const active = branches.find((b) => b.status === 'active')
    if (active && !branchId) setBranchId(active.id)
  }, [branches])

  const filtered = useMemo(() => {
    const term = search.toLowerCase()
    return products.filter((p) => String(p.name || '').toLowerCase().includes(term) || String(p.barcode || '').toLowerCase().includes(term))
  }, [products, search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filtered.slice(start, start + pageSize)
  }, [filtered, currentPage, pageSize])

  useEffect(() => { setPage(1) }, [search])

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === product.id)
      if (existing) return prev.map((i) => (i.id === product.id ? { ...i, qty: i.qty + 1 } : i))
      return [...prev, { ...product, qty: 1 }]
    })
  }

  const updateQty = (id: string, delta: number) => {
    setCart((prev) => prev.map((i) => (i.id === id ? { ...i, qty: i.qty + delta } : i)).filter((i) => i.qty > 0))
  }
  const removeItem = (id: string) => setCart((prev) => prev.filter((i) => i.id !== id))
  const totals = useMemo(() => computeTotals(cart, discountId), [cart, discountId])

  const daysUntil = (date?: string) => {
    if (!date) return Infinity
    const parsed = new Date(date)
    if (isNaN(parsed.getTime())) return Infinity
    // Sanity check: dates before year 2000 or after 2100 are almost certainly
    // data-entry errors (e.g. "0027-08-10" instead of "2027-08-10"). Treat
    // them as "no expiry" rather than marking the product as expired.
    const year = parsed.getFullYear()
    if (year < 2000 || year > 2100) return Infinity
    return Math.ceil((parsed.getTime() - new Date().setHours(0, 0, 0, 0)) / (1000 * 60 * 60 * 24))
  }

  const checkout = (withPrint: boolean = false) => {
    if (cart.length === 0) return toast.error('Cart is empty')
    const expired = cart.filter((i) => daysUntil(i.expiryDate) < 0)
    const expiring = cart.filter((i) => { const d = daysUntil(i.expiryDate); return d >= 0 && d <= 3 })
    // Warn about expired/expiring items but DO NOT block the sale — the
    // sales girl needs to process transactions smoothly.
    if (expired.length) toast(`${expired.length} item(s) in cart are past their expiry date.`, { icon: '⚠️' })
    if (expiring.length) toast(`${expiring.length} item(s) expire within 3 days.`, { icon: '⚠️' })
    const session = getSession()
    const sale: Sale = {
      id: Math.random().toString(36).slice(2) + Date.now().toString(36),
      items: cart.map((i) => ({ ...i })),
      discount: totals.discount,
      subtotal: totals.subtotal,
      total: totals.total,
      timestamp: new Date().toISOString(),
      paymentMethod,
      branchId: branchId || undefined,
      userEmail: session?.user.email,
      userName: session?.user.name,
    }
    store.addSale(sale)
    setCart([])
    setDiscountId('')
    reload()
    setSalesTick((t) => t + 1)

    // Log the activity so the admin sees it in their notification bell
    const itemCount = sale.items.reduce((a, i) => a + i.qty, 0)
    notifications.push(
      'sale',
      'Sale completed',
      `${itemCount} item${itemCount === 1 ? '' : 's'} sold via ${sale.paymentMethod} by ${session?.user.name || 'staff'}`,
      { amount: sale.total, href: `/receipt/${sale.id}` }
    )

    handleEmails(sale)

    if (withPrint) {
      setReceipt(sale)
    } else {
      toast.success(`Sale completed — ${money(sale.total)}`, { icon: '✅' })
    }
  }

  const receiptHtml = (s: Sale) => `
    <div style="font-family:monospace;max-width:300px;">
      <h2 style="text-align:center;margin:0;">HOODMART</h2>
      <p style="text-align:center;font-size:12px;color:#555;">${formatDateTime(s.timestamp)}<br>${s.paymentMethod}<br>Salesperson: ${s.userName || s.userEmail || 'N/A'}</p>
      <hr style="border:0;border-top:1px solid #000;"/>
      ${s.items.map((i) => `<div style="display:flex;justify-content:space-between;font-size:13px;"><span>${i.name} x${i.qty}</span><span>${money(i.price * i.qty)}</span></div>`).join('')}
      <hr style="border:0;border-top:1px solid #000;"/>
      <div style="font-size:13px;">Subtotal: ${money(s.subtotal)}</div>
      ${s.discount ? `<div style="font-size:13px;">Discount: -${money(s.discount)}</div>` : ''}
      <div style="font-size:14px;font-weight:bold;">Total: ${money(s.total)}</div>
    </div>
  `

  const dailyReportHtml = () => {
    const today = new Date().toISOString().slice(0, 10)
    const allSales = store.getSales().filter((s) => s.timestamp.startsWith(today))
    const revenue = allSales.reduce((sum, s) => sum + s.total, 0)
    const items = allSales.reduce((sum, s) => sum + s.items.reduce((a, i) => a + i.qty, 0), 0)
    return `
      <div style="font-family:monospace;max-width:400px;">
        <h2 style="text-align:center;">Daily Sales Report</h2>
        <p style="font-size:13px;">Date: ${today}</p>
        <p style="font-size:13px;">Transactions: ${allSales.length}</p>
        <p style="font-size:13px;">Items Sold: ${items}</p>
        <p style="font-size:13px;">Total Revenue: ${money(revenue)}</p>
      </div>
    `
  }

  const handleEmails = async (s: Sale) => {
    const send = (body: any) =>
      fetch('/api/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
        .then((r) => r.json())
        .catch(() => ({ ok: false, skipped: true }))

    if (customerEmail) {
      send({ to: customerEmail, subject: 'Your HOODMART Receipt', html: receiptHtml(s) }).then((data) => {
        if (data.ok) toast.success('Receipt emailed to customer')
        else if (data.error && data.error !== 'Email not configured') toast.error(data.error)
      })
    }

    // Admin activity email — only when the owner has enabled it in Settings
    let alertsOn = true
    try { alertsOn = localStorage.getItem('hoodmart_email_alerts') !== 'false' } catch {}
    if (!alertsOn) return

    const itemCount = s.items.reduce((a, i) => a + i.qty, 0)
    send({
      type: 'admin',
      subject: `New sale by ${s.userName || 'staff'} — ${money(s.total)}`,
      html: `
        <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;color:#18181b;">
          <div style="background:#18181b;padding:16px 20px;border-radius:8px 8px 0 0;">
            <h2 style="margin:0;color:#facc15;font-size:18px;">HOODMART · Sale Alert</h2>
          </div>
          <div style="border:1px solid #e4e4e7;border-top:0;padding:20px;border-radius:0 0 8px 8px;">
            <p style="margin:0 0 12px;font-size:14px;">
              <strong>${s.userName || s.userEmail || 'A staff member'}</strong> just completed a sale.
            </p>
            <table style="width:100%;font-size:13px;border-collapse:collapse;">
              <tr><td style="padding:4px 0;color:#71717a;">Total</td><td style="text-align:right;font-weight:bold;">${money(s.total)}</td></tr>
              <tr><td style="padding:4px 0;color:#71717a;">Items</td><td style="text-align:right;">${itemCount}</td></tr>
              <tr><td style="padding:4px 0;color:#71717a;">Payment</td><td style="text-align:right;text-transform:capitalize;">${s.paymentMethod}</td></tr>
              <tr><td style="padding:4px 0;color:#71717a;">Time</td><td style="text-align:right;">${formatDateTime(s.timestamp)}</td></tr>
            </table>
            <hr style="border:0;border-top:1px solid #e4e4e7;margin:16px 0;"/>
            ${s.items.map((i) => `<div style="display:flex;justify-content:space-between;font-size:12px;padding:3px 0;"><span>${i.name} &times;${i.qty}</span><span>${money(i.price * i.qty)}</span></div>`).join('')}
            <hr style="border:0;border-top:1px solid #e4e4e7;margin:16px 0;"/>
            ${dailyReportHtml()}
          </div>
        </div>
      `,
    })
  }

  const doSuspend = (nameOverride = suspendName) => {
    if (cart.length === 0) return toast.error('Cart is empty')
    const name = nameOverride.trim() || `Sale ${new Date().toLocaleTimeString()}`
    store.addSuspended({
      name,
      items: cart.map((i) => ({ ...i })),
      discountId,
      totals,
      timestamp: new Date().toISOString(),
    })
    setCart([])
    setDiscountId('')
    setSuspendName('')
    setSuspended(store.getSuspended())
    toast.success(`Suspended ${name}`)
  }

  const suspendSale = (e: React.FormEvent) => {
    e.preventDefault()
    doSuspend()
  }

  const resumeSale = (id: string) => {
    const s = suspended.find((x) => x.id === id)
    if (!s) return
    setCart(s.items)
    setDiscountId(s.discountId)
    store.deleteSuspended(id)
    setSuspended(store.getSuspended())
    setShowSuspended(false)
    toast.success(`Resumed ${s.name}`)
  }

  const deleteSuspended = (id: string) => {
    store.deleteSuspended(id)
    setSuspended(store.getSuspended())
    toast.success('Suspended sale removed')
  }

  const saveNewProduct = (e: React.FormEvent) => {
    e.preventDefault()
    const price = parseFloat(newProduct.price)
    if (!newProduct.name || isNaN(price) || price < 0) return
    store.addProduct({ name: newProduct.name, price, barcode: newProduct.barcode })
    setNewProduct({ name: '', price: '', barcode: '' })
    setShowAdd(false)
    reload()
    toast.success('Product added')
  }

  const printReceipt = () => {
    if (!receipt) return
    // Print directly from this page — no new tab. The @media print CSS
    // hides everything except .print-receipt-content when body.printing
    // is set. This avoids the page refresh / logout bug that happened
    // when window.open() loaded the receipt in a new tab.
    document.body.classList.add('printing')
    window.print()
    // Clean up after the print dialog closes
    const cleanup = () => {
      document.body.classList.remove('printing')
      window.removeEventListener('afterprint', cleanup)
    }
    window.addEventListener('afterprint', cleanup)
    // Fallback cleanup in case afterprint doesn't fire
    setTimeout(() => document.body.classList.remove('printing'), 1000)
  }

  return (
    <AuthGuard>
      <DashboardLayout>
        <div className="space-y-4">
          {/* Who is selling right now */}
          <CashierCard refreshKey={salesTick} />

          <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 min-w-0 space-y-4">
            <Card className="glass-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-white flex items-center justify-between gap-2">
                  <span>Products</span>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => setShowCart(true)} className="lg:hidden border-zinc-700 text-zinc-300 relative">
                      <ShoppingCart className="h-4 w-4" />
                      {cart.length > 0 && <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-yellow-500 text-black text-[10px] flex items-center justify-center font-bold">{cart.length}</span>}
                    </Button>
                    {canManageProducts && (
                      <Button size="sm" onClick={() => setShowAdd(!showAdd)} className="gold-gradient text-black">
                        {showAdd ? 'Cancel' : '+ Add'}
                      </Button>
                    )}
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {showAdd && canManageProducts && (
                  <form onSubmit={saveNewProduct} className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                    <input value={newProduct.name} onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })} placeholder="Name" required className="bg-zinc-950 border border-zinc-800 text-white rounded p-2 text-sm" />
                    <input value={newProduct.price} onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })} placeholder="Price" type="number" step="0.01" min="0" required className="bg-zinc-950 border border-zinc-800 text-white rounded p-2 text-sm" />
                    <input value={newProduct.barcode} onChange={(e) => setNewProduct({ ...newProduct, barcode: e.target.value })} placeholder="Barcode" className="bg-zinc-950 border border-zinc-800 text-white rounded p-2 text-sm" />
                    <Button type="submit" className="gold-gradient text-black">Save</Button>
                  </form>
                )}
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-zinc-500" />
                  <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search or scan barcode..." className="w-full pl-10 bg-zinc-950 border border-zinc-800 text-white rounded-lg p-2 text-sm" autoFocus />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 sm:gap-3">
                  {paginated.map((p) => {
                    const expiryDays = daysUntil(p.expiryDate)
                    const expired = expiryDays !== Infinity && expiryDays < 0
                    const expiringSoon = expiryDays >= 0 && expiryDays <= 3
                    return (
                      <button key={p.id} onClick={() => addToCart(p)} className={`text-left rounded-lg bg-zinc-900 border overflow-hidden hover:shadow-lg transition-all ${expired ? 'border-red-500/60' : expiringSoon ? 'border-yellow-500/60' : 'border-zinc-700 hover:border-yellow-500/60 hover:shadow-yellow-500/10'}`}>
                        <div className="h-16 sm:h-20 bg-zinc-950 flex items-center justify-center border-b border-zinc-800">
                          {p.image ? <img src={p.image} alt={p.name} className="h-full w-full object-cover" /> : <ImageIcon className="h-6 w-6 sm:h-8 sm:w-8 text-zinc-600" />}
                        </div>
                        <div className="p-2 sm:p-3">
                          <p className="font-semibold text-zinc-100 text-xs sm:text-sm truncate">{p.name}</p>
                          <p className="text-xs sm:text-sm text-zinc-400">{money(p.price)}</p>
                          {expired && <p className="text-xs text-red-400 mt-1 flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Expired</p>}
                          {expiringSoon && !expired && <p className="text-xs text-yellow-400 mt-1 flex items-center gap-1"><Calendar className="h-3 w-3" /> {expiryDays}d left</p>}
                        </div>
                      </button>
                    )
                  })}
                  {paginated.length === 0 && <p className="col-span-full text-zinc-500 text-sm">No products found.</p>}
                </div>
                {filtered.length > 0 && (
                  <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    totalItems={filtered.length}
                    pageSize={pageSize}
                    onPageChange={setPage}
                    onPageSizeChange={(s) => { setPageSize(s); setPage(1) }}
                    pageSizeOptions={[30, 60, 120]}
                  />
                )}
              </CardContent>
            </Card>
          </div>

          <div className="w-full lg:w-96 hidden lg:block">
            <Card className="glass-card lg:sticky lg:top-4">
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <CardTitle className="text-white flex items-center gap-2"><ShoppingCart className="h-5 w-5 text-yellow-500" /> Cart</CardTitle>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => doSuspend()} disabled={cart.length === 0} className="border-zinc-700 text-zinc-300 hover:bg-zinc-800">
                    <Archive className="h-4 w-4 mr-1" /> Suspend
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setShowSuspended(true)} className="border-zinc-700 text-zinc-300 hover:bg-zinc-800">
                    <FolderOpen className="h-4 w-4 mr-1" /> Resume {suspended.length > 0 && <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 text-xs">{suspended.length}</span>}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {cart.length === 0 ? <p className="text-zinc-500 text-sm">Cart is empty</p> : (
                  <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                    {cart.map((item) => (
                      <div key={item.id} className="flex items-center justify-between p-2 rounded bg-zinc-900/60 border border-zinc-800">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{item.name}</p>
                          <p className="text-xs text-zinc-400">{money(item.price)}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => updateQty(item.id, -1)} className="p-1 rounded bg-zinc-800 hover:bg-zinc-700"><Minus className="h-3 w-3" /></button>
                          <span className="w-6 text-center text-sm font-bold">{item.qty}</span>
                          <button onClick={() => updateQty(item.id, 1)} className="p-1 rounded bg-zinc-800 hover:bg-zinc-700"><Plus className="h-3 w-3" /></button>
                          <button onClick={() => removeItem(item.id)} className="p-1 rounded bg-red-900/30 text-red-400 hover:bg-red-900/50"><Trash2 className="h-3 w-3" /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-xs text-zinc-400">Discount</label>
                  <select value={discountId} onChange={(e) => setDiscountId(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 text-white rounded p-2 text-sm">
                    <option value="">No discount</option>
                    {discounts.map((d) => <option key={d.id} value={d.id}>{d.name} ({d.type === 'percent' ? `${d.value}%` : money(d.value)})</option>)}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs text-zinc-400">Payment</label>
                  <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as 'cash' | 'card' | 'mobile')} className="w-full bg-zinc-950 border border-zinc-800 text-white rounded p-2 text-sm">
                    <option value="cash">Cash</option>
                    <option value="card">Card</option>
                    <option value="mobile">Mobile Money</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs text-zinc-400 flex items-center gap-1"><Building2 className="h-3 w-3" /> Branch</label>
                  <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 text-white rounded p-2 text-sm">
                    <option value="">No branch</option>
                    {branches.filter((b) => b.status === 'active').map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs text-zinc-400 flex items-center gap-1"><Mail className="h-3 w-3" /> Customer Email</label>
                  <input type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} placeholder="receipt@example.com" className="w-full bg-zinc-950 border border-zinc-800 text-white rounded p-2 text-sm" />
                </div>

                <div className="space-y-1 text-sm text-zinc-400 border-t border-zinc-800 pt-3">
                  <div className="flex justify-between"><span>Subtotal</span><span>{money(totals.subtotal)}</span></div>
                  <div className="flex justify-between"><span>Discount</span><span className="text-yellow-500">-{money(totals.discount)}</span></div>
                </div>
                <div className="flex justify-between items-center text-lg font-bold text-white border-t border-zinc-800 pt-3">
                  <span>Total</span>
                  <span className="gold-text">{money(totals.total)}</span>
                </div>

                <div className="flex gap-2">
                  <Button onClick={() => checkout(false)} className="flex-1 gold-gradient text-black font-bold" disabled={cart.length === 0}>
                    <CreditCard className="h-4 w-4 mr-2" /> Checkout
                  </Button>
                  <Button onClick={() => checkout(true)} variant="outline" className="flex-1 border-yellow-500/40 text-yellow-500 hover:bg-yellow-500/10 font-bold" disabled={cart.length === 0}>
                    <Printer className="h-4 w-4 mr-2" /> Checkout & Print
                  </Button>
                </div>

                {cart.length > 0 && (
                  <form onSubmit={suspendSale} className="space-y-2 border-t border-zinc-800 pt-3">
                    <label className="text-xs text-zinc-400">Sale narrative (optional)</label>
                    <input value={suspendName} onChange={(e) => setSuspendName(e.target.value)} placeholder="e.g. Customer will be back" className="w-full bg-zinc-950 border border-zinc-800 text-white rounded p-2 text-sm" />
                    <Button type="submit" variant="outline" className="w-full border-zinc-700 text-zinc-300 hover:bg-zinc-800">
                      <Archive className="h-4 w-4 mr-2" /> Suspend Sale
                    </Button>
                  </form>
                )}
              </CardContent>
            </Card>
          </div>
          </div>
        </div>

        {/* Mobile cart bottom sheet */}
        {showCart && (
          <div className="fixed inset-0 z-50 lg:hidden no-print">
            <div className="absolute inset-0 bg-black/70" onClick={() => setShowCart(false)} />
            <div className="absolute bottom-0 left-0 right-0 max-h-[85vh] bg-zinc-900 border-t border-zinc-800 rounded-t-2xl flex flex-col">
              <div className="flex items-center justify-between p-4 border-b border-zinc-800 shrink-0">
                <CardTitle className="text-white flex items-center gap-2 text-base"><ShoppingCart className="h-5 w-5 text-yellow-500" /> Cart ({cart.length})</CardTitle>
                <button onClick={() => setShowCart(false)} className="text-zinc-400 hover:text-white"><X className="h-5 w-5" /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {cart.length === 0 ? <p className="text-zinc-500 text-sm">Cart is empty</p> : (
                  <div className="space-y-2">
                    {cart.map((item) => (
                      <div key={item.id} className="flex items-center justify-between p-2 rounded bg-zinc-950/60 border border-zinc-800">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate text-white">{item.name}</p>
                          <p className="text-xs text-zinc-400">{money(item.price)}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => updateQty(item.id, -1)} className="p-1 rounded bg-zinc-800 hover:bg-zinc-700"><Minus className="h-3 w-3" /></button>
                          <span className="w-6 text-center text-sm font-bold text-white">{item.qty}</span>
                          <button onClick={() => updateQty(item.id, 1)} className="p-1 rounded bg-zinc-800 hover:bg-zinc-700"><Plus className="h-3 w-3" /></button>
                          <button onClick={() => removeItem(item.id)} className="p-1 rounded bg-red-900/30 text-red-400 hover:bg-red-900/50"><Trash2 className="h-3 w-3" /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="space-y-2">
                  <label className="text-xs text-zinc-400">Discount</label>
                  <select value={discountId} onChange={(e) => setDiscountId(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 text-white rounded p-2 text-sm">
                    <option value="">No discount</option>
                    {discounts.map((d) => <option key={d.id} value={d.id}>{d.name} ({d.type === 'percent' ? `${d.value}%` : money(d.value)})</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs text-zinc-400">Payment</label>
                  <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as 'cash' | 'card' | 'mobile')} className="w-full bg-zinc-950 border border-zinc-800 text-white rounded p-2 text-sm">
                    <option value="cash">Cash</option>
                    <option value="card">Card</option>
                    <option value="mobile">Mobile Money</option>
                  </select>
                </div>
                <div className="space-y-1 text-sm text-zinc-400 border-t border-zinc-800 pt-3">
                  <div className="flex justify-between"><span>Subtotal</span><span>{money(totals.subtotal)}</span></div>
                  <div className="flex justify-between"><span>Discount</span><span className="text-yellow-500">-{money(totals.discount)}</span></div>
                </div>
                <div className="flex justify-between items-center text-lg font-bold text-white border-t border-zinc-800 pt-3">
                  <span>Total</span>
                  <span className="gold-text">{money(totals.total)}</span>
                </div>
                <div className="flex gap-2 pb-2">
                  <Button variant="outline" onClick={() => doSuspend()} disabled={cart.length === 0} className="flex-1 border-zinc-700 text-zinc-300 hover:bg-zinc-800">
                    <Archive className="h-4 w-4 mr-1" /> Suspend
                  </Button>
                  <Button variant="outline" onClick={() => { setShowCart(false); setShowSuspended(true) }} className="flex-1 border-zinc-700 text-zinc-300 hover:bg-zinc-800">
                    <FolderOpen className="h-4 w-4 mr-1" /> Resume
                  </Button>
                </div>
                <div className="flex gap-2 pb-2">
                  <Button onClick={() => { checkout(false); setShowCart(false) }} className="flex-1 gold-gradient text-black font-bold" disabled={cart.length === 0}>
                    <CreditCard className="h-4 w-4 mr-2" /> Checkout
                  </Button>
                  <Button onClick={() => { checkout(true); setShowCart(false) }} variant="outline" className="flex-1 border-yellow-500/40 text-yellow-500 hover:bg-yellow-500/10 font-bold" disabled={cart.length === 0}>
                    <Printer className="h-4 w-4 mr-2" /> & Print
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {showSuspended && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 no-print">
            <Card className="w-full max-w-md glass-card">
              <CardHeader className="flex flex-row items-center justify-between border-b border-zinc-800">
                <CardTitle className="text-white flex items-center gap-2"><FolderOpen className="h-5 w-5 text-yellow-500" /> Suspended Sales</CardTitle>
                <button onClick={() => setShowSuspended(false)} className="text-zinc-400 hover:text-white"><X className="h-5 w-5" /></button>
              </CardHeader>
              <CardContent className="p-4 space-y-3 max-h-[60vh] overflow-y-auto">
                {suspended.length === 0 && <p className="text-zinc-500 text-sm">No suspended sales.</p>}
                {suspended.map((s) => (
                  <div key={s.id} className="p-3 rounded bg-zinc-900/60 border border-zinc-800 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate text-white">{s.name}</p>
                      <p className="text-xs text-zinc-500">{s.items.length} item(s) · {money(s.totals.total)}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => resumeSale(s.id)} className="gold-gradient text-black text-xs">Resume</Button>
                      <Button size="sm" variant="outline" onClick={() => deleteSuspended(s.id)} className="border-red-500/40 text-red-400 hover:bg-red-900/20 p-1.5"><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        )}

        {receipt && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 no-print print-receipt-overlay">
            <Card className="w-full max-w-md bg-white text-black">
              <CardHeader className="flex flex-row items-center justify-between no-print">
                <CardTitle className="text-black text-lg font-bold flex items-center gap-2"><CheckCircle className="h-5 w-5 text-green-600" /> Sale Completed</CardTitle>
                <button onClick={() => setReceipt(null)} className="text-zinc-500 hover:text-black"><X className="h-5 w-5" /></button>
              </CardHeader>
              <CardContent className="space-y-3 print-receipt-content">
                <div className="text-center border-b border-zinc-300 pb-3">
                  <p className="font-bold text-lg">HOODMART</p>
                  <p className="text-xs text-zinc-500">{new Date(receipt.timestamp).toLocaleString()}</p>
                  <p className="text-xs text-zinc-500 uppercase">{receipt.paymentMethod}</p>
                  <p className="text-xs text-zinc-500">Served by: {receipt.userName || receipt.userEmail || 'Unknown'}</p>
                </div>
                <div className="space-y-1 text-sm">
                  {receipt.items.map((item) => (
                    <div key={item.id} className="flex justify-between">
                      <span>{item.name} x{item.qty}</span>
                      <span>{money(item.price * item.qty)}</span>
                    </div>
                  ))}
                </div>
                <div className="border-t border-zinc-300 pt-2 space-y-1 text-sm">
                  <div className="flex justify-between"><span>Subtotal</span><span>{money(receipt.subtotal)}</span></div>
                  {receipt.discount > 0 && <div className="flex justify-between"><span>Discount</span><span>-{money(receipt.discount)}</span></div>}
                  <div className="flex justify-between text-lg font-bold"><span>Total</span><span>{money(receipt.total)}</span></div>
                </div>
                <p className="text-center text-xs mt-4 text-zinc-500">Thank you for shopping with us!</p>
                <div className="flex gap-2 no-print pt-2 border-t border-zinc-300">
                  <Button onClick={printReceipt} className="flex-1 bg-zinc-900 text-white hover:bg-zinc-800"><Printer className="h-4 w-4 mr-2" /> Print Receipt</Button>
                  <Button onClick={() => setReceipt(null)} className="flex-1 gold-gradient text-black font-bold"><ShoppingCart className="h-4 w-4 mr-2" /> New Sale</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <POSAIAssistant />
      </DashboardLayout>
    </AuthGuard>
  )
}
