#!/usr/bin/env node
/**
 * HOODMART Retail OS — OSPOS MySQL → Supabase Postgres importer
 *
 * Reads an OSPOS MySQL dump (.sql) and imports all data into the
 * HOODMART Supabase project, tagged with the correct store_id for
 * multi-tenant isolation.
 *
 * Usage:
 *   npx tsx scripts/import-ospos.ts <path-to-sql> <store-id> [--dry-run] [--supabase-url=...] [--service-key=...]
 *
 * The <store-id> is the UUID of the HOODMART store in the `stores` table.
 * You get this after registering the HOODMART owner account (the signup
 * trigger creates the store). Find it via:
 *   SELECT id, name, owner_email FROM stores;
 *
 * --dry-run parses and transforms the dump but does NOT insert anything.
 *   Use it to verify row counts and field mapping before the real import.
 *
 * Env vars (or flags):
 *   NEXT_PUBLIC_SUPABASE_URL   Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY  Service role key (bypasses RLS)
 */

import * as fs from 'fs'
import * as path from 'path'
import { createClient } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// Types matching the HOODMART app schema (lib/store.ts)
// ---------------------------------------------------------------------------
interface Product {
  id: string
  name: string
  price: number
  barcode?: string
  stock?: number
  minStock?: number
  category?: string
  image?: string
  cost?: number
  supplier?: string
  unit?: string
  description?: string
  expiryDate?: string
  itemNumber?: string
  costPrice?: string
  unitPrice?: string
  receivingQuantity?: number
  reorderLevel?: number
  isSerialized?: boolean
  deleted?: boolean
  discountPercent?: number
  store_id?: string
}

interface SaleRow {
  id: string
  items: any[]
  discount: number
  subtotal: number
  total: number
  timestamp: string
  customer?: string
  paymentMethod?: string
  branchId?: string
  userEmail?: string
  userName?: string
  saleTime?: string
  saleId?: string
  customerId?: string
  employeeId?: string
  comment?: string
  invoiceNumber?: string
  paymentType?: string
  store_id?: string
}

interface CustomerRow {
  id: string
  name: string
  phone: string
  purchases: number
  total: number
  personId?: string
  firstName?: string
  lastName?: string
  email?: string
  address?: string
  companyName?: string
  accountNumber?: string
  taxable?: number
  deleted?: boolean
  store_id?: string
}

interface EmployeeRow {
  id: string
  personId?: string
  username?: string
  name: string
  firstName?: string
  lastName?: string
  phone?: string
  email?: string
  role?: string
  permissions?: string[]
  deleted?: boolean
  store_id?: string
}

interface SupplierRow {
  id: string
  personId?: string
  name: string
  companyName?: string
  agencyName?: string
  accountNumber?: string
  phone?: string
  email?: string
  address?: string
  deleted?: boolean
  store_id?: string
}

interface ActivityRow {
  id: string
  itemId: string
  user: string
  date: string
  comment: string
  location: number
  quantity: number
  store_id?: string
}

interface BranchRow {
  id: string
  name: string
  location: string
  status: string
  store_id?: string
}

interface GiftCardRow {
  id: string
  code: string
  balance: number
  initialBalance: number
  status: string
  customerName?: string
  createdAt: string
  store_id?: string
}

interface AppConfigRow {
  key: string
  value: string
}

// ---------------------------------------------------------------------------
// MySQL dump parser
// ---------------------------------------------------------------------------
// Extracts INSERT INTO rows for a given table. Handles:
//   - single-row and multi-row INSERT statements
//   - escaped quotes (\\', \\", \\n, \\r, \\)
//   - NULL literals
//   - numbers, strings, booleans

