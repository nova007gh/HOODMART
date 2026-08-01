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
