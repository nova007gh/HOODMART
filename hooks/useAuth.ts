'use client'

import { useState, useEffect } from 'react'
import { getSession, logout as doLogout, login as doLogin, Session } from '@/lib/auth'
import { syncNow } from '@/lib/sync'
import { isSupabaseConfigured } from '@/lib/supabase/client'

/** useAuth() is mounted by several components on the same screen (AuthGuard,
 *  DashboardLayout, the page itself). These module-level singletons make sure we
 *  only ever run one sync at a time and don't re-sync on every navigation. */
let inFlight: Promise<void> | null = null
let lastSyncedAt = 0
const RESYNC_AFTER_MS = 60_000

function sharedSync(): Promise<void> {
  if (inFlight) return inFlight
  if (Date.now() - lastSyncedAt < RESYNC_AFTER_MS) return Promise.resolve()
  inFlight = (async () => {
    // Use the server-side sync API (bypasses RLS) instead of the client-side
    // Supabase client which is blocked by RLS policies.
    try {
      const res = await fetch('/api/sync')
      if (res.ok) {
        const json = await res.json()
        if (json.data) {
          if (json.data.sales) localStorage.setItem('hoodmart_v2_sales', JSON.stringify(json.data.sales))
          if (json.data.products) localStorage.setItem('hoodmart_v2_products', JSON.stringify(json.data.products))
          if (json.data.customers) localStorage.setItem('hoodmart_v2_customers', JSON.stringify(json.data.customers))
          if (json.data.branches) localStorage.setItem('hoodmart_v2_branches', JSON.stringify(json.data.branches))
          if (json.data.employees) localStorage.setItem('hoodmart_v2_employees', JSON.stringify(json.data.employees))
          if (json.data.suppliers) localStorage.setItem('hoodmart_v2_suppliers', JSON.stringify(json.data.suppliers))
          if (json.data.activities) localStorage.setItem('hoodmart_v2_activities', JSON.stringify(json.data.activities))
          if (json.data.discounts) localStorage.setItem('hoodmart_v2_discounts', JSON.stringify(json.data.discounts))
          if (json.data.expenses) localStorage.setItem('hoodmart_v2_expenses', JSON.stringify(json.data.expenses))
          if (json.data.gift_cards) localStorage.setItem('hoodmart_v2_gift_cards', JSON.stringify(json.data.gift_cards))
          if (json.data.quotations) localStorage.setItem('hoodmart_v2_quotations', JSON.stringify(json.data.quotations))
          if (json.data.suspended) localStorage.setItem('hoodmart_v2_suspended', JSON.stringify(json.data.suspended))
        }
      }
    } catch {
      /* network error — ignore */
    }
    // Also flush any pending local changes via the original sync mechanism
    try { await syncNow() } catch {}
  })()
    .catch(() => {})
    .finally(() => {
      lastSyncedAt = Date.now()
      inFlight = null
    })
  return inFlight
}

function hasCachedData(): boolean {
  try {
    return !!localStorage.getItem('hoodmart_v2_products')
  } catch {
    return false
  }
}

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    const s = getSession()
    setSession(s)
    setLoading(false)
    if (!s || !isSupabaseConfigured()) return

    // Only block the screen when there is nothing cached to show yet.
    // Otherwise refresh quietly so navigation stays instant.
    const blocking = !hasCachedData()
    if (blocking) setSyncing(true)
    sharedSync().finally(() => {
      if (blocking) setSyncing(false)
      // Refresh the session so a newly synced profile/avatar shows up
      setSession(getSession())
    })
  }, [])

  const logout = async () => {
    await doLogout()
    lastSyncedAt = 0
    setSession(null)
  }

  const login = async (email: string, password: string): Promise<boolean> => {
    const s = await doLogin(email, password)
    if (s) {
      lastSyncedAt = 0
      setSession(s)
      return true
    }
    return false
  }

  return { session, loading, syncing, login, logout, isAuthenticated: !!session }
}
