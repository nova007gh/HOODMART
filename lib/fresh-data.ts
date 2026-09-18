/**
 * Shared data sync utility.
 * Pulls store data from the server-side /api/sync endpoint (bypasses RLS)
 * and writes it to localStorage so store.getX() calls return fresh data.
 *
 * This is the single source of truth for data freshness across the app.
 * Any page that needs fresh data calls ensureFreshData() on mount.
 */

import { getStoreId } from '@/lib/auth'

const SYNC_KEY = 'hoodmart_last_full_sync'
const REFRESH_AFTER_MS = 10_000 // 10 seconds — refresh if older than this

let inFlight: Promise<void> | null = null
let lastSyncedAt = 0

const TABLE_KEYS: Record<string, string> = {
  sales: 'hoodmart_v2_sales',
  products: 'hoodmart_v2_products',
  customers: 'hoodmart_v2_customers',
  discounts: 'hoodmart_v2_discounts',
  branches: 'hoodmart_v2_branches',
  suspended: 'hoodmart_v2_suspended',
  employees: 'hoodmart_v2_employees',
  suppliers: 'hoodmart_v2_suppliers',
  activities: 'hoodmart_v2_activities',
  gift_cards: 'hoodmart_v2_gift_cards',
  expenses: 'hoodmart_v2_expenses',
  quotations: 'hoodmart_v2_quotations',
}

export interface PullOptions {
  all?: boolean
  limit?: number
  from?: string
  to?: string
}

/**
 * Merge local-only fields (like avatar) that may not exist in Supabase yet.
 * When the server returns employees without an avatar column, we preserve
 * the avatar from localStorage so profile pictures don't disappear.
 *
 * For products: if a local product has a newer updated_at than the server
 * version, we keep the local copy (the user just edited it and the push may
 * not have completed yet, or the server data is stale).
 */
function mergeLocalFields(table: string, serverData: any[]): any[] {
  if (typeof window === 'undefined') return serverData
  const key = TABLE_KEYS[table]
  if (!key) return serverData

  try {
    const raw = localStorage.getItem(key)
    if (!raw) return serverData
    const localData: any[] = JSON.parse(raw)

    if (table === 'employees') {
      const avatarMap = new Map<string, string>()
      for (const e of localData) {
        if (e.id && e.avatar) avatarMap.set(e.id, e.avatar)
      }
      if (avatarMap.size === 0) return serverData
      return serverData.map((e) => {
        if (!e.avatar && avatarMap.has(e.id)) {
          return { ...e, avatar: avatarMap.get(e.id) }
        }
        return e
      })
    }

    if (table === 'products') {
      // Build a map of local products by ID with their updated_at
      const localMap = new Map<string, any>()
      for (const p of localData) {
        if (p.id) localMap.set(p.id, p)
      }
      // For each server product, check if local version is newer
      return serverData.map((s) => {
        const local = localMap.get(s.id)
        if (!local) return s
        const localUpdated = local.updated_at ? new Date(local.updated_at).getTime() : 0
        const serverUpdated = s.updated_at ? new Date(s.updated_at).getTime() : 0
        // If local was updated more recently (within last 60s), keep local
        if (localUpdated > serverUpdated && (Date.now() - localUpdated) < 60000) {
          return local
        }
        return s
      })
    }

    return serverData
  } catch {
    return serverData
  }
}

function buildUrl(table?: string, opts?: PullOptions): string {
  const storeId = getStoreId()
  const params = new URLSearchParams()
  if (table) params.set('table', table)
  if (storeId) params.set('store_id', storeId)
  if (opts) {
    if (opts.all) params.set('all', '1')
    if (opts.limit) params.set('limit', String(opts.limit))
    if (opts.from) params.set('from', opts.from)
    if (opts.to) params.set('to', opts.to)
  }
  const qs = params.toString()
  return qs ? `/api/sync?${qs}` : '/api/sync'
}

/**
 * Pull all data from the server-side sync API and write to localStorage.
 * Deduplicates concurrent calls and rate-limits to one call per 10s.
 */
export async function ensureFreshData(): Promise<void> {
  if (inFlight) return inFlight
  if (Date.now() - lastSyncedAt < REFRESH_AFTER_MS) return Promise.resolve()

  inFlight = (async () => {
    try {
      const res = await fetch(buildUrl())
      if (res.ok) {
        const json = await res.json()
        if (json.data) {
          for (const [table, key] of Object.entries(TABLE_KEYS)) {
            if (json.data[table] && Array.isArray(json.data[table])) {
              try {
                const merged = mergeLocalFields(table, json.data[table])
                localStorage.setItem(key, JSON.stringify(merged))
              } catch {
                /* quota — ignore */
              }
            }
          }
          try {
            localStorage.setItem(SYNC_KEY, new Date().toISOString())
          } catch { /* ignore */ }
        }
      }
    } catch {
      /* network error — ignore, use cached data */
    }
  })()
    .catch(() => {})
    .finally(() => {
      lastSyncedAt = Date.now()
      inFlight = null
    })

  return inFlight
}

