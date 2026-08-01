import { NextRequest, NextResponse } from 'next/server'
import { requireOwner } from '@/lib/owner-auth'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { PLAN_PRICE_GHS, PlanKey } from '@/lib/subscription'

export async function GET(req: NextRequest) {
  const auth = await requireOwner(req)
  if (!auth.ok) return auth.response

  const admin = getSupabaseAdmin()

  const { data: stores, error: storesError } = await admin
    .from('stores')
    .select('id, subscription_status, plan')

  if (storesError) {
    return NextResponse.json({ error: storesError.message }, { status: 500 })
  }

  const totalStores = stores.length
  const active = stores.filter((s) => s.subscription_status === 'active').length
  const trialing = stores.filter((s) => s.subscription_status === 'trialing').length
  const pastDue = stores.filter((s) => s.subscription_status === 'past_due').length
  const expired = stores.filter((s) => s.subscription_status === 'expired').length
  const canceled = stores.filter((s) => s.subscription_status === 'canceled').length

  const mrr = stores
    .filter((s) => s.subscription_status === 'active')
    .reduce((sum, s) => sum + (PLAN_PRICE_GHS[s.plan as PlanKey] || 0), 0)

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const { data: recentPayments, error: paymentsError } = await admin
    .from('payments')
    .select('status, amount, created_at')
    .gte('created_at', thirtyDaysAgo)

  if (paymentsError) {
    return NextResponse.json({ error: paymentsError.message }, { status: 500 })
  }

  const successfulPayments30d = recentPayments.filter((p) => p.status === 'successful')
  const failedPayments30d = recentPayments.filter((p) => p.status === 'failed')
  const revenue30d = successfulPayments30d.reduce((sum, p) => sum + Number(p.amount), 0)

  return NextResponse.json({
    totalStores,
    active,
    trialing,
    pastDue,
    expired,
    canceled,
    mrr,
    revenue30d,
    successfulPayments30d: successfulPayments30d.length,
    failedPayments30d: failedPayments30d.length,
  })
}
