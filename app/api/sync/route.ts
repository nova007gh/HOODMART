import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Server-side sync endpoint.
 * Uses the service role key to bypass RLS and pull store data.
 *
 * Query params:
 *   - table: sync a single table only
 *   - store_id: filter by store
 *   - all: "1" or "true" disables default caps
 *   - limit: override per-table cap
 *   - from / to: ISO dates to filter on updated_at
 */
export async function GET(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
  }

  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } })

  const { searchParams } = new URL(request.url)
  const cookieStoreId = request.headers.get('x-store-id')
  const storeId = searchParams.get('store_id') || cookieStoreId || 'f4c6ecf8-9956-4dfd-9404-b9b81cae5c4d'
  const table = searchParams.get('table')
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const limitParam = searchParams.get('limit')
  const all =
    searchParams.get('all') === '1' ||
    searchParams.get('all') === 'true'

  let requestedLimit: number | undefined
  if (limitParam) {
    const n = parseInt(limitParam, 10)
    if (!Number.isNaN(n) && n > 0) requestedLimit = n
  }

  // Default caps for high-volume tables. Prevents Vercel egress from
  // ballooning when a page pulls all sales/activities.
  const DEFAULT_LIMITS: Record<string, number> = {
    sales: 1000,
    activities: 500,
  }

  const tables = table
    ? [table]
    : ['sales', 'products', 'customers', 'discounts', 'branches', 'suspended',
       'employees', 'suppliers', 'activities', 'gift_cards', 'expenses', 'quotations']

  const result: Record<string, any[]> = {}
  const errors: string[] = []

  // Paginate every table — PostgREST silently caps responses at 1000 rows,
  // which would otherwise drop products/sales beyond that limit.
  const PAGINATED = new Set(tables)

  for (const t of tables) {
    try {
      const targetLimit = all
        ? Infinity
        : (requestedLimit ?? DEFAULT_LIMITS[t] ?? Infinity)

      // Apply optional date window on updated_at
      const applyFilters = (q: any) => {
        let query = q
        if (storeId) query = query.eq('store_id', storeId)
        if (from) query = query.gte('updated_at', from)
        if (to) query = query.lte('updated_at', to)
        return query
      }

      if (PAGINATED.has(t)) {
        const allRows: any[] = []
        let offset = 0
        const pageSize = 1000

        while (allRows.length < targetLimit) {
          const remaining = targetLimit - allRows.length
          const thisPage = Math.min(pageSize, remaining)
          let query = supabase
            .from(t)
            .select('*')
            .order('updated_at', { ascending: false })
            .range(offset, offset + thisPage - 1)
          query = applyFilters(query)
          const { data, error } = await query
          if (error) { errors.push(`${t}: ${error.message}`); break }
          if (Array.isArray(data) && data.length > 0) {
            allRows.push(...data)
            if (data.length < thisPage) break
            offset += thisPage
          } else {
            break
          }
        }
        result[t] = allRows
      } else {
        let query = supabase.from(t).select('*')
        query = applyFilters(query)
        if (Number.isFinite(targetLimit)) {
          query = query
            .order('updated_at', { ascending: false })
            .limit(targetLimit)
        }
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
