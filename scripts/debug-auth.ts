import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config({ path: '/Users/nova/Documents/HOTDEALSGH/newapp/.env.restore' })
const url = process.env.RESTORE_SUPABASE_URL!
const key = process.env.RESTORE_SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
async function main() {
  const { data, error } = await supabase.auth.admin.createUser({ email: 'admin@emdulab.com', password: 'Admin@2026', email_confirm: true })
  console.log('data:', data)
  console.log('error:', error)
  console.log('error type:', typeof error)
  if (error) console.log('error keys:', Object.keys(error))
}
main()
