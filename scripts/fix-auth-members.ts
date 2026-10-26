import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'

dotenv.config({ path: path.resolve(process.cwd(), '.env.restore') })

const url = process.env.RESTORE_SUPABASE_URL
const serviceRole = process.env.RESTORE_SUPABASE_SERVICE_ROLE_KEY
const tempPassword = process.env.RESTORE_TEMP_PASSWORD

if (!url || !serviceRole || !tempPassword) {
  console.error('Missing RESTORE_SUPABASE_URL, RESTORE_SUPABASE_SERVICE_ROLE_KEY, or RESTORE_TEMP_PASSWORD in .env.restore')
  process.exit(1)
}

const supabase = createClient(url, serviceRole, { auth: { autoRefreshToken: false, persistSession: false } })

const BACKUP_DIR = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve(process.cwd(), 'backups/hoodmart-backup-2026-09-10T15-40-31')

function loadJSON(name: string) {
  const p = path.join(BACKUP_DIR, `${name}.json`)
  if (!fs.existsSync(p)) return []
  return JSON.parse(fs.readFileSync(p, 'utf8'))
}

async function listExistingUsers() {
  const { data, error } = await supabase.auth.admin.listUsers()
  if (error || !data) {
    console.warn('Could not list existing users:', error?.message)
    return {}
  }
  return Object.fromEntries(data.users.map((u: any) => [u.email?.toLowerCase(), u.id]))
}

async function ensureUser(
  email: string,
  metadata: { is_employee: boolean; store_id: string; role: string; permissions: string[] }
) {
  const normalized = email.toLowerCase()

  const existing = (await listExistingUsers())[normalized]
  if (existing) {
    console.log(`  [auth] existing user ${normalized} -> ${existing}`)
    return existing
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email: normalized,
    password: tempPassword as string,
    email_confirm: true,
    user_metadata: metadata,
  })

  if (error || !data.user) {
    console.error(`  [auth] error creating ${normalized}:`, error?.message || JSON.stringify(error))
    return null
  }

  console.log(`  [auth] created user ${normalized} -> ${data.user.id}`)
  return data.user.id
}

async function main() {
  const stores = loadJSON('stores')
  const employees = loadJSON('employees')
  const platformAdmins = loadJSON('platform_admins')

  const emailToUserId: Record<string, string> = {}

  console.log('=== Creating owner users ===')
  for (const store of stores) {
    if (store.owner_email && !emailToUserId[store.owner_email]) {
      const id = await ensureUser(store.owner_email, {
        is_employee: true,
        store_id: store.id,
        role: 'admin',
        permissions: ['*'],
      })
      if (id) emailToUserId[store.owner_email] = id
    }
  }

  console.log('=== Creating employee users ===')
  for (const emp of employees) {
    if (emp.email && !emailToUserId[emp.email]) {
      const id = await ensureUser(emp.email, {
        is_employee: true,
        store_id: emp.store_id,
        role: emp.role || 'cashier',
        permissions: emp.permissions || [],
      })
      if (id) emailToUserId[emp.email] = id
    }
  }

  console.log('=== Creating platform admin users ===')
  for (const pa of platformAdmins) {
    if (pa.email && !emailToUserId[pa.email]) {
      const store = stores.find((s: any) => s.owner_email === pa.email)
      const id = await ensureUser(pa.email, {
        is_employee: true,
        store_id: store?.id || stores[0]?.id,
        role: 'admin',
        permissions: ['*'],
      })
      if (id) emailToUserId[pa.email] = id
    }
  }

  console.log('=== Upserting platform_admins ===')
  const paRows = platformAdmins
    .map((pa: any) => ({
      ...pa,
      user_id: emailToUserId[pa.email] || pa.user_id,
    }))
    .filter((pa: any) => pa.user_id && pa.email)

  if (paRows.length) {
    const { error } = await supabase.from('platform_admins').upsert(paRows, { onConflict: 'user_id' })
    if (error) console.error('  [platform_admins] error:', error.message)
    else console.log('  [platform_admins] upserted', paRows.length)
  } else {
    console.log('  [platform_admins] nothing to insert')
  }

  console.log('=== Upserting app_config ===')
  const appConfig = loadJSON('app_config')
  if (appConfig.length) {
    const { error: configErr } = await supabase.from('app_config').upsert(appConfig, { onConflict: 'key' })
    if (configErr) console.error('  [app_config] error:', configErr.message)
    else console.log('  [app_config] upserted', appConfig.length)
  }

  console.log('=== Done ===')
  console.log('You can now log in with the restored emails using the temp password from .env.restore.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
