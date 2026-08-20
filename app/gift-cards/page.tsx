'use client'

import { useEffect, useState } from 'react'
import { AuthGuard } from '@/components/auth-guard'
import { DashboardLayout } from '@/components/layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { store, GiftCard, money, formatDateTime } from '@/lib/store'
import { pullTable } from '@/lib/fresh-data'
import { Gift, Plus, Search, Trash2, PlusCircle, CheckCircle, X } from 'lucide-react'
import toast from 'react-hot-toast'

export default function GiftCardsPage() {
  const [giftCards, setGiftCards] = useState<GiftCard[]>([])
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [topUpId, setTopUpId] = useState<string | null>(null)
  const [topUpAmount, setTopUpAmount] = useState('')
  const [redeemId, setRedeemId] = useState<string | null>(null)
  const [redeemAmount, setRedeemAmount] = useState('')
  const [newCard, setNewCard] = useState({ initialBalance: '', customerName: '', customerEmail: '', expiryDate: '', notes: '' })

  const reload = () => setGiftCards([...store.getGiftCards()])
  useEffect(() => { reload(); pullTable('gift_cards').then(reload) }, [])

  const filtered = giftCards.filter((gc) =>
    gc.code.toLowerCase().includes(search.toLowerCase()) ||
    (gc.customerName || '').toLowerCase().includes(search.toLowerCase())
  )

  const totalActive = giftCards.filter((g) => g.status === 'active').length
  const totalBalance = giftCards.filter((g) => g.status === 'active').reduce((sum, g) => sum + g.balance, 0)
  const totalIssued = giftCards.reduce((sum, g) => sum + g.initialBalance, 0)

  const handleCreate = () => {
    const balance = parseFloat(newCard.initialBalance)
    if (!balance || balance <= 0) { toast.error('Enter a valid amount'); return }
    const gc = store.addGiftCard({
      balance,
      initialBalance: balance,
      status: 'active',
      customerName: newCard.customerName || undefined,
      customerEmail: newCard.customerEmail || undefined,
      expiryDate: newCard.expiryDate || undefined,
      notes: newCard.notes || undefined,
    })
    toast.success(`Gift card ${gc.code} created!`)
    setNewCard({ initialBalance: '', customerName: '', customerEmail: '', expiryDate: '', notes: '' })
    setShowAdd(false)
    reload()
  }

  const handleTopUp = () => {
    const amount = parseFloat(topUpAmount)
    if (!amount || amount <= 0) { toast.error('Enter a valid amount'); return }
    store.topUpGiftCard(topUpId!, amount)
    toast.success('Gift card topped up!')
    setTopUpId(null)
    setTopUpAmount('')
    reload()
  }

  const handleRedeem = () => {
    const amount = parseFloat(redeemAmount)
    if (!amount || amount <= 0) { toast.error('Enter a valid amount'); return }
    const ok = store.redeemGiftCard(redeemId!, amount)
    if (ok) {
      toast.success('Gift card redeemed!')
    } else {
      toast.error('Insufficient balance or card not active')
    }
    setRedeemId(null)
    setRedeemAmount('')
    reload()
  }

  const handleDelete = (id: string) => {
    if (!confirm('Delete this gift card?')) return
    store.deleteGiftCard(id)
    toast.success('Gift card deleted')
    reload()
  }

  const statusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-400 bg-green-500/10'
      case 'used': return 'text-zinc-400 bg-zinc-500/10'
      case 'expired': return 'text-red-400 bg-red-500/10'
      case 'disabled': return 'text-orange-400 bg-orange-500/10'
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
                <Gift className="h-6 w-6 text-yellow-500" />
                Gift Cards
              </h1>
              <p className="text-zinc-400 text-sm mt-1">Issue, top up, and redeem gift cards</p>
            </div>
            <Button onClick={() => setShowAdd(!showAdd)} className="gold-gradient text-black">
              <Plus className="h-4 w-4 mr-2" />
              Issue Gift Card
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="glass-card border-zinc-700/50">
              <CardContent className="pt-6">
                <p className="text-sm text-zinc-400">Active Cards</p>
                <p className="text-2xl font-bold text-white">{totalActive}</p>
              </CardContent>
            </Card>
            <Card className="glass-card border-zinc-700/50">
              <CardContent className="pt-6">
                <p className="text-sm text-zinc-400">Total Balance Outstanding</p>
                <p className="text-2xl font-bold text-yellow-500">{money(totalBalance)}</p>
              </CardContent>
            </Card>
            <Card className="glass-card border-zinc-700/50">
              <CardContent className="pt-6">
                <p className="text-sm text-zinc-400">Total Issued</p>
                <p className="text-2xl font-bold text-white">{money(totalIssued)}</p>
              </CardContent>
            </Card>
          </div>

          {showAdd && (
            <Card className="glass-card border-zinc-700/50">
              <CardHeader>
                <CardTitle className="text-white">Issue New Gift Card</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-zinc-300">Initial Balance (GH₵)</Label>
                    <Input type="number" value={newCard.initialBalance} onChange={(e) => setNewCard({ ...newCard, initialBalance: e.target.value })} placeholder="50.00" className="bg-zinc-800 border-zinc-700 text-white" />
                  </div>
                  <div>
                    <Label className="text-zinc-300">Customer Name</Label>
                    <Input value={newCard.customerName} onChange={(e) => setNewCard({ ...newCard, customerName: e.target.value })} placeholder="John Doe" className="bg-zinc-800 border-zinc-700 text-white" />
                  </div>
                  <div>
                    <Label className="text-zinc-300">Customer Email</Label>
                    <Input value={newCard.customerEmail} onChange={(e) => setNewCard({ ...newCard, customerEmail: e.target.value })} placeholder="john@email.com" className="bg-zinc-800 border-zinc-700 text-white" />
                  </div>
                  <div>
                    <Label className="text-zinc-300">Expiry Date</Label>
                    <Input type="date" value={newCard.expiryDate} onChange={(e) => setNewCard({ ...newCard, expiryDate: e.target.value })} className="bg-zinc-800 border-zinc-700 text-white" />
                  </div>
                  <div className="sm:col-span-2">
                    <Label className="text-zinc-300">Notes</Label>
                    <Input value={newCard.notes} onChange={(e) => setNewCard({ ...newCard, notes: e.target.value })} placeholder="Optional notes" className="bg-zinc-800 border-zinc-700 text-white" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleCreate} className="gold-gradient text-black">Create Gift Card</Button>
                  <Button onClick={() => setShowAdd(false)} variant="outline" className="border-zinc-700 text-zinc-300">Cancel</Button>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-zinc-500" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by code or customer..." className="bg-zinc-800 border-zinc-700 text-white max-w-sm" />
          </div>

          <Card className="glass-card border-zinc-700/50">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-zinc-800">
                    <tr className="text-left text-zinc-400">
                      <th className="p-3">Code</th>
                      <th className="p-3">Customer</th>
                      <th className="p-3">Balance</th>
                      <th className="p-3">Initial</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Expiry</th>
                      <th className="p-3">Created</th>
                      <th className="p-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 ? (
                      <tr><td colSpan={8} className="p-8 text-center text-zinc-500">No gift cards yet. Issue one to get started.</td></tr>
                    ) : filtered.map((gc) => (
                      <tr key={gc.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                        <td className="p-3 font-mono text-yellow-500">{gc.code}</td>
                        <td className="p-3 text-white">{gc.customerName || '—'}</td>
                        <td className="p-3 text-white font-semibold">{money(gc.balance)}</td>
                        <td className="p-3 text-zinc-400">{money(gc.initialBalance)}</td>
                        <td className="p-3">
                          <span className={`px-2 py-1 rounded text-xs ${statusColor(gc.status)}`}>{gc.status}</span>
                        </td>
                        <td className="p-3 text-zinc-400">{gc.expiryDate || '—'}</td>
                        <td className="p-3 text-zinc-400">{formatDateTime(gc.createdAt)}</td>
                        <td className="p-3">
                          <div className="flex gap-1">
                            {gc.status === 'active' && (
                              <>
                                <button onClick={() => setTopUpId(gc.id)} className="p-1 text-blue-400 hover:text-blue-300" title="Top Up">
                                  <PlusCircle className="h-4 w-4" />
                                </button>
                                <button onClick={() => setRedeemId(gc.id)} className="p-1 text-green-400 hover:text-green-300" title="Redeem">
                                  <CheckCircle className="h-4 w-4" />
                                </button>
                              </>
                            )}
                            <button onClick={() => handleDelete(gc.id)} className="p-1 text-red-400 hover:text-red-300" title="Delete">
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

          {topUpId && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setTopUpId(null)}>
              <Card className="glass-card border-zinc-700/50 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
                <CardHeader>
                  <CardTitle className="text-white flex items-center justify-between">
                    Top Up Gift Card
                    <button onClick={() => setTopUpId(null)}><X className="h-5 w-5 text-zinc-400" /></button>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-zinc-300">Amount (GH₵)</Label>
                    <Input type="number" value={topUpAmount} onChange={(e) => setTopUpAmount(e.target.value)} placeholder="20.00" className="bg-zinc-800 border-zinc-700 text-white" autoFocus />
                  </div>
                  <Button onClick={handleTopUp} className="gold-gradient text-black w-full">Top Up</Button>
                </CardContent>
              </Card>
            </div>
          )}

          {redeemId && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setRedeemId(null)}>
              <Card className="glass-card border-zinc-700/50 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
                <CardHeader>
                  <CardTitle className="text-white flex items-center justify-between">
                    Redeem Gift Card
                    <button onClick={() => setRedeemId(null)}><X className="h-5 w-5 text-zinc-400" /></button>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-zinc-300">Amount (GH₵)</Label>
                    <Input type="number" value={redeemAmount} onChange={(e) => setRedeemAmount(e.target.value)} placeholder="10.00" className="bg-zinc-800 border-zinc-700 text-white" autoFocus />
                  </div>
                  <Button onClick={handleRedeem} className="gold-gradient text-black w-full">Redeem</Button>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </DashboardLayout>
    </AuthGuard>
  )
}
