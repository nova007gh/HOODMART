import { createClient } from '@supabase/supabase-js'
import type { Sale } from '@/lib/store'

export class ReportError extends Error {
  constructor(message: string, public status = 400) { super(message) }
}

export function reportingDB() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new ReportError('Reporting server is not configured.', 503)
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

export async function reportingContext(request: Request, adminOnly = false) {
  const token = request.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1]
  if (!token) throw new ReportError('Please sign in again to use server reports.', 401)
  const db = reportingDB()
  const { data: auth, error } = await db.auth.getUser(token)
  if (error || !auth.user?.email) throw new ReportError('Your session has expired. Please sign in again.', 401)
  const storeId = request.headers.get('x-store-id')
  if (!storeId || !/^[0-9a-f-]{36}$/i.test(storeId)) throw new ReportError('Select a valid store.', 400)
  const { data: member, error: memberError } = await db.from('store_members').select('role, permissions').eq('store_id', storeId).eq('user_id', auth.user.id).maybeSingle()
  if (memberError || !member) throw new ReportError('No access to this store.', 403)
  if (adminOnly && member.role !== 'admin') throw new ReportError('Only store administrators can change SMS settings.', 403)
  if (!adminOnly && !['admin', 'manager', 'cashier', 'salesgirl'].includes(member.role)) throw new ReportError('Sales reporting is not available for your role.', 403)
  return { db, storeId, userId: auth.user.id, email: auth.user.email.toLowerCase(), name: String(auth.user.user_metadata?.name || auth.user.email), role: member.role as string }
}

export type ReportingDB = ReturnType<typeof reportingDB>

export async function readSales(db: ReportingDB, storeId: string, start: string, end: string, email?: string, exclusiveEnd = false): Promise<Sale[]> {
  const rows: Sale[] = []
  for (let offset = 0; ; offset += 1000) {
    let query = db.from('sales_report_source').select('id,items,total,subtotal,discount,timestamp,userEmail,userName,paymentMethod,branchId').eq('store_id', storeId).gte('timestamp', start)
    query = exclusiveEnd ? query.lt('timestamp', end) : query.lte('timestamp', end)
    if (email) query = query.ilike('userEmail', email.replace(/[%_\\]/g, '\\$&'))
    const { data, error } = await query.order('timestamp').order('id').range(offset, offset + 999)
    if (error) throw new ReportError('Could not read complete sales. No report was finalized.', 503)
    rows.push(...(data || []) as Sale[])
    if (!data || data.length < 1000) return rows
    if (rows.length >= 100000) throw new ReportError('Report is too large for an interactive request. No partial total was used.', 503)
  }
}

export function reportFailure(error: unknown) {
  return Response.json({ error: error instanceof ReportError ? error.message : 'Reporting is unavailable. Check setup and try again.' }, { status: error instanceof ReportError ? error.status : 503 })
}
