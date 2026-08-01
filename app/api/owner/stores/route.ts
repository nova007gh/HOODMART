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
