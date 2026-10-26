import { supabase } from '@/lib/supabase/client'
import { getStoreId } from '@/lib/auth'

export async function reportRequest(path: string, init: RequestInit = {}) {
  if (!navigator.onLine) throw new Error('Connect to the internet before preparing a final report.')
  if (!supabase) throw new Error('The online authentication service is not configured.')
  const { data } = await supabase.auth.getSession()
  if (!data.session?.access_token) throw new Error('Please sign in again. A verified online session is required for reports.')
  const response = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init.headers, Authorization: `Bearer ${data.session.access_token}`, 'x-store-id': getStoreId() || '' },
    cache: 'no-store',
  })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'The report could not be prepared.')
  return result
}