// ---------------------------------------------------------------------------
// Incremental sync — keeps egress low on Supabase's free tier.
//
//   pullTable('products')        → first call fetches everything once, then
//                                  only rows updated since the last pull.
//                                  A full re-pull happens every 6h to catch
//                                  hard-deleted rows.
//   pullTable('sales', {from})   → explicit window query (dashboard, reports).
//
// Plus a 15s per-table throttle so rapid page navigation doesn't refetch.
// ---------------------------------------------------------------------------

const LAST_PULL_PREFIX = 'hoodmart_last_pull_'
const LAST_SYNC_PREFIX = 'hoodmart_last_synced_'
const LAST_FULL_PREFIX = 'hoodmart_last_full_pull_'
const MIN_PULL_INTERVAL_MS = 15_000
const FULL_PULL_AFTER_MS = 6 * 60 * 60 * 1000

// Keep the newest N rows per table in localStorage so merged data doesn't
// grow unbounded over weeks of incremental syncs.
const MERGE_CAPS: Record<string, number> = {
  sales: 3000,
  activities: 500,
}

function readLS<T>(key: string, def: T): T {
  if (typeof window === 'undefined') return def
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : def
  } catch {
    return def
  }
}

function writeLS(key: string, value: any) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch { /* quota — ignore */ }
}

/**
 * Merge incoming server rows into the local array by id. Rows the server
 * didn't send (older data, hard-deleted elsewhere) are kept until the next
 * periodic full pull cleans them up.
 */
function mergeRows(table: string, local: any[], incoming: any[]): any[] {
  const incomingById = new Map<string, any>()
  for (const r of incoming) if (r?.id) incomingById.set(r.id, r)

  const merged = local.map((l) => {
    const s = l?.id ? incomingById.get(l.id) : undefined
    if (!s) return l
    incomingById.delete(l.id)
    if (table === 'products') {
      const lt = l.updated_at ? new Date(l.updated_at).getTime() : 0
      const st = s.updated_at ? new Date(s.updated_at).getTime() : 0
      if (lt > st && Date.now() - lt < 60_000) return l
    }
    if (table === 'employees' && !s.avatar && l.avatar) return { ...s, avatar: l.avatar }
    return s
  })

  incomingById.forEach((s) => merged.push(s))

  const cap = MERGE_CAPS[table]
  if (cap && merged.length > cap) {
    merged.sort((a, b) => {
      const at = new Date(a?.updated_at || a?.timestamp || a?.date || 0).getTime() || 0
      const bt = new Date(b?.updated_at || b?.timestamp || b?.date || 0).getTime() || 0
      return bt - at
    })
    return merged.slice(0, cap)
  }
  return merged
}

/**
 * Pull a single table from the server-side sync API.
 * Use this when a page only needs one table (e.g. just sales).
 */
export async function pullTable(table: string, opts?: PullOptions): Promise<any[] | null> {
  const key = TABLE_KEYS[table]
  try {
    const incremental = !opts
    let fetchOpts = opts
    let fullPull = false

    if (incremental && typeof window !== 'undefined' && key) {
      const localRows = readLS<any[]>(key, [])
      const lastFull = readLS<number>(LAST_FULL_PREFIX + table, 0)
      const lastPull = readLS<number>(LAST_PULL_PREFIX + table, 0)
      const lastSynced = readLS<string>(LAST_SYNC_PREFIX + table, '')
      const needsFull = !localRows.length || !lastFull || Date.now() - lastFull > FULL_PULL_AFTER_MS

      if (!needsFull && Date.now() - lastPull < MIN_PULL_INTERVAL_MS) {
        return localRows
      }
      if (!needsFull && lastSynced) {
        fetchOpts = { from: lastSynced }
      } else {
        fullPull = true
      }
    }

    const res = await fetch(buildUrl(table, fetchOpts))
    if (!res.ok) return null
    const json = await res.json()
    if (!json.data?.[table] || !Array.isArray(json.data[table])) return null

    const merged = fullPull
      ? mergeLocalFields(table, json.data[table])
      : mergeRows(table, key ? readLS<any[]>(key, []) : [], json.data[table])

    if (key) writeLS(key, merged)
    if (typeof window !== 'undefined') {
      writeLS(LAST_PULL_PREFIX + table, Date.now())
      if (json.syncedAt) writeLS(LAST_SYNC_PREFIX + table, json.syncedAt)
      if (fullPull) writeLS(LAST_FULL_PREFIX + table, Date.now())
    }
    return merged
  } catch {
    return null
  }
}
