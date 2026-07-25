import { createBrowserClient } from '@supabase/ssr'

const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const url = envUrl && /^https?:\/\//.test(envUrl) ? envUrl : 'https://placeholder.supabase.co'
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key'

export const isSupabaseConfigured = () =>
  !url.includes('placeholder') && !anonKey.includes('placeholder')

let _client: ReturnType<typeof createBrowserClient> | null = null

export const createClient = () => {
  if (!_client) {
    try {
      _client = createBrowserClient(url, anonKey)
    } catch {
      _client = null as any
    }
  }
  return _client
}

export const supabase = createClient()
