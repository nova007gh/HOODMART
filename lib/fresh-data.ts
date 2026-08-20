/**
 * Shared data sync utility.
 * Pulls all store data from the server-side /api/sync endpoint (bypasses RLS)
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

/**
 * Merge local-only fields (like avatar) that may not exist in Supabase yet.
 * When the server returns employees without an avatar column, we preserve
 * the avatar from localStorage so profile pictures don't disappear.
 *
 * For products: if a local product has a newer updated_at than the server
 * version, keep the local copy (the user just edited it and the push may
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

function buildUrl(table?: string): string {
  const storeId = getStoreId()
  const params = new URLSearchParams()
  if (table) params.set('table', table)
  if (storeId) params.set('store_id', storeId)
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

/**
 * Pull a single table from the server-side sync API.
 * Use this when a page only needs one table (e.g. just sales).
 */
export async function pullTable(table: string): Promise<any[] | null> {
  try {
    const res = await fetch(buildUrl(table))
    if (res.ok) {
      const json = await res.json()
      if (json.data?.[table] && Array.isArray(json.data[table])) {
        const key = TABLE_KEYS[table]
        const merged = mergeLocalFields(table, json.data[table])
        if (key) {
          try {
            localStorage.setItem(key, JSON.stringify(merged))
          } catch { /* quota — ignore */ }
        }
        return merged
      }
    }
  } catch { /* ignore */ }
  return null
}
