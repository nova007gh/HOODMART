'use client'

import { useState, useEffect } from 'react'
import { getSession, logout as doLogout, login as doLogin, Session } from '@/lib/auth'
import { syncNow } from '@/lib/sync'
import { ensureFreshData } from '@/lib/fresh-data'
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
    // Use the shared fresh-data utility (bypasses RLS via server-side API)
    await ensureFreshData()
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
