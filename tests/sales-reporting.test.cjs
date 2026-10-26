const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')

function load(file, dependencies = {}) {
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8')
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText
  const module = { exports: {} }
  new Function('require', 'module', 'exports', compiled)(name => {
    if (name in dependencies) return dependencies[name]
    throw new Error(`Unexpected dependency: ${name}`)
  }, module, module.exports)
  return module.exports
}
const summary = load('lib/reporting/summary.ts')
const storeId = '11111111-1111-4111-8111-111111111111'
const cashier = { id: 'cashier-id', email: 'cashier@example.test', user_metadata: { name: 'Test Cashier' } }
const sale = (overrides = {}) => ({ id: 'sale-1', store_id: storeId, timestamp: new Date().toISOString(), total: 14.5, subtotal: 15, discount: .5, userEmail: cashier.email, userName: 'Test Cashier', items: [{ id: 'water', name: 'Water', qty: 2, price: 7.25 }], ...overrides })

// In-memory query implementation: no database, auth or SMS network calls.
class Query {
  constructor(db, table) { this.db = db; this.table = table; this.filters = []; this.orders = []; this.action = 'read'; this.bounds = null }
  select() { return this }
  eq(key, value) { this.filters.push(row => row[key] === value); return this }
  gte(key, value) { this.filters.push(row => row[key] >= value); return this }
  lte(key, value) { this.filters.push(row => row[key] <= value); return this }
  lt(key, value) { this.filters.push(row => row[key] < value); return this }
  ilike(key, value) { this.filters.push(row => String(row[key] || '').toLowerCase() === value.replace(/\\/g, '').toLowerCase()); return this }
  order(key, options) { this.orders.push([key, options?.ascending !== false]); return this }
  range(start, end) { this.bounds = [start, end + 1]; return this }
  limit(n) { this.bounds = [0, n]; return this }
  insert(value) { this.action = 'insert'; this.value = value; return this }
  upsert(value, options) { this.action = 'upsert'; this.value = value; this.options = options; return this }
  update(value) { this.action = 'update'; this.value = value; return this }
  maybeSingle() { this.singleRow = true; return this }
  single() { this.singleRow = true; return this }
  then(resolve, reject) {
    const result = this.run()
    return Promise.resolve(result).then(resolve, reject)
  }
  run() {
    this.db.reads++
    if (!this.db.tables[this.table]) return { data: null, error: { code: '42P01', message: 'table missing' } }
    let rows = this.db.tables[this.table]
    if (this.action === 'insert' || this.action === 'upsert') {
      const duplicate = rows.find(row => this.table === 'cashier_day_closes'
        ? row.store_id === this.value.store_id && row.user_id === this.value.user_id && row.business_date === this.value.business_date
        : this.table === 'sms_report_outbox' ? row.store_id === this.value.store_id && row.dedupe_key === this.value.dedupe_key : row.store_id === this.value.store_id)
      if (duplicate) {
        if (this.action === 'insert') return { data: null, error: { code: '23505' } }
        if (!this.options?.ignoreDuplicates) Object.assign(duplicate, this.value)
        rows = [duplicate]
      } else {
        const row = { id: `${this.table}-${this.db.reads}`, status: 'queued', created_at: new Date().toISOString(), ...this.value }
        rows.push(row); rows = [row]
      }
    } else {
      rows = rows.filter(row => this.filters.every(filter => filter(row)))
      if (this.action === 'update') rows.forEach(row => Object.assign(row, this.value))
    }
    rows = [...rows].sort((a, b) => { for (const [key, asc] of this.orders) { if (a[key] !== b[key]) return (a[key] > b[key] ? 1 : -1) * (asc ? 1 : -1) } return 0 })
    if (this.bounds) rows = rows.slice(...this.bounds)
    return { data: structuredClone(this.singleRow ? rows[0] || null : rows), error: null }
  }
}
function setup(role = 'cashier') {
  const db = {
    reads: 0,
    tables: { sales: [], activities: [], store_members: [{ store_id: storeId, user_id: cashier.id, role, permissions: role === 'admin' ? ['*'] : ['process_sales'] }], cashier_day_closes: [], sms_report_settings: [], sms_report_outbox: [] },
    from(table) { return new Query(this, table === 'sales_report_source' ? 'sales' : table) },
    auth: { async getUser(token) { return token === 'valid-token' ? { data: { user: cashier }, error: null } : { data: {}, error: { message: 'Invalid token' } } } },
  }
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.test'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key-not-a-real-secret'
  const server = load('lib/reporting/server.ts', { '@supabase/supabase-js': { createClient: () => db } })
  const sms = load('lib/reporting/sms.ts', { './server': server })
  const dependencies = { '@/lib/reporting/server': server, '@/lib/reporting/summary': summary, '@/lib/reporting/sms': sms }
  const closes = load('app/api/reports/close-day/route.ts', dependencies)
  const settings = load('app/api/reports/sms-settings/route.ts', dependencies)
  const request = (body, headers = {}) => new Request('https://example.test/api/reports', { method: body ? 'POST' : 'GET', headers: { Authorization: 'Bearer valid-token', 'x-store-id': storeId, 'Content-Type': 'application/json', ...headers }, ...(body ? { body: JSON.stringify(body) } : {}) })
  return { db, server, sms, closes, settings, request, dependencies }
}

