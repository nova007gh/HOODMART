import { createBrowserClient } from '@supabase/ssr'

const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const url = envUrl && /^https?:\/\//.test(envUrl) ? envUrl : 'https://placeholder.supabase.co'
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key'

export const isSupabaseConfigured = () =>
  !url.includes('placeholder') && !anonKey.includes('placeholder')

export const createClient = () => createBrowserClient(url, anonKey)

export const supabase = createClient()
