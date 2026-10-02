import { NextRequest, NextResponse } from 'next/server'
import { requireOwner } from '@/lib/owner-auth'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

export async function GET(req: NextRequest) {
  const auth = await requireOwner(req)
  if (!auth.ok) return auth.response

  const admin = getSupabaseAdmin()

  const { data: stores, error } = await admin
    .from('stores')
    .select('id, name, owner_email, plan, subscription_status, trial_ends_at, current_period_end, subscription_provider, created_at')
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Best-effort "last active" signal per store, based on the most recent
  // recorded activity. Non-fatal if it fails.
  let lastActiveByStore: Record<string, string> = {}
  try {
    const { data: activities } = await admin
      .from('activities')
      .select('store_id, updated_at')
      .order('updated_at', { ascending: false })
      .limit(2000)

    if (activities) {
      for (const a of activities) {
        if (a.store_id && !lastActiveByStore[a.store_id]) {
          lastActiveByStore[a.store_id] = a.updated_at
        }
      }
    }
  } catch {}

  const enriched = stores.map((s) => ({ ...s, lastActiveAt: lastActiveByStore[s.id] || null }))

  return NextResponse.json({ stores: enriched })
}

const PLANS = ['free', 'basic', 'pro']

export async function POST(req: NextRequest) {
  const auth = await requireOwner(req)
  if (!auth.ok) return auth.response

  const body = await req.json()
  const name = String(body.name || '').trim()
  const email = String(body.owner_email || '').trim().toLowerCase()
  const plan = PLANS.includes(body.plan) ? body.plan : 'free'
  const trialDays = Number.isFinite(Number(body.trial_days)) ? Math.max(0, Number(body.trial_days)) : 14
  const password = body.password ? String(body.password) : `Hood-${Math.random().toString(36).slice(2, 10)}`

  if (!name || !email) {
    return NextResponse.json({ error: 'Store name and owner email are required' }, { status: 400 })
  }
  if (password.length < 6) {
    return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
  }

  const admin = getSupabaseAdmin()

  const { data: userData, error: userError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { store_name: name },
  })
  if (userError || !userData?.user) {
    return NextResponse.json({ error: userError?.message || 'Failed to create owner account' }, { status: 400 })
  }

  // The handle_new_user trigger normally creates the store + membership.
  // Give it a moment, then fall back to manual creation if it never lands.
  let storeId: string | null = null
  for (let attempt = 0; attempt < 10 && !storeId; attempt++) {
    const { data: member } = await admin
      .from('store_members')
      .select('store_id')
      .eq('user_id', userData.user.id)
      .maybeSingle()
    storeId = member?.store_id ?? null
    if (!storeId) await new Promise((r) => setTimeout(r, 300))
  }

  if (!storeId) {
    const { data: store, error: storeError } = await admin
      .from('stores')
      .insert({ name, owner_email: email })
      .select('id')
      .single()
    if (storeError || !store) {
      return NextResponse.json({ error: storeError?.message || 'Store creation failed' }, { status: 500 })
    }
    storeId = store.id
    await admin
      .from('store_members')
      .insert({ store_id: storeId, user_id: userData.user.id, role: 'admin', permissions: ['*'] })
  }

  const { data: store, error: updateError } = await admin
    .from('stores')
    .update({
      name,
      plan,
      subscription_status: 'trialing',
      trial_ends_at: new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000).toISOString(),
    })
    .eq('id', storeId)
    .select()
    .single()

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, store, credentials: { email, password } })
}
