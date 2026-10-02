import { NextRequest, NextResponse } from 'next/server'
import { requireOwner } from '@/lib/owner-auth'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

export async function GET(req: NextRequest) {
  const auth = await requireOwner(req)
  if (!auth.ok) return auth.response

  const admin = getSupabaseAdmin()

  const { data: payments, error } = await admin
    .from('payments')
    .select('id, store_id, provider, transaction_id, provider_reference, amount, currency, plan, status, created_at')
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const storeIds = Array.from(new Set(payments.map((p) => p.store_id)))
  const { data: stores } = await admin.from('stores').select('id, name').in('id', storeIds)
  const storeNameById: Record<string, string> = {}
  for (const s of stores || []) storeNameById[s.id] = s.name

  const enriched = payments.map((p) => ({ ...p, storeName: storeNameById[p.store_id] || 'Unknown' }))

  return NextResponse.json({ payments: enriched })
}

const PLAN_PRICE_GHS: Record<string, number> = { basic: 150, pro: 300 }
const ALLOWED_PAYMENT_STATUSES = ['pending', 'successful', 'failed']

export async function POST(req: NextRequest) {
  const auth = await requireOwner(req)
  if (!auth.ok) return auth.response

  const body = await req.json()
  const storeId = String(body.store_id || '')
  const plan = String(body.plan || 'pro')
  const provider = String(body.provider || 'manual')
  const status = ALLOWED_PAYMENT_STATUSES.includes(body.status) ? body.status : 'successful'
  const amount = Number.isFinite(Number(body.amount)) ? Number(body.amount) : (PLAN_PRICE_GHS[plan] ?? 0)
  const extendDays = body.extend_days !== undefined ? Number(body.extend_days) : null

  if (!storeId) {
    return NextResponse.json({ error: 'store_id is required' }, { status: 400 })
  }

  const admin = getSupabaseAdmin()

  const { data: store, error: storeError } = await admin
    .from('stores')
    .select('id, subscription_status, trial_ends_at, current_period_end')
    .eq('id', storeId)
    .single()
  if (storeError || !store) {
    return NextResponse.json({ error: 'Store not found' }, { status: 404 })
  }

  const { data: payment, error: paymentError } = await admin
    .from('payments')
    .insert({
      store_id: storeId,
      provider,
      transaction_id: `owner-${Date.now()}`,
      amount,
      currency: 'GHS',
      plan,
      status,
    })
    .select()
    .single()
  if (paymentError) {
    return NextResponse.json({ error: paymentError.message }, { status: 500 })
  }

  // A successful payment with extend_days renews the subscription: it pushes
  // the paid-through date forward from max(now, current end) and reactivates.
  let updatedStore = null
  if (status === 'successful' && extendDays && extendDays > 0) {
    const base = store.subscription_status === 'trialing' ? store.trial_ends_at : store.current_period_end
    const baseDate = base ? new Date(base) : new Date()
    const newEnd = new Date(Math.max(baseDate.getTime(), Date.now()))
    newEnd.setDate(newEnd.getDate() + extendDays)

    const { data } = await admin
      .from('stores')
      .update({
        subscription_status: 'active',
        plan,
        current_period_end: newEnd.toISOString(),
        subscription_provider: provider,
      })
      .eq('id', storeId)
      .select()
      .single()
    updatedStore = data
  }

  return NextResponse.json({ ok: true, payment, store: updatedStore })
}
