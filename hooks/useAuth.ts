'use client'

import { useState, useEffect } from 'react'
import { getSession, logout as doLogout, login as doLogin, Session } from '@/lib/auth'

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setSession(getSession())
    setLoading(false)
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

  return { session, loading, login, logout, isAuthenticated: !!session }
}