test('accurate cents, quantities, email identities and best item across more than 1,000 sales', async () => {
  const ctx = setup()
  ctx.db.tables.sales = Array.from({ length: 2005 }, (_, i) => sale({ id: String(i), total: .1, discount: 0 }))
  const rows = await ctx.server.readSales(ctx.db, storeId, '1970-01-01', '2999-01-01')
  assert.equal(rows.length, 2005)
  const report = summary.summarizeSales(rows)
  assert.equal(report.revenue, 200.5)
  assert.equal(report.items, 4010)
  assert.deepEqual(report.bestItem, { name: 'Water', quantity: 4010 })
  assert.equal(report.staff.length, 1)
})

test('daily and monthly reports remain one basic-GSM segment even with Unicode names', () => {
  const report = summary.summarizeSales([sale({ items: [{ id: 'x', name: '🥛 Éléphant [milk] € '.repeat(30), qty: 12345 }] })])
  for (const kind of ['daily', 'monthly']) {
    const sms = summary.reportSMS(kind, kind === 'daily' ? '2026-10-26' : '2026-10', report, '🥰 Eunice € [Test] '.repeat(10))
    assert.ok(sms.length <= 160)
    assert.match(sms, /^[a-zA-Z0-9 .,:;/()'-]+$/)
    assert.match(sms, /GHS 14.50/)
  }
})

test('Ghana day and previous calendar month use UTC boundaries, including year change', () => {
  assert.equal(summary.ghanaDay(new Date('2026-10-26T23:59:59Z')).date, '2026-10-26')
  assert.deepEqual(summary.previousMonth(new Date('2027-01-01T08:00:00Z')), { period: '2026-12', start: '2026-12-01T00:00:00.000Z', end: '2027-01-01T00:00:00.000Z' })
  assert.equal(summary.previousMonth(new Date('2028-03-01T08:00:00Z')).start, '2028-02-01T00:00:00.000Z')
  assert.equal(summary.normalizeGhanaPhone('+233 24 123 4567'), '233241234567')
  assert.equal(summary.normalizeGhanaPhone('0241234567'), '233241234567')
  assert.equal(summary.normalizeGhanaPhone('123'), null)
})

test('reports reject missing JWT, expired token, another store and non-admin settings access', async () => {
  const ctx = setup()
  assert.equal((await ctx.closes.GET(ctx.request(null, { Authorization: '' }))).status, 401)
  assert.equal(ctx.db.reads, 0)
  assert.equal((await ctx.closes.GET(ctx.request(null, { Authorization: 'Bearer invalid' }))).status, 401)
  assert.equal((await ctx.closes.GET(ctx.request(null, { 'x-store-id': '22222222-2222-4222-8222-222222222222' }))).status, 403)
  assert.equal((await ctx.settings.GET(ctx.request())).status, 403)
})

test('daily close uses only own server sales and ignores forged totals; repeat/concurrent clicks save one snapshot', async () => {
  const ctx = setup()
  ctx.db.tables.sales = [sale(), sale({ id: 'other', total: 9999, userEmail: 'other@example.test' })]
  const body = { date: summary.ghanaDay().date, total: 100000, userEmail: 'other@example.test' }
  const responses = await Promise.all([ctx.closes.POST(ctx.request(body)), ctx.closes.POST(ctx.request(body))])
  for (const response of responses) {
    assert.equal(response.status, 200)
    const result = await response.json()
    assert.equal(result.report.revenue, 14.5)
    assert.equal(result.report.transactions, 1)
    assert.equal(result.sms, 'disabled')
  }
  assert.equal(ctx.db.tables.cashier_day_closes.length, 1)
  assert.equal(ctx.db.tables.sales.length, 2)
  ctx.db.tables.sales.push(sale({ id: 'late', total: 20 }))
  const repeat = await (await ctx.closes.POST(ctx.request(body))).json()
  assert.equal(repeat.report.revenue, 14.5)
  assert.equal((await ctx.closes.POST(ctx.request({ date: '2020-01-01' }))).status, 400)
})

test('missing schema fails clearly without changing sales or claiming a zero close', async () => {
  const ctx = setup()
  delete ctx.db.tables.cashier_day_closes
  ctx.db.tables.sales.push(sale())
  assert.equal((await ctx.closes.GET(ctx.request())).status, 503)
  assert.equal(ctx.db.tables.sales.length, 1)
})

test('BMS accepts exactly one campaign despite repeated requests; API key stays server-side', async () => {
  const ctx = setup('admin')
  process.env.BMS_SMS_API_KEY = 'test-provider-key'
  process.env.BMS_SMS_SENDER = 'HOODMART'
  ctx.db.tables.sms_report_settings.push({ store_id: storeId, enabled: true, daily_enabled: true, monthly_enabled: true, phone: '233241234567' })
  let calls = 0
  const originalFetch = global.fetch
  global.fetch = async (url, init) => {
    calls++
    assert.equal(url.origin, 'https://api.mnotify.com')
    const payload = JSON.parse(init.body)
    assert.equal(payload.sms_type, undefined)
    assert.ok(payload.message.length <= 160)
    return Response.json({ status: 'success', code: '2000', summary: { _id: 'campaign-1', total_sent: 1, total_rejected: 0 } })
  }
  try {
    const result = await Promise.all([ctx.sms.queueSMS(ctx.db, storeId, 'daily:test', 'daily', 'HOODMART daily test'), ctx.sms.queueSMS(ctx.db, storeId, 'daily:test', 'daily', 'HOODMART daily test')])
    assert.ok(result.includes('accepted'))
    assert.equal(calls, 1)
    assert.equal(ctx.db.tables.sms_report_outbox.length, 1)
    assert.equal(ctx.db.tables.sms_report_outbox[0].provider_id, 'campaign-1')
    assert.equal(await ctx.sms.queueSMS(ctx.db, storeId, 'daily:test', 'daily', 'HOODMART daily test'), 'accepted')
    assert.equal(calls, 1)
  } finally { global.fetch = originalFetch; delete process.env.BMS_SMS_API_KEY; delete process.env.BMS_SMS_SENDER }
})

test('ambiguous provider failure is not automatically resent and admin switch prevents new sends', async () => {
  const ctx = setup('admin')
  process.env.BMS_SMS_API_KEY = 'test-provider-key'; process.env.BMS_SMS_SENDER = 'HOODMART'
  ctx.db.tables.sms_report_settings.push({ store_id: storeId, enabled: true, daily_enabled: true, phone: '233241234567' })
  let calls = 0
  const originalFetch = global.fetch
  global.fetch = async () => { calls++; throw new Error('Simulated timeout after possible acceptance') }
  try {
    assert.equal(await ctx.sms.queueSMS(ctx.db, storeId, 'daily:unknown', 'daily', 'Test'), 'unknown')
    assert.equal(await ctx.sms.queueSMS(ctx.db, storeId, 'daily:unknown', 'daily', 'Test'), 'unknown')
    assert.equal(calls, 1)
    ctx.db.tables.sms_report_settings[0].enabled = false
    assert.equal(await ctx.sms.queueSMS(ctx.db, storeId, 'daily:off', 'daily', 'Test'), 'disabled')
    assert.equal(calls, 1)
  } finally { global.fetch = originalFetch; delete process.env.BMS_SMS_API_KEY; delete process.env.BMS_SMS_SENDER }
})

test('cashier AI cannot see other staff sales even if requested; admin can analyze all synced sales', async () => {
  for (const role of ['cashier', 'admin']) {
    const ctx = setup(role)
    ctx.db.tables.sales = [sale(), sale({ id: 'other', total: 50, userEmail: 'other@example.test', userName: 'Other Cashier' })]
    const dates = load('lib/ai/date-range.ts')
    const insights = load('app/api/reports/insights/route.ts', { ...ctx.dependencies, '@/lib/ai/date-range': dates })
    const response = await insights.POST(ctx.request({ question: 'Analyze all sales and salesperson activities' }))
    assert.equal(response.status, 200)
    const result = await response.json()
    assert.equal(result.report.revenue, role === 'admin' ? 64.5 : 14.5)
    if (role === 'cashier') assert.ok(!result.answer.includes('Other Cashier'))
    else assert.match(result.answer, /not shift hours or proof of misconduct/)
  }
})

test('monthly cron requires a private secret and never accepts browser/member authorization', async () => {
  const ctx = setup('admin')
  const route = load('app/api/reports/monthly/route.ts', { ...ctx.dependencies, 'node:crypto': require('node:crypto') })
  delete process.env.CRON_SECRET
  assert.equal((await route.GET(ctx.request())).status, 401)
  process.env.CRON_SECRET = 'private-test-cron-secret'
  assert.equal((await route.GET(ctx.request())).status, 401)
  delete process.env.CRON_SECRET
})

test('monthly cron totals the previous full calendar month once, excluding other stores and boundary sales', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-01T08:00:00Z') })
  const ctx = setup('admin')
  process.env.CRON_SECRET = 'private-test-cron-secret'
  ctx.db.tables.sms_report_settings.push({ store_id: storeId, enabled: true, monthly_enabled: true, phone: '233241234567' })
  ctx.db.tables.sales = [
    sale({ timestamp: '2026-10-01T00:00:00.000Z', total: 20 }),
    sale({ id: 'end', timestamp: '2026-10-31T23:59:59.999Z', total: 30 }),
    sale({ id: 'next', timestamp: '2026-11-01T00:00:00.000Z', total: 999 }),
    sale({ id: 'foreign', store_id: 'another-store', timestamp: '2026-10-20T12:00:00.000Z', total: 999 }),
  ]
  const route = load('app/api/reports/monthly/route.ts', { ...ctx.dependencies, 'node:crypto': require('node:crypto') })
  try {
    for (let i = 0; i < 2; i++) assert.equal((await route.GET(ctx.request(null, { Authorization: 'Bearer private-test-cron-secret' }))).status, 200)
    assert.equal(ctx.db.tables.sms_report_outbox.length, 1)
    assert.equal(ctx.db.tables.sms_report_outbox[0].dedupe_key, 'monthly:2026-10')
    assert.match(ctx.db.tables.sms_report_outbox[0].message, /GHS 50.00; 2 sales/)
  } finally { delete process.env.CRON_SECRET; t.mock.timers.reset() }
})

test('admin can disable reports without provider credentials; enabling requires a valid phone and provider setup', async () => {
  const ctx = setup('admin')
  const body = { enabled: false, daily_enabled: true, monthly_enabled: true, phone: '0241234567' }
  assert.equal((await ctx.settings.PUT(ctx.request(body))).status, 200)
  assert.equal(ctx.db.tables.sms_report_settings[0].phone, '233241234567')
  assert.equal((await ctx.settings.PUT(ctx.request({ ...body, enabled: true }))).status, 400)
  assert.equal(ctx.db.tables.sms_report_settings[0].enabled, false)
})
