'use client'

import { useEffect, useState } from 'react'
import { AuthGuard } from '@/components/auth-guard'
import { DashboardLayout } from '@/components/layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getSubscriptionInfo, SubscriptionInfo, PLAN_PRICE_GHS, PlanKey } from '@/lib/subscription'
import { getStoreId } from '@/lib/auth'
import { CheckCircle2, Clock, CreditCard, Smartphone, ShieldCheck } from 'lucide-react'

const PAY_PARTNERS: { code: 'MTNGH' | 'TCELGH' | 'ATGH'; label: string }[] = [
  { code: 'MTNGH', label: 'MTN Mobile Money' },
  { code: 'TCELGH', label: 'Telecel Cash' },
  { code: 'ATGH', label: 'AirtelTigo Money' },
]

export default function BillingPage() {
  const [info, setInfo] = useState<SubscriptionInfo | null>(null)
  const [plan, setPlan] = useState<PlanKey>('pro')
  const [paypartnerCode, setPaypartnerCode] = useState<'MTNGH' | 'TCELGH' | 'ATGH'>('MTNGH')
  const [msisdn, setMsisdn] = useState('')
  const [paying, setPaying] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)

  useEffect(() => {
    getSubscriptionInfo().then(setInfo)
  }, [])

  async function handlePay() {
    setResult(null)
    const storeId = getStoreId()
    if (!storeId) {
      setResult({ ok: false, message: 'No store found for this account. Please log in again.' })
      return
    }
    if (!msisdn.trim()) {
      setResult({ ok: false, message: 'Enter the mobile money number to charge.' })
      return
    }

    setPaying(true)
    try {
      const res = await fetch('/api/payments/eganow/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeId, plan, paypartnerCode, msisdn: msisdn.trim() }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setResult({ ok: false, message: data.error || 'Payment could not be started.' })
      } else {
        setResult({
          ok: true,
          message: 'Payment request sent — approve the prompt on your phone to complete payment. Your access will update automatically once confirmed.',
        })
      }
    } catch (err: any) {
      setResult({ ok: false, message: err.message || 'Network error while starting payment.' })
    } finally {
      setPaying(false)
    }
  }

  return (
    <AuthGuard>
      <DashboardLayout>
        <div className="max-w-3xl mx-auto space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Billing & Subscription</h1>
            <p className="text-zinc-400 text-sm">Manage your EMDPOS plan and payment.</p>
          </div>

          {info && (
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Clock className="h-5 w-5 text-yellow-500" /> Current Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-zinc-400">
                  Status:{' '}
                  <span className="text-white font-medium capitalize">{info.status}</span>
                  {info.daysRemaining !== null && (
                    <>
                      {' '}— <span className="text-white font-medium">{Math.max(info.daysRemaining, 0)} day{info.daysRemaining === 1 ? '' : 's'}</span> remaining
                    </>
                  )}
                </p>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {(Object.keys(PLAN_PRICE_GHS) as PlanKey[]).map((key) => (
              <Card
                key={key}
                className={`glass-card cursor-pointer transition-all ${plan === key ? 'ring-2 ring-yellow-500' : ''}`}
                onClick={() => setPlan(key)}
              >
                <CardContent className="p-5 space-y-2">
                  <p className="text-sm uppercase tracking-wide text-zinc-400">{key}</p>
                  <p className="text-3xl font-bold gold-text">GHS {PLAN_PRICE_GHS[key]}</p>
                  <p className="text-xs text-zinc-500">per month</p>
                  {plan === key && (
                    <div className="flex items-center gap-1 text-yellow-500 text-xs pt-1">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Selected
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Smartphone className="h-5 w-5 text-yellow-500" /> Pay with Mobile Money
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {PAY_PARTNERS.map((p) => (
                  <Button
                    key={p.code}
                    variant={paypartnerCode === p.code ? 'default' : 'outline'}
                    className={paypartnerCode === p.code ? 'gold-gradient text-black' : 'border-zinc-700 text-zinc-300'}
                    onClick={() => setPaypartnerCode(p.code)}
                  >
                    {p.label}
                  </Button>
                ))}
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-zinc-500">Mobile Money Number</Label>
                <Input
                  placeholder="0244xxxxxx"
                  value={msisdn}
                  onChange={(e) => setMsisdn(e.target.value)}
                  className="bg-zinc-900 border-zinc-700 text-white"
                />
              </div>
              <Button className="gold-gradient text-black w-full" onClick={handlePay} disabled={paying}>
                {paying ? 'Processing…' : `Pay GHS ${PLAN_PRICE_GHS[plan]} Now`}
              </Button>
              {result && (
                <p className={`text-sm ${result.ok ? 'text-green-400' : 'text-red-400'}`}>{result.message}</p>
              )}
              <p className="text-xs text-zinc-500 flex items-center gap-1">
                <ShieldCheck className="h-3.5 w-3.5" /> Payments are processed securely via Eganow.
              </p>
            </CardContent>
          </Card>

          <Card className="glass-card border-dashed border-zinc-700">
            <CardContent className="p-5 flex items-start gap-3">
              <CreditCard className="h-5 w-5 text-zinc-500 mt-0.5" />
              <p className="text-xs text-zinc-500">
                Card payments and automatic monthly renewal are not yet enabled. Renew manually each month using
                Mobile Money above — you&apos;ll get a reminder banner a few days before your plan expires.
              </p>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    </AuthGuard>
  )
}
