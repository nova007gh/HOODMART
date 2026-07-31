import { supabase, isSupabaseConfigured } from '@/lib/supabase/client'
import { getStoreId } from '@/lib/auth'

const KEYS = {
  PRODUCTS: 'emdpos_v2_products',
  SALES: 'emdpos_v2_sales',
  CUSTOMERS: 'emdpos_v2_customers',
  DISCOUNTS: 'emdpos_v2_discounts',
  BRANCHES: 'emdpos_v2_branches',
  SUSPENDED: 'emdpos_v2_suspended',
  EMPLOYEES: 'emdpos_v2_employees',
  SUPPLIERS: 'emdpos_v2_suppliers',
  ACTIVITIES: 'emdpos_v2_activities',
}

const SYNC_KEY = 'emdpos_pending_sync'
const LAST_SYNC_KEY = 'emdpos_last_sync'
const DEVICE_KEY = 'emdpos_device_id'

function get<T>(k: string, def: T): T {
  if (typeof window === 'undefined') return def
  try {
    const v = localStorage.getItem(k)
    return v ? JSON.parse(v) : def
  } catch {
    return def
  }
}

function set<T>(k: string, v: T) {
  if (typeof window === 'undefined') return
  localStorage.setItem(k, JSON.stringify(v))
}

export function isOnline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine
}

export function getDeviceId(): string {
  let id = get<string | null>(DEVICE_KEY, null)
  if (!id) {
    id = Math.random().toString(36).slice(2) + Date.now().toString(36)
    set(DEVICE_KEY, id)
  }
  return id
}

export type SyncOp = 'upsert' | 'delete'

export interface PendingChange {
  table: string
  payload: any
  op: SyncOp
  ts: number
}

function getPending(): PendingChange[] {
  return get(SYNC_KEY, [])
}

function setPending(v: PendingChange[]) {
  set(SYNC_KEY, v)
}

function stamp(payload: any) {
  if (!payload || typeof payload !== 'object') return payload
  const storeId = getStoreId()
  return {
    ...payload,
    store_id: storeId || undefined,
    device_id: getDeviceId(),
    updated_at: new Date().toISOString(),
  }
}

async function runRemote(table: string, payload: any, op: SyncOp) {
  if (!isSupabaseConfigured() || !supabase) return
  if (op === 'delete') {
    const id = payload?.id ?? payload
    if (!id) return
    const { error } = await supabase.from(table).delete().eq('id', id)
    if (error) throw error
  } else {
    const { error } = await supabase.from(table).upsert(stamp(payload))
    if (error) throw error
  }
}

export function queueChange(table: string, payload: any, op: SyncOp = 'upsert') {
  const pending = getPending()
  pending.push({ table, payload, op, ts: Date.now() })
  setPending(pending)
}

export async function pushLocalChange(table: string, payload: any, op: SyncOp = 'upsert') {
  if (!isSupabaseConfigured()) return
  if (!isOnline()) {
    queueChange(table, payload, op)
    return
  }
  try {
    await runRemote(table, payload, op)
  } catch {
    queueChange(table, payload, op)
  }
}

export async function flushPending(): Promise<number> {
  const pending = getPending()
  if (!pending.length) return 0
  if (!isSupabaseConfigured() || !isOnline()) return pending.length

  const remaining: PendingChange[] = []
  for (const op of [...pending].sort((a, b) => a.ts - b.ts)) {
    try {
      await runRemote(op.table, op.payload, op.op)
    } catch {
      remaining.push(op)
    }
  }
  setPending(remaining)
  set(LAST_SYNC_KEY, new Date().toISOString())
  return remaining.length
}

const TABLES = [
  { table: 'products', key: KEYS.PRODUCTS },
  { table: 'sales', key: KEYS.SALES },
  { table: 'customers', key: KEYS.CUSTOMERS },
  { table: 'discounts', key: KEYS.DISCOUNTS },
  { table: 'branches', key: KEYS.BRANCHES },
  { table: 'suspended', key: KEYS.SUSPENDED },
  { table: 'employees', key: KEYS.EMPLOYEES },
  { table: 'suppliers', key: KEYS.SUPPLIERS },
  { table: 'activities', key: KEYS.ACTIVITIES },
]

export async function pullRemote(): Promise<void> {
  if (!isSupabaseConfigured() || !isOnline() || !supabase) return
  const storeId = getStoreId()
  for (const { table, key } of TABLES) {
    try {
      let query = supabase.from(table).select('*')
      if (storeId) query = query.eq('store_id', storeId)
      const { data, error } = await query
      if (error) {
        console.warn(`Sync pull error for ${table}:`, error.message)
        continue
      }
      if (Array.isArray(data)) set(key, data as any)
    } catch (e) {
      console.warn(`Sync pull failed for ${table}:`, e)
    }
  }
  set(LAST_SYNC_KEY, new Date().toISOString())
}

export async function syncNow(): Promise<void> {
  await flushPending()
  await pullRemote()
}

export function startSyncListeners(callbacks?: { onOnline?: () => void; onOffline?: () => void }) {
  if (typeof window === 'undefined') return
  const handler = async () => {
    if (isOnline() && callbacks?.onOnline) callbacks.onOnline()
    if (!isOnline() && callbacks?.onOffline) callbacks.onOffline()
  }
  window.addEventListener('online', handler)
  window.addEventListener('offline', handler)
  return () => {
    window.removeEventListener('online', handler)
    window.removeEventListener('offline', handler)
  }
}
