'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client'
import { ownerFetch } from '@/lib/owner-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ShieldAlert, Lock } from 'lucide-react'

export default function OwnerLoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  useEffect(() => {
    document.title = 'Owner Console — Sign In'
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!isSupabaseConfigured() || !supabase) {
      setError('Owner console requires Supabase to be configured on this deployment.')
      return
    }

    setLoading(true)
    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      })
      if (signInError || !data.session) {
        setError(signInError?.message || 'Invalid credentials')
        return
      }

      const res = await ownerFetch('/api/owner/me')
      if (!res.ok) {
        await supabase.auth.signOut()
        if (res.status === 401) {
          setError('Session expired or invalid. Please sign in again.')
        } else if (res.status === 403) {
          setError('This account is not authorized to access the owner console.')
        } else if (res.status >= 500) {
          setError('Owner console server is not configured. Missing service role key or database setup.')
        } else {
          setError('Could not verify owner access. Please try again.')
        }
        return
      }

      router.replace('/owner')
    } catch (err: any) {
      setError(err.message || 'Sign in failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center">
            <Lock className="h-5 w-5 text-yellow-500" />
          </div>
          <h1 className="text-xl font-bold text-white">Platform Owner Console</h1>
          <p className="text-xs text-zinc-500">Internal use only. Not part of the client application.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 bg-zinc-950 border border-zinc-800 rounded-xl p-6">
          <div className="space-y-1">
            <Label className="text-xs text-zinc-500">Email</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-zinc-900 border-zinc-700 text-white"
              required
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-zinc-500">Password</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-zinc-900 border-zinc-700 text-white"
              required
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-md p-2">
              <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <Button type="submit" className="w-full gold-gradient text-black" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign In'}
          </Button>
        </form>
      </div>
    </div>
  )
}
