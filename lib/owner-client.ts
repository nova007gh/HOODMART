'use client'

import { supabase } from '@/lib/supabase/client'

/** Returns the current Supabase access token for the logged-in owner session, or null. */
export async function getOwnerToken(): Promise<string | null> {
  if (!supabase) return null
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token || null
}

/** Fetch wrapper that attaches the owner's Supabase Bearer token to /api/owner/* calls. */
export async function ownerFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const token = await getOwnerToken()
  const headers = new Headers(init.headers)
  if (token) headers.set('Authorization', `Bearer ${token}`)
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  return fetch(input, { ...init, headers })
}
