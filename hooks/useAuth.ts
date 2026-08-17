'use client'

import { useState, useEffect } from 'react'
import { getSession, logout as doLogout, login as doLogin, Session } from '@/lib/auth'
import { pullRemote } from '@/lib/sync'
import { isSupabaseConfigured } from '@/lib/supabase/client'

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    const s = getSession()
    setSession(s)
    setLoading(false)
    // If authenticated and Supabase is configured, pull remote data on mount
    if (s && isSupabaseConfigured()) {
      setSyncing(true)
      pullRemote()
        .then(() => setSyncing(false))
        .catch(() => setSyncing(false))
    }
  }, [])

  const logout = async () => {
    await doLogout()
    setSession(null)
  }

  const login = async (email: string, password: string): Promise<boolean> => {
    const s = await doLogin(email, password)
    if (s) {
      setSession(s)
      return true
    }
    return false
  }

  return { session, loading, syncing, login, logout, isAuthenticated: !!session }
}
