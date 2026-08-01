import { NextRequest, NextResponse } from 'next/server'
import { requireOwner } from '@/lib/owner-auth'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

const ALLOWED_STATUSES = ['trialing', 'active', 'past_due', 'expired', 'canceled']

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireOwner(req)
  if (!auth.ok) return auth.response

  const admin = getSupabaseAdmin()

  const { data: store, error: storeError } = await admin
    .from('stores')
    .select('*')
    .eq('id', params.id)
    .single()

  if (storeError || !store) {
    return NextResponse.json({ error: 'Store not found' }, { status: 404 })
  }

  const { data: members } = await admin
    .from('store_members')
    .select('user_id, role, created_at')
    .eq('store_id', params.id)

  const { data: payments } = await admin
    .from('payments')
    .select('*')
    .eq('store_id', params.id)
    .order('created_at', { ascending: false })
    .limit(50)

  return NextResponse.json({ store, members: members || [], payments: payments || [] })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireOwner(req)
  if (!auth.ok) return auth.response

  const body = await req.json()
  const updates: Record<string, any> = {}

  if (body.subscription_status !== undefined) {
    if (!ALLOWED_STATUSES.includes(body.subscription_status)) {
      return NextResponse.json({ error: 'Invalid subscription_status' }, { status: 400 })
    }
    updates.subscription_status = body.subscription_status
  }
  if (body.plan !== undefined) updates.plan = body.plan
  if (body.trial_ends_at !== undefined) updates.trial_ends_at = body.trial_ends_at
  if (body.current_period_end !== undefined) updates.current_period_end = body.current_period_end
  if (body.extend_days !== undefined) {
    const days = Number(body.extend_days)
    if (!Number.isFinite(days)) {
      return NextResponse.json({ error: 'Invalid extend_days' }, { status: 400 })
    }
    const admin = getSupabaseAdmin()
    const { data: current } = await admin
      .from('stores')
      .select('subscription_status, trial_ends_at, current_period_end')
      .eq('id', params.id)
      .single()

    const base =
      current?.subscription_status === 'trialing'
        ? current?.trial_ends_at
        : current?.current_period_end
    const baseDate = base ? new Date(base) : new Date()
    const newDate = new Date(Math.max(baseDate.getTime(), Date.now()))
    newDate.setDate(newDate.getDate() + days)

    if (current?.subscription_status === 'trialing') {
      updates.trial_ends_at = newDate.toISOString()
    } else {
      updates.current_period_end = newDate.toISOString()
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const admin = getSupabaseAdmin()
  const { data, error } = await admin
    .from('stores')
    .update(updates)
    .eq('id', params.id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, store: data })
}
