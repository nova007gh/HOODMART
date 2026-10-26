import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'

dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceRoleKey) {
  console.error('Missing env vars')
  process.exit(1)
}

const admin = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const HOODMART_STORE_ID = 'f4c6ecf8-9956-4dfd-9404-b9b81cae5c4d'

const TABLES = [
  'app_config',
  'branches',
  'customers',
  'discounts',
  'employees',
  'expenses',
  'gift_cards',
  'payments',
  'platform_admins',
  'products',
  'quotations',
  'sales',
  'store_members',
  'stores',
  'suppliers',
]

async function main() {
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, -1)

  console.log('=== HOODMART Sales Today ===')
  console.log('From:', todayStart.toISOString())
  console.log('To:', todayEnd.toISOString())
  console.log()

  const { data: store, error: storeErr } = await admin
    .from('stores')
    .select('id, name')
    .eq('id', HOODMART_STORE_ID)
    .single()

  if (storeErr || !store) {
    console.error('Store error:', storeErr?.message || 'Not found')
    process.exit(1)
  }

  console.log('Store:', store.name, '(', store.id, ')')

  const { data: sales, error: salesErr } = await admin
    .from('sales')
    .select('*')
    .eq('store_id', store.id)
    .gte('updated_at', todayStart.toISOString())
    .lte('updated_at', todayEnd.toISOString())
    .order('updated_at', { ascending: false })

  if (salesErr) {
    console.error('Sales error:', salesErr.message)
    process.exit(1)
  }

  if (!sales || sales.length === 0) {
    console.log('No sales today.')
  } else {
    let totalRevenue = 0
    const cashierMap: Record<string, { count: number; revenue: number }> = {}

    for (const sale of sales) {
      const amount = Number(sale.total) || 0
      totalRevenue += amount
      const cashier = sale.userName || sale.userEmail || sale.employeeId || 'Unknown'
      if (!cashierMap[cashier]) cashierMap[cashier] = { count: 0, revenue: 0 }
      cashierMap[cashier].count++
      cashierMap[cashier].revenue += amount
      console.log(`  #${sale.saleId || sale.id.slice(0, 8)} | ${sale.saleTime || sale.updated_at} | GHS ${amount} | ${cashier}`)
    }

    console.log('\nTotal revenue today: GHS', totalRevenue.toFixed(2))
    console.log('Total transactions:', sales.length)
    console.log('\nWho is selling today:')
    for (const [cashier, info] of Object.entries(cashierMap)) {
      console.log(`  ${cashier}: ${info.count} sales, GHS ${info.revenue.toFixed(2)}`)
    }
  }

  console.log('\n=== POS Database Backup ===')
  const timestamp = now.toISOString().replace(/:/g, '-').split('.')[0]
  const backupDir = path.resolve(__dirname, `../backups/hoodmart-backup-${timestamp}`)
  fs.mkdirSync(backupDir, { recursive: true })

  for (const table of TABLES) {
    const { data, error } = await admin.from(table).select('*')
    if (error) {
      console.log(`  [${table}] error:`, error.message)
    } else {
      const file = path.join(backupDir, `${table}.json`)
      fs.writeFileSync(file, JSON.stringify(data || [], null, 2))
      console.log(`  [${table}] saved ${(data || []).length} rows to ${file}`)
    }
  }

  console.log('\nBackup complete at:', backupDir)
}

main().then(() => process.exit(0))