function parseInserts(sql: string, table: string): any[][] {
  const rows: any[][] = []
  // Match: INSERT INTO `table` (`col1`, `col2`, ...) VALUES (...), (...), ...;
  const insertRegex = new RegExp(
    `INSERT\\s+INTO\\s+\`?${table}\`?\\s*\\(([^)]+)\\)\\s*VALUES\\s*`,
    'gi'
  )

  let m: RegExpExecArray | null
  while ((m = insertRegex.exec(sql)) !== null) {
    const cols = m[1]
      .split(',')
      .map((c) => c.trim().replace(/`/g, ''))
    const valuesStart = m.index + m[0].length

    // Parse the VALUES tuple list that follows, ending at the line that
    // starts the next statement or a semicolon followed by a newline.
    const rest = sql.slice(valuesStart)

    // We parse tuple-by-tuple with a small state machine so we don't get
    // fooled by commas/parens inside string literals.
    let i = 0
    const len = rest.length
    while (i < len) {
      // skip whitespace and leading commas
      while (i < len && (rest[i] === ' ' || rest[i] === '\t' || rest[i] === '\n' || rest[i] === '\r' || rest[i] === ',')) i++
      if (i >= len) break
      if (rest[i] === ';') break
      if (rest[i] !== '(') {
        // Not a tuple — likely end of statement
        break
      }
      i++ // consume '('
      const vals: any[] = []
      let current = ''
      let inString = false
      let stringChar = ''
      while (i < len) {
        const ch = rest[i]
        if (inString) {
          if (ch === '\\' && i + 1 < len) {
            // escape sequence
            const next = rest[i + 1]
            switch (next) {
              case 'n': current += '\n'; break
              case 'r': current += '\r'; break
              case 't': current += '\t'; break
              case '0': current += '\0'; break
              case '\\': current += '\\'; break
              case "'": current += "'"; break
              case '"': current += '"'; break
              default: current += next
            }
            i += 2
            continue
          }
          if (ch === stringChar) {
            // check for doubled quote escape ('' inside '')
            if (i + 1 < len && rest[i + 1] === stringChar) {
              current += stringChar
              i += 2
              continue
            }
            inString = false
            stringChar = ''
            i++
            continue
          }
          current += ch
          i++
          continue
        }
        // not in string
        if (ch === "'" || ch === '"') {
          inString = true
          stringChar = ch
          i++
          continue
        }
        if (ch === ',') {
          vals.push(parseScalar(current))
          current = ''
          i++
          continue
        }
        if (ch === ')') {
          vals.push(parseScalar(current))
          current = ''
          i++
          break
        }
        current += ch
        i++
      }
      if (vals.length) {
        // map to columns
        const obj: any = {}
        cols.forEach((col, idx) => {
          obj[col] = vals[idx]
        })
        rows.push(vals)
        // also stash the column-mapped object on the last element via a side map
        ;(rows as any).__mapped = (rows as any).__mapped || []
        ;(rows as any).__mapped.push(obj)
      }
      // skip trailing whitespace/commens until next tuple or semicolon
    }
  }

  // Return mapped objects if we collected them, else raw arrays
  if ((rows as any).__mapped) {
    return (rows as any).__mapped
  }
  return rows
}

function parseScalar(s: string): any {
  const t = s.trim()
  if (t === '' ) return null
  if (t.toUpperCase() === 'NULL') return null
  // string already unquoted by parser — but if it slipped through as a quoted
  // fragment, strip surrounding quotes
  if (/^-?\d+(\.\d+)?$/.test(t)) {
    return t.includes('.') ? parseFloat(t) : parseInt(t, 10)
  }
  return t
}

// Convenience: parse and return mapped objects
function table(sql: string, name: string): any[] {
  const result = parseInserts(sql, name)
  return Array.isArray(result) && result.length && typeof result[0] === 'object'
    ? result
    : []
}

// ---------------------------------------------------------------------------
// Transform: OSPOS rows → HOODMART schema rows
// ---------------------------------------------------------------------------

function buildProducts(
  items: any[],
  quantities: any[],
  taxes: any[],
  storeId: string
): Product[] {
  const qtyMap = new Map<string, number>()
  for (const q of quantities) {
    // sum across locations
    const cur = qtyMap.get(String(q.item_id)) || 0
    qtyMap.set(String(q.item_id), cur + Number(q.quantity || 0))
  }
  const taxMap = new Map<string, { name: string; rate: number }[]>()
  for (const t of taxes) {
    const arr = taxMap.get(String(t.item_id)) || []
    arr.push({ name: String(t.name || ''), rate: Number(t.percent || 0) })
    taxMap.set(String(t.item_id), arr)
  }

  return items.map((it) => {
    const id = String(it.item_id)
    const stock = qtyMap.get(id) ?? 0
    const unitPrice = Number(it.unit_price || 0)
    const costPrice = Number(it.cost_price || 0)
    return {
      id,
      name: String(it.name || ''),
      price: unitPrice,
      barcode: it.item_number ? String(it.item_number) : null,
      stock,
      minStock: Number(it.reorder_level || 0),
      category: String(it.category || ''),
      image: null,
      cost: costPrice,
      supplier: it.supplier_id ? String(it.supplier_id) : null,
      unit: 'piece',
      description: String(it.description || ''),
      itemNumber: it.item_number ? String(it.item_number) : null,
      costPrice: String(costPrice),
      unitPrice: String(unitPrice),
      receivingQuantity: Number(it.receiving_quantity || 1),
      reorderLevel: Number(it.reorder_level || 0),
      isSerialized: Number(it.is_serialized || 0) === 1,
      deleted: Number(it.deleted || 0) === 1,
      discountPercent: 0,
      store_id: storeId,
    }
  })
}

function buildCustomers(
  customers: any[],
  people: any[],
  sales: any[],
  storeId: string
): CustomerRow[] {
  const peopleMap = new Map(people.map((p) => [String(p.person_id), p]))
  // count purchases + total per customer from sales
  const stats = new Map<string, { purchases: number; total: number }>()
  for (const s of sales) {
    if (s.customer_id == null) continue
    const key = String(s.customer_id)
    const cur = stats.get(key) || { purchases: 0, total: 0 }
    cur.purchases += 1
    stats.set(key, cur)
  }

  return customers.map((c) => {
    const pid = String(c.person_id)
    const p = peopleMap.get(pid) || {}
    const first = String(p.first_name || '')
    const last = String(p.last_name || '')
    const name = [first, last].filter(Boolean).join(' ').trim() || String(c.company_name || 'Customer')
    const st = stats.get(pid) || { purchases: 0, total: 0 }
    return {
      id: pid,
      name,
      phone: String(p.phone_number || ''),
      purchases: st.purchases,
      total: st.total,
      personId: pid,
      firstName: first,
      lastName: last,
      email: String(p.email || ''),
      address: [p.address_1, p.address_2, p.city, p.state].filter(Boolean).join(', '),
      companyName: c.company_name ? String(c.company_name) : null,
      accountNumber: c.account_number ? String(c.account_number) : null,
      taxable: Number(c.taxable ?? 1),
      deleted: Number(c.deleted || 0) === 1,
      store_id: storeId,
    }
  })
}

function buildEmployees(
  employees: any[],
  people: any[],
  grants: any[],
  storeId: string
): EmployeeRow[] {
  const peopleMap = new Map(people.map((p) => [String(p.person_id), p]))
  // collect permission_ids per user (by person_id via grants? OSPOS grants are
  // role-based on modules, not per-user. We grant a sensible default set.)
  return employees.map((e) => {
    const pid = String(e.person_id)
    const p = peopleMap.get(pid) || {}
    const first = String(p.first_name || '')
    const last = String(p.last_name || '')
    const name = [first, last].filter(Boolean).join(' ').trim() || String(e.username || 'Employee')
    return {
      id: pid,
      personId: pid,
      username: String(e.username || ''),
      name,
      firstName: first,
      lastName: last,
      phone: String(p.phone_number || ''),
      email: String(p.email || ''),
      role: e.username === 'admin' ? 'admin' : 'cashier',
      permissions: e.username === 'admin'
        ? ['products', 'sales', 'reports', 'inventory', 'customers', 'employees', 'suppliers', 'settings', 'discounts']
        : ['sales', 'products', 'customers'],
      deleted: Number(e.deleted || 0) === 1,
      store_id: storeId,
    }
  })
}

function buildSuppliers(
  suppliers: any[],
  people: any[],
  storeId: string
): SupplierRow[] {
  const peopleMap = new Map(people.map((p) => [String(p.person_id), p]))
  return suppliers.map((s) => {
    const pid = String(s.person_id)
    const p = peopleMap.get(pid) || {}
    const name = String(s.company_name || s.agency_name || p.first_name || 'Supplier')
    return {
      id: pid,
      personId: pid,
      name,
      companyName: s.company_name ? String(s.company_name) : null,
      agencyName: s.agency_name ? String(s.agency_name) : null,
      accountNumber: s.account_number ? String(s.account_number) : null,
      phone: String(p.phone_number || ''),
      email: String(p.email || ''),
      address: [p.address_1, p.address_2, p.city, p.state].filter(Boolean).join(', '),
      deleted: Number(s.deleted || 0) === 1,
      store_id: storeId,
    }
  })
}

function buildActivities(inventory: any[], storeId: string): ActivityRow[] {
  return inventory.map((inv) => ({
    id: String(inv.trans_id),
    itemId: String(inv.trans_items || ''),
    user: String(inv.trans_user || ''),
    date: String(inv.trans_date || ''),
    comment: String(inv.trans_comment || ''),
    location: Number(inv.trans_location || 1),
    quantity: Number(inv.trans_inventory || 0),
    store_id: storeId,
  }))
}

function buildBranches(stockLocations: any[], storeId: string): BranchRow[] {
  return stockLocations.map((sl) => ({
    id: String(sl.location_id),
    name: String(sl.location_name || 'Main'),
    location: String(sl.location_name || 'Main'),
    status: Number(sl.deleted || 0) === 1 ? 'inactive' : 'active',
    store_id: storeId,
  }))
}

function buildSales(
  sales: any[],
  salesItems: any[],
  salesPayments: any[],
  products: Product[],
  employees: EmployeeRow[],
  customers: CustomerRow[],
  storeId: string
): SaleRow[] {
  const itemsBySale = new Map<string, any[]>()
  for (const si of salesItems) {
    const key = String(si.sale_id)
    const arr = itemsBySale.get(key) || []
    arr.push(si)
    itemsBySale.set(key, arr)
  }
  const paymentsBySale = new Map<string, any[]>()
  for (const sp of salesPayments) {
    const key = String(sp.sale_id)
    const arr = paymentsBySale.get(key) || []
    arr.push(sp)
    paymentsBySale.set(key, arr)
  }
  const productMap = new Map(products.map((p) => [p.id, p]))
  const employeeMap = new Map(employees.map((e) => [e.id, e]))
  const customerMap = new Map(customers.map((c) => [c.id, c]))

  return sales.map((s) => {
    const sid = String(s.sale_id)
    const items = (itemsBySale.get(sid) || []).map((si) => {
      const prod = productMap.get(String(si.item_id))
      return {
        id: String(si.item_id),
        name: prod?.name || '',
        price: Number(si.item_unit_price || 0),
        cost: Number(si.item_cost_price || 0),
        barcode: prod?.barcode || undefined,
        category: prod?.category || undefined,
        qty: Number(si.quantity_purchased || 0),
        discountPercent: Number(si.discount_percent || 0),
      }
    })
    const payments = paymentsBySale.get(sid) || []
    const total = payments.reduce((sum, p) => sum + Number(p.payment_amount || 0), 0)
    const subtotal = items.reduce(
      (sum, it) => sum + it.price * it.qty * (1 - (it.discountPercent || 0) / 100),
      0
    )
    const emp = employeeMap.get(String(s.employee_id))
    const cust = s.customer_id ? customerMap.get(String(s.customer_id)) : undefined
    const paymentType = payments[0]?.payment_type || 'Cash'
    return {
      id: sid,
      items,
      discount: 0,
      subtotal: Math.round(subtotal * 100) / 100,
      total: Math.round(total * 100) / 100,
      timestamp: String(s.sale_time || ''),
      customer: cust?.name || '',
      paymentMethod: paymentType.toLowerCase().includes('cash') ? 'cash'
        : paymentType.toLowerCase().includes('card') ? 'card'
        : paymentType.toLowerCase().includes('mobile') ? 'mobile'
        : 'cash',
      saleTime: String(s.sale_time || ''),
      saleId: sid,
      customerId: s.customer_id ? String(s.customer_id) : null,
      employeeId: String(s.employee_id || ''),
      userEmail: emp?.email || '',
      userName: emp?.name || '',
      comment: String(s.comment || ''),
      invoiceNumber: s.invoice_number ? String(s.invoice_number) : null,
      paymentType,
      store_id: storeId,
    }
  })
}

function buildGiftCards(giftcards: any[], people: any[], storeId: string): GiftCardRow[] {
  const peopleMap = new Map(people.map((p) => [String(p.person_id), p]))
  return giftcards.map((g) => {
    const p = g.person_id ? peopleMap.get(String(g.person_id)) : undefined
    return {
      id: String(g.giftcard_id),
      code: String(g.giftcard_number),
      balance: Number(g.value || 0),
      initialBalance: Number(g.value || 0),
      status: Number(g.deleted || 0) === 1 ? 'disabled' : 'active',
      customerName: p ? `${p.first_name || ''} ${p.last_name || ''}`.trim() : undefined,
      createdAt: String(g.record_time || ''),
      store_id: storeId,
    }
  })
}

function buildAppConfig(configRows: any[]): AppConfigRow[] {
  return configRows.map((r) => ({
    key: String(r.key),
    value: String(r.value),
  }))
}

// ---------------------------------------------------------------------------
// Insert into Supabase
// ---------------------------------------------------------------------------

async function insertAll(
  admin: any,
  data: {
    products: Product[]
    customers: CustomerRow[]
    employees: EmployeeRow[]
    suppliers: SupplierRow[]
    activities: ActivityRow[]
    branches: BranchRow[]
    sales: SaleRow[]
    giftCards: GiftCardRow[]
    appConfig: AppConfigRow[]
  }
) {
  const tables: [string, any[], string][] = [
    ['app_config', data.appConfig, 'key'],
    ['branches', data.branches, 'id'],
    ['suppliers', data.suppliers, 'id'],
    ['customers', data.customers, 'id'],
    ['employees', data.employees, 'id'],
    ['products', data.products, 'id'],
    ['activities', data.activities, 'id'],
    ['gift_cards', data.giftCards, 'id'],
    ['sales', data.sales, 'id'],
  ]

  for (const [table, rows, conflictCol] of tables) {
    if (!rows.length) {
      console.log(`  ${table}: 0 rows (skipped)`)
      continue
    }
    // Insert in batches of 200 to avoid payload limits
    const BATCH = 200
    let inserted = 0
    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH)
      const { error } = await admin.from(table).upsert(batch, { onConflict: conflictCol })
      if (error) throw new Error(`Insert into ${table} failed at batch ${i}: ${error.message}`)
      inserted += batch.length
    }
    console.log(`  ${table}: ${inserted} rows ✓`)
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2)
  const sqlPath = args.find((a) => !a.startsWith('--') && !a.includes('='))
  const storeIdArg = args.find((a) => !a.startsWith('--') && a !== sqlPath)
  const dryRun = args.includes('--dry-run')

  const flagArgs = Object.fromEntries(
    args.filter((a) => a.includes('=') && a.startsWith('--')).map((a) => {
      const [k, ...v] = a.slice(2).split('=')
      return [k, v.join('=')]
    })
  )

  const supabaseUrl = flagArgs['supabase-url'] || process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = flagArgs['service-key'] || process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!sqlPath || !storeIdArg) {
    console.error('Usage: npx tsx scripts/import-ospos.ts <path-to-sql> <store-id> [--dry-run] [--supabase-url=...] [--service-key=...]')
    process.exit(1)
  }

  if (!fs.existsSync(sqlPath)) {
    console.error(`SQL file not found: ${sqlPath}`)
    process.exit(1)
  }

  const storeId = storeIdArg
  // validate UUID
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(storeId)) {
    console.error(`Invalid store_id UUID: ${storeId}`)
    console.error('Find it via: SELECT id, name, owner_email FROM stores;')
    process.exit(1)
  }

  console.log(`\n=== HOODMART OSPOS Import ===`)
  console.log(`SQL file:  ${sqlPath}`)
  console.log(`Store ID:  ${storeId}`)
  console.log(`Mode:      ${dryRun ? 'DRY RUN (no inserts)' : 'LIVE INSERT'}\n`)

  console.log('Reading SQL dump...')
  const sql = fs.readFileSync(sqlPath, 'utf8')
  console.log(`  ${(sql.length / 1024 / 1024).toFixed(1)} MB read\n`)

  console.log('Parsing OSPOS tables...')
  const items = table(sql, 'ospos_items')
  const itemQuantities = table(sql, 'ospos_item_quantities')
  const itemsTaxes = table(sql, 'ospos_items_taxes')
  const customers = table(sql, 'ospos_customers')
  const employees = table(sql, 'ospos_employees')
  const suppliers = table(sql, 'ospos_suppliers')
  const people = table(sql, 'ospos_people')
  const inventory = table(sql, 'ospos_inventory')
  const stockLocations = table(sql, 'ospos_stock_locations')
  const sales = table(sql, 'ospos_sales')
  const salesItems = table(sql, 'ospos_sales_items')
  const salesPayments = table(sql, 'ospos_sales_payments')
  const giftcards = table(sql, 'ospos_giftcards')
  const appConfig = table(sql, 'ospos_app_config')

  console.log(`  ospos_items:              ${items.length}`)
  console.log(`  ospos_item_quantities:    ${itemQuantities.length}`)
  console.log(`  ospos_items_taxes:        ${itemsTaxes.length}`)
  console.log(`  ospos_customers:          ${customers.length}`)
  console.log(`  ospos_employees:          ${employees.length}`)
  console.log(`  ospos_suppliers:          ${suppliers.length}`)
  console.log(`  ospos_people:             ${people.length}`)
  console.log(`  ospos_inventory:          ${inventory.length}`)
  console.log(`  ospos_stock_locations:    ${stockLocations.length}`)
  console.log(`  ospos_sales:              ${sales.length}`)
  console.log(`  ospos_sales_items:        ${salesItems.length}`)
  console.log(`  ospos_sales_payments:     ${salesPayments.length}`)
  console.log(`  ospos_giftcards:          ${giftcards.length}`)
  console.log(`  ospos_app_config:         ${appConfig.length}\n`)

  console.log('Transforming to HOODMART schema...')
  const products = buildProducts(items, itemQuantities, itemsTaxes, storeId)
  const customerRows = buildCustomers(customers, people, sales, storeId)
  const employeeRows = buildEmployees(employees, people, [], storeId)
  const supplierRows = buildSuppliers(suppliers, people, storeId)
  const activityRows = buildActivities(inventory, storeId)
  const branchRows = buildBranches(stockLocations, storeId)
  const saleRows = buildSales(sales, salesItems, salesPayments, products, employeeRows, customerRows, storeId)
  const giftCardRows = buildGiftCards(giftcards, people, storeId)
  const appConfigRows = buildAppConfig(appConfig)

  console.log(`  products:    ${products.length}`)
  console.log(`  customers:   ${customerRows.length}`)
  console.log(`  employees:   ${employeeRows.length}`)
  console.log(`  suppliers:   ${supplierRows.length}`)
  console.log(`  activities:  ${activityRows.length}`)
  console.log(`  branches:    ${branchRows.length}`)
  console.log(`  sales:       ${saleRows.length}`)
  console.log(`  gift_cards:  ${giftCardRows.length}`)
  console.log(`  app_config:  ${appConfigRows.length}\n`)

  // Sample preview
  console.log('Sample product:')
  console.log(JSON.stringify(products[0], null, 2))
  console.log('\nSample sale:')
  console.log(JSON.stringify({ ...saleRows[0], items: saleRows[0].items.slice(0, 2) }, null, 2))
  console.log('')

  if (dryRun) {
    console.log('=== DRY RUN COMPLETE — no data was inserted ===\n')
    return
  }

  if (!supabaseUrl || !serviceKey || supabaseUrl.includes('placeholder')) {
    console.error('Cannot insert: missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    console.error('Set them in .env.local or pass via --supabase-url=... --service-key=...')
    process.exit(1)
  }

  console.log('Connecting to Supabase...')
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Verify the store exists
  const { data: store, error: storeErr } = await admin
    .from('stores')
    .select('id, name, owner_email')
    .eq('id', storeId)
    .single()
  if (storeErr || !store) {
    console.error(`Store ${storeId} not found in Supabase. Create the owner account first so the signup trigger creates the store.`)
    process.exit(1)
  }
  console.log(`  Found store: ${store.name} (${store.owner_email})\n`)

  console.log('Inserting data...')
  await insertAll(admin, {
    products,
    customers: customerRows,
    employees: employeeRows,
    suppliers: supplierRows,
    activities: activityRows,
    branches: branchRows,
    sales: saleRows,
    giftCards: giftCardRows,
    appConfig: appConfigRows,
  })

  console.log('\n=== IMPORT COMPLETE ===')
  console.log('All HOODMART POS data has been migrated to Supabase.')
  console.log('The client can now log in and see their full history.\n')
}

main().catch((err) => {
  console.error('\nIMPORT FAILED:')
  console.error(err)
  process.exit(1)
})
