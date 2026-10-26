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

const BACKUP_DIR = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve(__dirname, '../backups/hoodmart-backup-2026-09-10T15-40-31')

function loadJSON(name: string) {
  const p = path.join(BACKUP_DIR, `${name}.json`)
  if (!fs.existsSync(p)) return []
  return JSON.parse(fs.readFileSync(p, 'utf8'))
}

async function createUser(email: string) {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: tempPassword as string,
    email_confirm: true,
  })
  if (error) {
    if (error.message.includes('already')) {
      const { data: list } = await supabase.auth.admin.listUsers()
      const found = list?.users.find((u: any) => u.email === email)
      if (found) {
        console.log(`  [auth] found existing user ${email} -> ${found.id}`)
        return found.id
      }
    }
    console.error(`  [auth] error creating ${email}:`, error.message)
    return null
  }
  console.log(`  [auth] created user ${email} -> ${data.user.id}`)
  return data.user.id
}

async function insertInChunks(table: string, rows: any[], size: number) {
  for (let i = 0; i < rows.length; i += size) {
    const chunk = rows.slice(i, i + size)
    const { error } = await supabase.from(table).insert(chunk)
    if (error) {
      console.error(`  [${table}] chunk ${i} error:`, error.message)
    } else {
      console.log(`  [${table}] inserted ${Math.min(i + size, rows.length)} / ${rows.length}`)
    }
  }
}

async function main() {
  const stores = loadJSON('stores')
  const employees = loadJSON('employees')
  const platformAdmins = loadJSON('platform_admins')
  const emailToUserId: Record<string, string> = {}

  console.log('=== Creating auth users ===')
  for (const store of stores) {
    if (store.owner_email && !emailToUserId[store.owner_email]) {
      const id = await createUser(store.owner_email)
      if (id) emailToUserId[store.owner_email] = id
    }
  }
  for (const emp of employees) {
    if (emp.email && !emailToUserId[emp.email]) {
      const id = await createUser(emp.email)
      if (id) emailToUserId[emp.email] = id
    }
  }
  for (const pa of platformAdmins) {
    if (pa.email && !emailToUserId[pa.email]) {
      const id = await createUser(pa.email)
      if (id) emailToUserId[pa.email] = id
    }
  }

  console.log('=== Inserting stores ===')
  const { error: storesErr } = await supabase.from('stores').insert(stores)
  if (storesErr) console.error('  [stores] error:', storesErr.message)
  else console.log('  [stores] inserted', stores.length)

  const members: any[] = []
  for (const store of stores) {
    const ownerId = emailToUserId[store.owner_email]
    if (ownerId) members.push({ store_id: store.id, user_id: ownerId, role: 'admin', permissions: ['*'] })
  }
  for (const emp of employees) {
    const uid = emailToUserId[emp.email]
    if (uid) {
      const permissions = emp.role === 'admin' ? ['*'] : ['process_sales', 'manage_customers', 'manage_expenses']
      members.push({ store_id: emp.store_id, user_id: uid, role: emp.role, permissions })
    }
  }

  console.log('=== Inserting store_members ===')
  const { error: membersErr } = await supabase.from('store_members').insert(members)
  if (membersErr) console.error('  [store_members] error:', membersErr.message)
  else console.log('  [store_members] inserted', members.length)

  const tables = [
    'app_config', 'branches', 'customers', 'suppliers', 'employees', 'products',
    'discounts', 'expenses', 'gift_cards', 'quotations', 'sales', 'payments'
  ]
  for (const table of tables) {
    const rows = loadJSON(table)
    if (!rows.length) continue
    console.log(`=== Inserting ${table} (${rows.length} rows) ===`)
    if (table === 'sales' || table === 'products') {
      await insertInChunks(table, rows, 200)
    } else {
      const { error } = await supabase.from(table).insert(rows)
      if (error) console.error(`  [${table}] error:`, error.message)
      else console.log(`  [${table}] inserted`, rows.length)
    }
  }

  const paRows = platformAdmins.map((pa: any) => ({ ...pa, user_id: emailToUserId[pa.email] || pa.user_id })).filter((pa: any) => pa.user_id)
  if (paRows.length) {
    console.log('=== Inserting platform_admins ===')
    const { error } = await supabase.from('platform_admins').insert(paRows)
    if (error) console.error('  [platform_admins] error:', error.message)
    else console.log('  [platform_admins] inserted', paRows.length)
  }

  console.log('=== Done ===')
  console.log('You can log in with the following emails using the temp password from .env.restore:')
  console.log(Object.keys(emailToUserId).join('\n'))
}

main().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1) })
