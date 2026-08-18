import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Server-side sync endpoint.
 * Uses the service role key to bypass RLS and pull all store data.
 * The browser client (anon key) can't read from Supabase because RLS
 * is enabled with no permissive policies. This endpoint acts as a
 * proxy so the admin dashboard can see live sales from all cashiers.
 */
export async function GET(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
  }

  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } })

  // Get store_id from query param, cookie, or default to the known store.
  // The client passes store_id as a query param from the session.
  const { searchParams } = new URL(request.url)
  const cookieStoreId = request.headers.get('x-store-id')
  const storeId = searchParams.get('store_id') || cookieStoreId || 'f4c6ecf8-9956-4dfd-9404-b9b81cae5c4d'
  const table = searchParams.get('table') // optional: fetch only one table

  const tables = table
    ? [table]
    : ['sales', 'products', 'customers', 'discounts', 'branches', 'suspended',
       'employees', 'suppliers', 'activities', 'gift_cards', 'expenses', 'quotations']

  const result: Record<string, any[]> = {}
  const errors: string[] = []

  for (const t of tables) {
    try {
      // Supabase caps responses at 1000 rows by default. For tables that
      // can grow large (sales, products, activities), paginate to get all rows.
      // For sales specifically, we only need recent ones for the dashboard —
      // fetch the latest 2000 sorted by timestamp descending.
      if (t === 'sales') {
        const allRows: any[] = []
        let offset = 0
        const pageSize = 1000
        // Fetch pages until we get less than a full page
        while (true) {
          let query = supabase.from(t).select('*').order('timestamp', { ascending: false }).range(offset, offset + pageSize - 1)
          if (storeId) query = query.eq('store_id', storeId)
          const { data, error } = await query
          if (error) { errors.push(`${t}: ${error.message}`); break }
          if (Array.isArray(data) && data.length > 0) {
            allRows.push(...data)
            if (data.length < pageSize) break
            offset += pageSize
          } else {
            break
          }
        }
        result[t] = allRows
      } else {
        let query = supabase.from(t).select('*')
        if (storeId) query = query.eq('store_id', storeId)
        const { data, error } = await query
        if (error) {
          errors.push(`${t}: ${error.message}`)
        } else if (Array.isArray(data)) {
          result[t] = data
        }
      }
    } catch (e: any) {
      errors.push(`${t}: ${e.message}`)
    }
  }

  return NextResponse.json({
    store_id: storeId,
    data: result,
    errors: errors.length ? errors : undefined,
    syncedAt: new Date().toISOString(),
  })
}
