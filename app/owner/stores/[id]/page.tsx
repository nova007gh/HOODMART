'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ownerFetch } from '@/lib/owner-client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PLAN_PRICE_GHS, PlanKey } from '@/lib/subscription'
import { ArrowLeft, Save, PlusCircle } from 'lucide-react'

interface StoreDetail {
  id: string
  name: string
  owner_email: string
  plan: string
  subscription_status: string
  trial_ends_at: string | null
  current_period_end: string | null
  subscription_provider: string | null
  created_at: string
}

interface Payment {
  id: string
  transaction_id: string
  provider: string
  amount: number
  currency: string
  plan: string
  status: string
  created_at: string
}

const STATUSES = ['trialing', 'active', 'past_due', 'expired', 'canceled']

export default function StoreDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [store, setStore] = useState<StoreDetail | null>(null)
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const [status, setStatus] = useState('')
  const [plan, setPlan] = useState('')
  const [extendDays, setExtendDays] = useState('30')

  async function load() {
    setLoading(true)
    const res = await ownerFetch(`/api/owner/stores/${params.id}`)
    if (res.ok) {
      const data = await res.json()
      setStore(data.store)
      setPayments(data.payments)
      setStatus(data.store.subscription_status)
      setPlan(data.store.plan)
    }
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id])

  async function saveOverrides() {
    setSaving(true)
    setMessage(null)
    try {
      const res = await ownerFetch(`/api/owner/stores/${params.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ subscription_status: status, plan }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Update failed')
      setMessage('Saved.')
      load()
    } catch (err: any) {
      setMessage(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function extendPeriod() {
    setSaving(true)
    setMessage(null)
    try {
      const res = await ownerFetch(`/api/owner/stores/${params.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ extend_days: Number(extendDays) }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Extension failed')
      setMessage(`Extended by ${extendDays} day(s).`)
      load()
    } catch (err: any) {
      setMessage(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="text-zinc-500 text-sm">Loading store…</div>
  if (!store) return <div className="text-zinc-500 text-sm">Store not found.</div>

  return (
    <div className="space-y-6 max-w-4xl">
      <Link href="/owner" className="flex items-center gap-1 text-sm text-zinc-500 hover:text-white w-fit">
        <ArrowLeft className="h-4 w-4" /> Back to overview
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-white">{store.name}</h1>
        <p className="text-zinc-500 text-sm">{store.owner_email}</p>
      </div>

      <Card className="bg-zinc-950 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-white text-base">Subscription Overrides</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-xs text-zinc-500">Status</Label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full h-10 rounded-md border border-zinc-700 bg-zinc-900 text-white px-3 text-sm"
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-zinc-500">Plan</Label>
              <select
                value={plan}
                onChange={(e) => setPlan(e.target.value)}
                className="w-full h-10 rounded-md border border-zinc-700 bg-zinc-900 text-white px-3 text-sm"
              >
                {(Object.keys(PLAN_PRICE_GHS) as PlanKey[]).map((p) => (
                  <option key={p} value={p}>
                    {p} (GHS {PLAN_PRICE_GHS[p]})
                  </option>
                ))}
                <option value="free">free</option>
              </select>
            </div>
          </div>
          <Button onClick={saveOverrides} disabled={saving} className="gold-gradient text-black">
            <Save className="h-4 w-4 mr-2" /> Save Changes
          </Button>

          <div className="pt-4 border-t border-zinc-800 flex items-end gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-zinc-500">Extend access by (days)</Label>
              <Input
                type="number"
                value={extendDays}
                onChange={(e) => setExtendDays(e.target.value)}
                className="bg-zinc-900 border-zinc-700 text-white w-32"
              />
            </div>
            <Button onClick={extendPeriod} disabled={saving} variant="outline" className="border-zinc-700 text-zinc-300">
              <PlusCircle className="h-4 w-4 mr-2" /> Extend
            </Button>
          </div>

          {message && <p className="text-sm text-yellow-400">{message}</p>}

          <div className="text-xs text-zinc-500 pt-2 space-y-0.5">
            <p>Trial ends: {store.trial_ends_at ? new Date(store.trial_ends_at).toLocaleString() : '—'}</p>
            <p>Current period ends: {store.current_period_end ? new Date(store.current_period_end).toLocaleString() : '—'}</p>
            <p>Provider: {store.subscription_provider || '—'}</p>
            <p>Store created: {new Date(store.created_at).toLocaleString()}</p>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-zinc-950 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-white text-base">Payment History</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-zinc-500 border-b border-zinc-800">
                <th className="px-6 py-2 font-medium">Transaction</th>
                <th className="px-6 py-2 font-medium">Plan</th>
                <th className="px-6 py-2 font-medium">Amount</th>
                <th className="px-6 py-2 font-medium">Status</th>
                <th className="px-6 py-2 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id} className="border-b border-zinc-900">
                  <td className="px-6 py-3 text-zinc-400 text-xs font-mono">{p.transaction_id.slice(0, 8)}…</td>
                  <td className="px-6 py-3 text-zinc-300 capitalize">{p.plan}</td>
                  <td className="px-6 py-3 text-zinc-300">
                    {p.currency} {p.amount}
                  </td>
                  <td className="px-6 py-3 text-zinc-300 capitalize">{p.status}</td>
                  <td className="px-6 py-3 text-zinc-500 text-xs">{new Date(p.created_at).toLocaleString()}</td>
                </tr>
              ))}
              {payments.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-zinc-600">
                    No payments recorded.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}
