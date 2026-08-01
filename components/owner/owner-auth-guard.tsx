'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { ownerFetch, getOwnerToken } from '@/lib/owner-client'

type Status = 'checking' | 'authorized' | 'unauthorized'

export function OwnerAuthGuard({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>('checking')
  const router = useRouter()

  useEffect(() => {
    let cancelled = false

    async function check() {
      const token = await getOwnerToken()
      if (!token) {
        if (!cancelled) {
          setStatus('unauthorized')
          router.replace('/owner/login')
        }
        return
      }

      try {
        const res = await ownerFetch('/api/owner/me')
        if (!cancelled) {
          if (res.ok) {
            setStatus('authorized')
          } else {
            setStatus('unauthorized')
            router.replace('/owner/login')
          }
        }
      } catch {
        if (!cancelled) {
          setStatus('unauthorized')
          router.replace('/owner/login')
        }
      }
    }

    check()
    return () => {
      cancelled = true
    }
  }, [router])

  if (status !== 'authorized') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-zinc-400">
        {status === 'checking' ? 'Verifying access…' : 'Redirecting…'}
      </div>
    )
  }

  return <>{children}</>
}

export async function ownerSignOut() {
  if (supabase) await supabase.auth.signOut()
}
