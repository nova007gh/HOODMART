import { NextRequest, NextResponse } from 'next/server'
import { requireOwner } from '@/lib/owner-auth'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Owner-console activity feed: sign-ins, recent sales, per-store sales
 * rollups and row-count usage. One aggregated endpoint so the dashboard
 * makes a single call inside its existing 60s refresh — capped, light
 * queries to keep egress near zero.
 */
export async function GET(req: NextRequest) {
  const auth = await requireOwner(req)
  if (!auth.ok) return auth.response

  const admin = getSupabaseAdmin()

  const { data: stores } = await admin.from('stores').select('id, name, owner_email')
  const storeName: Record<string, string> = {}
  for (const s of stores || []) storeName[s.id] = s.name || s.owner_email || s.id.slice(0, 8)

  // --- Sign-in activity: auth users joined to store_members ---
  const { data: members } = await admin.from('store_members').select('store_id, user_id, role')
  const memberByUser: Record<string, { store_id: string; role: string }> = {}
  for (const m of members || []) memberByUser[m.user_id] = { store_id: m.store_id, role: m.role }

  let logins: any[] = []
  try {
    const { data: usersData } = await admin.auth.admin.listUsers({ perPage: 200 })
    logins = (usersData?.users || [])
      .filter((u) => u.last_sign_in_at)
      .map((u) => {
        const mem = memberByUser[u.id]
        return {
          email: u.email,
          lastSignInAt: u.last_sign_in_at,
          store_id: mem?.store_id || null,
          storeName: mem?.store_id ? storeName[mem.store_id] || null : null,
          role: mem?.role || null,
        }
      })
      .sort((a, b) => (b.lastSignInAt || '').localeCompare(a.lastSignInAt || ''))
      .slice(0, 20)
  } catch { /* non-fatal */ }

  // --- Sales window for rollups + feed (last 90d, capped) ---
  // PostgREST caps each response at 1000 rows, so page through.
  const ninetyDaysAgo = new Date(Date.now() - 90 * 864e5).toISOString()
  const sales: any[] = []
  const PAGE = 1000
  for (let from = 0; from < 5000; from += PAGE) {
    const { data: page } = await admin
      .from('sales')
      .select('id, store_id, userEmail, total, timestamp')
      .gte('updated_at', ninetyDaysAgo)
      .order('updated_at', { ascending: false })
      .range(from, from + PAGE - 1)
    if (!page?.length) break
    sales.push(...page)
    if (page.length < PAGE) break
  }

  const recentSales = (sales || []).slice(0, 30).map((s) => ({
    id: s.id,
    store_id: s.store_id,
    storeName: s.store_id ? storeName[s.store_id] || 'Unknown' : 'Unknown',
    cashier: s.userEmail || 'unknown',
    total: Number(s.total) || 0,
    timestamp: s.timestamp,
  }))

  const dayKey = (ts: string) => ts.slice(0, 10)
  const weekKey = (ts: string) => {
    const d = new Date(ts)
    const start = new Date(d)
    start.setUTCDate(d.getUTCDate() - d.getUTCDay())
    return start.toISOString().slice(0, 10)
  }
  const monthKey = (ts: string) => ts.slice(0, 7)

  const dayTotals: Record<string, Record<string, number>> = {}
  const weekTotals: Record<string, Record<string, number>> = {}
  const monthTotals: Record<string, Record<string, number>> = {}
  const dayCounts: Record<string, Record<string, number>> = {}
  const weekCounts: Record<string, Record<string, number>> = {}
  const monthCounts: Record<string, Record<string, number>> = {}

  const bump = (map: Record<string, Record<string, number>>, key: string, sid: string, n: number) => {
    if (!map[key]) map[key] = {}
    map[key][sid] = (map[key][sid] || 0) + n
  }

  for (const s of sales || []) {
    const sid = s.store_id || 'unknown'
    const total = Number(s.total) || 0
    const ts = s.timestamp || ''
    if (!ts) continue
    bump(dayTotals, dayKey(ts), sid, total)
    bump(weekTotals, weekKey(ts), sid, total)
    bump(monthTotals, monthKey(ts), sid, total)
    bump(dayCounts, dayKey(ts), sid, 1)
    bump(weekCounts, weekKey(ts), sid, 1)
    bump(monthCounts, monthKey(ts), sid, 1)
  }

  // Fixed buckets so the UI always has stable series
  const days: string[] = []
  for (let i = 13; i >= 0; i--) {
    const d = new Date()
    d.setUTCDate(d.getUTCDate() - i)
    days.push(d.toISOString().slice(0, 10))
  }
  const weeks: string[] = []
  for (let i = 7; i >= 0; i--) {
    const d = new Date()
    d.setUTCDate(d.getUTCDate() - d.getUTCDay() - i * 7)
    weeks.push(d.toISOString().slice(0, 10))
  }
  const months: string[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date()
    d.setUTCMonth(d.getUTCMonth() - i)
    months.push(d.toISOString().slice(0, 7))
  }

  const series = (bucketKeys: string[], totals: Record<string, Record<string, number>>, counts: Record<string, Record<string, number>>) =>
    (stores || []).map((s) => ({
      store_id: s.id,
      storeName: storeName[s.id],
      points: bucketKeys.map((k) => ({
        key: k,
        total: totals[k]?.[s.id] || 0,
        count: counts[k]?.[s.id] || 0,
      })),
    }))

  // --- Usage per store: row counts only (head queries ≈ zero egress) ---
  const usage: any[] = []
  for (const s of stores || []) {
    const [products, salesCount, customers, employees, activities] = await Promise.all([
      admin.from('products').select('id', { count: 'exact', head: true }).eq('store_id', s.id),
      admin.from('sales').select('id', { count: 'exact', head: true }).eq('store_id', s.id),
      admin.from('customers').select('id', { count: 'exact', head: true }).eq('store_id', s.id),
      admin.from('employees').select('id', { count: 'exact', head: true }).eq('store_id', s.id),
      admin.from('activities').select('id', { count: 'exact', head: true }).eq('store_id', s.id),
    ])
    usage.push({
      store_id: s.id,
      storeName: storeName[s.id],
      products: products.count || 0,
      sales: salesCount.count || 0,
      customers: customers.count || 0,
      employees: employees.count || 0,
      activities: activities.count || 0,
    })
  }

  return NextResponse.json({
    logins,
    recentSales,
    salesByDay: series(days, dayTotals, dayCounts),
    salesByWeek: series(weeks, weekTotals, weekCounts),
    salesByMonth: series(months, monthTotals, monthCounts),
    usage,
  })
}
