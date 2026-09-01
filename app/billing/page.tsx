'use client'

import { useEffect, useState } from 'react'
import { AuthGuard } from '@/components/auth-guard'
import { DashboardLayout } from '@/components/layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { getSubscriptionInfo, SubscriptionInfo, PLAN_PRICE_GHS, PlanKey } from '@/lib/subscription'
import { CheckCircle2, Clock, Smartphone, Copy, Info } from 'lucide-react'

export default function BillingPage() {
  const [info, setInfo] = useState<SubscriptionInfo | null>(null)
  const [plan, setPlan] = useState<PlanKey>('pro')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    getSubscriptionInfo().then(setInfo)
  }, [])

  const MOMO_NUMBER = '0244 647 510'
  const MOMO_NAME = 'Emmanuel Adu Larbi'

  function copyNumber() {
    navigator.clipboard.writeText(MOMO_NUMBER.replace(/\s/g, ''))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <AuthGuard>
      <DashboardLayout>
        <div className="max-w-3xl mx-auto space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Billing & Subscription</h1>
            <p className="text-zinc-400 text-sm">Manage your HOODMART plan and payment.</p>
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
            <CardContent className="space-y-5">
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-zinc-500">Send money to</p>
                    <p className="text-lg font-bold text-white">{MOMO_NAME}</p>
                  </div>
                  <Button variant="outline" size="sm" className="border-zinc-700 text-zinc-300" onClick={copyNumber}>
                    {copied ? <CheckCircle2 className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
                    {copied ? 'Copied' : 'Copy'}
                  </Button>
                </div>
                <div className="flex items-center gap-2 bg-black/40 rounded-md px-3 py-2">
                  <Smartphone className="h-4 w-4 text-yellow-500" />
                  <span className="text-xl font-bold gold-text tracking-wide">{MOMO_NUMBER}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-zinc-500">Amount</span>
                  <span className="text-white font-bold">GHS {PLAN_PRICE_GHS[plan]}</span>
                </div>
              </div>

              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Info className="h-4 w-4 text-yellow-500" />
                  <p className="text-sm font-medium text-yellow-400">Payment Instructions</p>
                </div>
                <ol className="text-xs text-zinc-300 space-y-1.5 list-decimal list-inside">
                  <li>Dial <span className="text-white font-medium">*170#</span> (MTN), <span className="text-white font-medium">*110#</span> (Telecel), or <span className="text-white font-medium">*920#</span> (AirtelTigo) to send money.</li>
                  <li>Enter the mobile money number above as the recipient.</li>
                  <li>Enter the amount: <span className="text-white font-medium">GHS {PLAN_PRICE_GHS[plan]}</span>.</li>
                  <li><strong className="text-yellow-400">Use your shop name as the reference code</strong> when prompted. This helps us identify your payment.</li>
                  <li>Complete the payment and confirm with your PIN.</li>
                  <li>Your subscription will be activated within a few minutes after payment is confirmed.</li>
                </ol>
              </div>

              <p className="text-xs text-zinc-500">
                After sending the payment, your subscription will be manually confirmed and activated. You will
                receive a notification once your plan is active. If you have any issues, contact support.
              </p>
            </CardContent>
          </Card>

          <Card className="glass-card border-dashed border-zinc-700">
            <CardContent className="p-5 flex items-start gap-3">
              <Clock className="h-5 w-5 text-zinc-500 mt-0.5" />
              <p className="text-xs text-zinc-500">
                Automatic monthly renewal is not yet enabled. Renew manually each month using Mobile Money above —
                you&apos;ll get a reminder banner a few days before your plan expires.
              </p>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    </AuthGuard>
  )
}
