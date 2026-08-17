'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { hasPermission } from '@/lib/auth'

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false)
  const { isAuthenticated, loading, syncing } = useAuth()
  const router = useRouter()

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.replace('/login')
    }
  }, [loading, isAuthenticated, router])

  if (!mounted || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-900 text-zinc-400">
        Loading HOODMART…
      </div>
    )
  }

  if (!isAuthenticated) {
    return null
  }

  if (syncing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-900 text-zinc-400">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-500 mx-auto mb-4"></div>
          <p>Syncing your data from HOODMART…</p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}

export function PermissionGuard({ permission, children }: { permission: string; children: React.ReactNode }) {
  const { session, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && session && !hasPermission(session.user, permission)) {
      router.replace('/dashboard')
    }
  }, [loading, session, permission, router])

  if (loading || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-900 text-zinc-400">
        Loading…
      </div>
    )
  }

  if (!hasPermission(session.user, permission)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-900 text-zinc-400">
        You don&apos;t have permission to access this page.
      </div>
    )
  }

  return <>{children}</>
}
