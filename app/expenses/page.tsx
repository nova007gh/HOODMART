'use client'

import { useEffect, useState } from 'react'
import { AuthGuard } from '@/components/auth-guard'
import { DashboardLayout } from '@/components/layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { store, Expense, money, formatDate } from '@/lib/store'
import { notifications } from '@/lib/notifications'
import { Receipt, Plus, Search, Trash2, X } from 'lucide-react'
import toast from 'react-hot-toast'

const CATEGORIES = ['Rent', 'Utilities', 'Salaries', 'Inventory', 'Marketing', 'Transport', 'Maintenance', 'Supplies', 'Taxes', 'Other']

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [filterCat, setFilterCat] = useState('')
  const [newExpense, setNewExpense] = useState({ description: '', amount: '', category: 'Other', date: new Date().toISOString().slice(0, 10), paymentMethod: 'cash', vendor: '', notes: '' })

  const reload = () => setExpenses(store.getExpenses())
  useEffect(() => { reload() }, [])

  const filtered = expenses.filter((e) => {
    const matchSearch = e.description.toLowerCase().includes(search.toLowerCase()) || (e.vendor || '').toLowerCase().includes(search.toLowerCase())
    const matchCat = !filterCat || e.category === filterCat
    return matchSearch && matchCat
  })

  const totalThisMonth = expenses.filter((e) => {
    const d = new Date(e.date)
    const now = new Date()
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  }).reduce((sum, e) => sum + e.amount, 0)

  const totalAll = expenses.reduce((sum, e) => sum + e.amount, 0)

  const byCategory = CATEGORIES.map((cat) => ({
    cat,
    total: expenses.filter((e) => e.category === cat).reduce((sum, e) => sum + e.amount, 0),
  })).filter((x) => x.total > 0).sort((a, b) => b.total - a.total)

  const handleCreate = () => {
    const amount = parseFloat(newExpense.amount)
    if (!amount || amount <= 0) { toast.error('Enter a valid amount'); return }
    if (!newExpense.description) { toast.error('Enter a description'); return }
    store.addExpense({
      description: newExpense.description,
      amount,
      category: newExpense.category,
      date: newExpense.date,
      paymentMethod: newExpense.paymentMethod as any,
      vendor: newExpense.vendor || undefined,
      notes: newExpense.notes || undefined,
    })
    notifications.push(
      'expense',
      'Expense recorded',
      `${newExpense.description} (${newExpense.category})`,
      { amount, href: '/expenses' }
    )
    toast.success('Expense recorded')
    setNewExpense({ description: '', amount: '', category: 'Other', date: new Date().toISOString().slice(0, 10), paymentMethod: 'cash', vendor: '', notes: '' })
    setShowAdd(false)
    reload()
  }

  const handleDelete = (id: string) => {
    if (!confirm('Delete this expense?')) return
    store.deleteExpense(id)
    toast.success('Expense deleted')
    reload()
  }

  return (
    <AuthGuard>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                <Receipt className="h-6 w-6 text-yellow-500" />
                Expenses
              </h1>
              <p className="text-zinc-400 text-sm mt-1">Track and manage store expenses</p>
            </div>
            <Button onClick={() => setShowAdd(!showAdd)} className="gold-gradient text-black">
              <Plus className="h-4 w-4 mr-2" />
              Add Expense
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="glass-card border-zinc-700/50">
              <CardContent className="pt-6">
                <p className="text-sm text-zinc-400">This Month</p>
                <p className="text-2xl font-bold text-yellow-500">{money(totalThisMonth)}</p>
              </CardContent>
            </Card>
            <Card className="glass-card border-zinc-700/50">
              <CardContent className="pt-6">
                <p className="text-sm text-zinc-400">All Time</p>
                <p className="text-2xl font-bold text-white">{money(totalAll)}</p>
              </CardContent>
            </Card>
            <Card className="glass-card border-zinc-700/50">
              <CardContent className="pt-6">
                <p className="text-sm text-zinc-400">Total Entries</p>
                <p className="text-2xl font-bold text-white">{expenses.length}</p>
              </CardContent>
            </Card>
          </div>

          {byCategory.length > 0 && (
            <Card className="glass-card border-zinc-700/50">
              <CardHeader>
                <CardTitle className="text-white text-lg">By Category</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {byCategory.map(({ cat, total }) => (
                    <div key={cat} className="flex items-center justify-between">
                      <span className="text-zinc-300">{cat}</span>
                      <span className="text-white font-semibold">{money(total)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {showAdd && (
            <Card className="glass-card border-zinc-700/50">
              <CardHeader>
                <CardTitle className="text-white">Add New Expense</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <Label className="text-zinc-300">Description</Label>
                    <Input value={newExpense.description} onChange={(e) => setNewExpense({ ...newExpense, description: e.target.value })} placeholder="Electricity bill" className="bg-zinc-800 border-zinc-700 text-white" />
                  </div>
                  <div>
                    <Label className="text-zinc-300">Amount (GH₵)</Label>
                    <Input type="number" value={newExpense.amount} onChange={(e) => setNewExpense({ ...newExpense, amount: e.target.value })} placeholder="100.00" className="bg-zinc-800 border-zinc-700 text-white" />
                  </div>
                  <div>
                    <Label className="text-zinc-300">Category</Label>
                    <select value={newExpense.category} onChange={(e) => setNewExpense({ ...newExpense, category: e.target.value })} className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-md px-3 py-2">
                      {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <Label className="text-zinc-300">Date</Label>
                    <Input type="date" value={newExpense.date} onChange={(e) => setNewExpense({ ...newExpense, date: e.target.value })} className="bg-zinc-800 border-zinc-700 text-white" />
                  </div>
                  <div>
                    <Label className="text-zinc-300">Payment Method</Label>
                    <select value={newExpense.paymentMethod} onChange={(e) => setNewExpense({ ...newExpense, paymentMethod: e.target.value })} className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-md px-3 py-2">
                      <option value="cash">Cash</option>
                      <option value="card">Card</option>
                      <option value="mobile">Mobile Money</option>
                    </select>
                  </div>
                  <div>
                    <Label className="text-zinc-300">Vendor</Label>
                    <Input value={newExpense.vendor} onChange={(e) => setNewExpense({ ...newExpense, vendor: e.target.value })} placeholder="ECG" className="bg-zinc-800 border-zinc-700 text-white" />
                  </div>
                  <div className="sm:col-span-2">
                    <Label className="text-zinc-300">Notes</Label>
                    <Input value={newExpense.notes} onChange={(e) => setNewExpense({ ...newExpense, notes: e.target.value })} placeholder="Optional" className="bg-zinc-800 border-zinc-700 text-white" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleCreate} className="gold-gradient text-black">Save Expense</Button>
                  <Button onClick={() => setShowAdd(false)} variant="outline" className="border-zinc-700 text-zinc-300">Cancel</Button>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-zinc-500" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search expenses..." className="bg-zinc-800 border-zinc-700 text-white max-w-xs" />
            </div>
            <select value={filterCat} onChange={(e) => setFilterCat(e.target.value)} className="bg-zinc-800 border border-zinc-700 text-white rounded-md px-3 py-2 text-sm">
              <option value="">All Categories</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <Card className="glass-card border-zinc-700/50">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-zinc-800">
                    <tr className="text-left text-zinc-400">
                      <th className="p-3">Date</th>
                      <th className="p-3">Description</th>
                      <th className="p-3">Category</th>
                      <th className="p-3">Vendor</th>
                      <th className="p-3">Payment</th>
                      <th className="p-3">Amount</th>
                      <th className="p-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 ? (
                      <tr><td colSpan={7} className="p-8 text-center text-zinc-500">No expenses recorded yet.</td></tr>
                    ) : filtered.map((e) => (
                      <tr key={e.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                        <td className="p-3 text-zinc-400">{formatDate(e.date)}</td>
                        <td className="p-3 text-white">{e.description}</td>
                        <td className="p-3"><span className="px-2 py-1 rounded text-xs bg-zinc-700/50 text-zinc-300">{e.category}</span></td>
                        <td className="p-3 text-zinc-400">{e.vendor || '—'}</td>
                        <td className="p-3 text-zinc-400">{e.paymentMethod || '—'}</td>
                        <td className="p-3 text-red-400 font-semibold">{money(e.amount)}</td>
                        <td className="p-3">
                          <button onClick={() => handleDelete(e.id)} className="p-1 text-red-400 hover:text-red-300">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    </AuthGuard>
  )
}
