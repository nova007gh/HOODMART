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

  const logout = () => {
    doLogout()
    setSession(null)
  }

  const login = (email: string, password: string): boolean => {
    const s = doLogin(email, password)
    if (s) {
      setSession(s)
      return true
    }
    return false
  }

  return { session, loading, login, logout, isAuthenticated: !!session }
}
