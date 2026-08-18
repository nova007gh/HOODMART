import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Server-side push endpoint.
 * Uses the service role key to bypass RLS and write data to Supabase.
 * The browser client (anon key) can't write to Supabase because RLS
 * blocks inserts/updates/deletes. This endpoint acts as a proxy so
 * sales made by cashiers reach Supabase and are visible to the admin.
 */
export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
  }

  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } })

  try {
    const body = await request.json()
    const { table, payload, op = 'upsert' } = body

    if (!table || !payload) {
      return NextResponse.json({ error: 'Missing table or payload' }, { status: 400 })
    }

    // Allowed tables for write operations
    const allowedTables = [
      'sales', 'products', 'customers', 'discounts', 'branches', 'suspended',
      'employees', 'suppliers', 'activities', 'gift_cards', 'expenses',
      'quotations', 'notifications',
    ]

    if (!allowedTables.includes(table)) {
      return NextResponse.json({ error: `Table '${table}' not allowed` }, { status: 400 })
    }

    // Stamp with store_id and updated_at
    const storeId = body.store_id || payload.store_id
    const stamped = {
      ...payload,
      store_id: storeId || payload.store_id,
      updated_at: new Date().toISOString(),
    }

    if (op === 'delete') {
      const id = payload?.id ?? payload
      if (!id) return NextResponse.json({ error: 'Missing id for delete' }, { status: 400 })
      const { error } = await supabase.from(table).delete().eq('id', id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true, op: 'delete', table, id })
    } else {
      // upsert
      const { data, error } = await supabase.from(table).upsert(stamped).select('id')
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true, op: 'upsert', table, id: data?.[0]?.id })
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
