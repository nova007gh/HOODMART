'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { AuthGuard } from '@/components/auth-guard'
import { DashboardLayout } from '@/components/layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { store, Product, money } from '@/lib/store'
import { Search, Package, Plus, X, Camera, Calendar, AlertTriangle, Edit2, Trash2, Save, Image as ImageIcon } from 'lucide-react'
import toast from 'react-hot-toast'

type ProductForm = {
  name: string
  price: string
  cost: string
  barcode: string
  stock: string
  minStock: string
  unit: string
  category: string
  supplier: string
  expiryDate: string
  description: string
  image: string
}

const emptyForm: ProductForm = {
  name: '',
  price: '',
  cost: '',
  barcode: '',
  stock: '',
  minStock: '',
  unit: '',
  category: '',
  supplier: '',
  expiryDate: '',
  description: '',
  image: '',
}

function toNum(v: string) {
  const n = parseFloat(v)
  return isNaN(n) ? undefined : n
}

function daysUntil(date?: string) {
  if (!date) return Infinity
  const diff = new Date(date).getTime() - new Date().setHours(0, 0, 0, 0)
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

function expiryStatus(p: Product) {
  const d = daysUntil(p.expiryDate)
  if (d === Infinity) return null
  if (d < 0) return { text: 'Expired', class: 'bg-red-500/20 text-red-400 border-red-500/30' }
  if (d <= 7) return { text: `Expires in ${d} day${d === 1 ? '' : 's'}`, class: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' }
  return { text: `Expires in ${d} days`, class: 'bg-zinc-800 text-zinc-400 border-zinc-700' }
}

export default function ProductsPage() {
  useEffect(() => {}, [])
  const [products, setProducts] = useState<Product[]>([])
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [form, setForm] = useState<ProductForm>(emptyForm)
  const fileRef = useRef<HTMLInputElement>(null)

  const reload = () => setProducts(store.getProducts())
  useEffect(() => { reload() }, [])

  useEffect(() => {
    const expiring = products.filter((p) => { const d = daysUntil(p.expiryDate); return d >= 0 && d <= 3 })
    if (expiring.length) {
      toast(`${expiring.length} product${expiring.length === 1 ? '' : 's'} expiring within 3 days`, { icon: '⚠️' })
    }
  }, [products])

  const filtered = useMemo(() => {
    const term = search.toLowerCase()
    return products.filter((p) =>
      p.name.toLowerCase().includes(term) ||
      (p.barcode || '').toLowerCase().includes(term) ||
      (p.category || '').toLowerCase().includes(term) ||
      (p.supplier || '').toLowerCase().includes(term)
    )
  }, [products, search])

  const lowStock = (p: Product) => (p.stock ?? 0) < (p.minStock ?? 0)

  const startAdd = () => { setEditing(null); setForm(emptyForm); setOpen(true) }
  const startEdit = (p: Product) => {
    setEditing(p)
    setForm({
      name: p.name,
      price: p.price.toString(),
      cost: p.cost?.toString() ?? '',
      barcode: p.barcode ?? '',
      stock: p.stock?.toString() ?? '',
      minStock: p.minStock?.toString() ?? '',
      unit: p.unit ?? '',
      category: p.category ?? '',
      supplier: p.supplier ?? '',
      expiryDate: p.expiryDate ?? '',
      description: p.description ?? '',
      image: p.image ?? '',
    })
    setOpen(true)
  }

  const onImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 1024 * 1024) {
      toast.error('Image too large. Use a file under 1MB.')
      return
    }
    const reader = new FileReader()
    reader.onload = (ev) => setForm((f) => ({ ...f, image: ev.target?.result as string }))
    reader.readAsDataURL(file)
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name || !form.price) return toast.error('Name and price are required')
    const payload: Omit<Product, 'id'> = {
      name: form.name,
      price: toNum(form.price)!,
      cost: toNum(form.cost),
      barcode: form.barcode,
      stock: toNum(form.stock),
      minStock: toNum(form.minStock),
      unit: form.unit,
      category: form.category,
      supplier: form.supplier,
      expiryDate: form.expiryDate,
      description: form.description,
      image: form.image,
    }
    if (editing) {
      store.updateProduct(editing.id, payload)
      toast.success('Product updated')
    } else {
      store.addProduct(payload)
      toast.success('Product added')
    }
    reload()
    setOpen(false)
    setEditing(null)
    setForm(emptyForm)
  }

  const remove = (id: string) => {
    if (!confirm('Delete this product?')) return
    store.deleteProduct(id)
    reload()
    toast.success('Product deleted')
  }

  return (
    <AuthGuard>
      <DashboardLayout>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-white">Products</h1>
            <p className="text-zinc-400">Manage inventory, images, pricing and expiry dates.</p>
          </div>
          <Button onClick={startAdd} className="gold-gradient text-black font-bold">
            <Plus className="h-4 w-4 mr-2" /> Add Product
          </Button>
        </div>

        <Card className="glass-card mb-6">
          <CardContent className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-zinc-500" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, barcode, category or supplier..."
                className="w-full pl-10"
              />
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((p) => {
            const exp = expiryStatus(p)
            return (
              <Card key={p.id} className="glass-card overflow-hidden flex flex-col">
                <div className="h-36 bg-zinc-900 flex items-center justify-center overflow-hidden border-b border-zinc-800">
                  {p.image ? (
                    <img src={p.image} alt={p.name} className="h-full w-full object-cover" />
                  ) : (
                    <ImageIcon className="h-12 w-12 text-zinc-600" />
                  )}
                </div>
                <CardContent className="p-4 flex-1 flex flex-col">
                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h3 className="font-semibold text-white truncate">{p.name}</h3>
                      {lowStock(p) && <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" aria-label="Low stock" />}
                    </div>
                    <p className="text-xs text-zinc-400 mb-2">{p.category || 'No category'}</p>
                    <div className="flex flex-wrap gap-2 text-xs mb-3">
                      <span className="px-2 py-1 rounded bg-zinc-900 border border-zinc-700 text-zinc-300">{money(p.price)}</span>
                      <span className="px-2 py-1 rounded bg-zinc-900 border border-zinc-700 text-zinc-300">Stock: {p.stock ?? 0} {p.unit}</span>
                    </div>
                    {exp && <span className={`text-xs px-2 py-1 rounded border ${exp.class}`}>{exp.text}</span>}
                  </div>
                  <div className="flex gap-2 mt-4">
                    <Button size="sm" variant="outline" onClick={() => startEdit(p)} className="flex-1 border-zinc-700 text-zinc-300 hover:bg-zinc-800">
                      <Edit2 className="h-3 w-3 mr-1" /> Edit
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => remove(p.id)} className="border-red-500/40 text-red-400 hover:bg-red-900/20">
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
          {filtered.length === 0 && <p className="col-span-full text-zinc-500">No products found.</p>}
        </div>

        {open && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
            <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto glass-card">
              <CardHeader className="flex flex-row items-center justify-between sticky top-0 bg-zinc-900/95 backdrop-blur border-b border-zinc-800 z-10">
                <CardTitle className="text-white text-xl">{editing ? 'Edit Product' : 'Add Product'}</CardTitle>
                <button onClick={() => setOpen(false)} className="text-zinc-400 hover:text-white"><X className="h-5 w-5" /></button>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                <form onSubmit={submit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1"><label className="text-xs text-zinc-400">Product Name *</label><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Name" /></div>
                    <div className="space-y-1"><label className="text-xs text-zinc-400">Barcode</label><input value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} placeholder="Barcode / SKU" /></div>
                    <div className="space-y-1"><label className="text-xs text-zinc-400">Selling Price *</label><input required type="number" step="0.01" min="0" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="0.00" /></div>
                    <div className="space-y-1"><label className="text-xs text-zinc-400">Cost Price</label><input type="number" step="0.01" min="0" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} placeholder="0.00" /></div>
                    <div className="space-y-1"><label className="text-xs text-zinc-400">Stock</label><input type="number" min="0" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} placeholder="0" /></div>
                    <div className="space-y-1"><label className="text-xs text-zinc-400">Min Stock</label><input type="number" min="0" value={form.minStock} onChange={(e) => setForm({ ...form, minStock: e.target.value })} placeholder="0" /></div>
                    <div className="space-y-1"><label className="text-xs text-zinc-400">Unit</label><input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="pcs / kg / L" /></div>
                    <div className="space-y-1"><label className="text-xs text-zinc-400">Category</label><input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Category" /></div>
                    <div className="space-y-1"><label className="text-xs text-zinc-400">Supplier</label><input value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} placeholder="Supplier" /></div>
                    <div className="space-y-1"><label className="text-xs text-zinc-400">Expiry Date</label><input type="date" value={form.expiryDate} onChange={(e) => setForm({ ...form, expiryDate: e.target.value })} /></div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs text-zinc-400">Description / Inspiration</label>
                    <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Notes, inspiration, or product story..." rows={3} />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs text-zinc-400">Product Image</label>
                    <div className="flex items-center gap-4">
                      <div className="h-20 w-20 rounded-lg bg-zinc-900 border border-zinc-700 flex items-center justify-center overflow-hidden">
                        {form.image ? <img src={form.image} alt="preview" className="h-full w-full object-cover" /> : <Camera className="h-8 w-8 text-zinc-600" />}
                      </div>
                      <div className="flex-1">
                        <input ref={fileRef} type="file" accept="image/*" onChange={onImage} className="hidden" />
                        <Button type="button" onClick={() => fileRef.current?.click()} variant="outline" className="border-zinc-700 text-zinc-300 hover:bg-zinc-800">
                          <Camera className="h-4 w-4 mr-2" /> Upload Image
                        </Button>
                        <p className="text-xs text-zinc-500 mt-1">Max 1MB. Stored locally.</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <Button type="submit" className="flex-1 gold-gradient text-black font-bold"><Save className="h-4 w-4 mr-2" /> {editing ? 'Update Product' : 'Save Product'}</Button>
                    <Button type="button" onClick={() => setOpen(false)} variant="outline" className="border-zinc-700 text-zinc-300 hover:bg-zinc-800">Cancel</Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        )}
      </DashboardLayout>
    </AuthGuard>
  )
}
