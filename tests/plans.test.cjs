const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')

function load(file, mocks = {}) {
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8')
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
  const loaded = { exports: {} }
  new Function('require', 'exports', 'module', compiled)(name => {
    assert.ok(name in mocks, `Unexpected dependency: ${name}`)
    return mocks[name]
  }, loaded.exports, loaded)
  return loaded.exports
}

const plans = load('lib/plans.ts')
test('Pro at GHS 300 is the only paid plan', () => {
  assert.deepEqual(plans.PLAN_PRICE_GHS, { pro: 300 })
  assert.equal(plans.isPaidPlan('pro'), true)
  for (const value of ['basic', 'free', 'toString', '__proto__', null, undefined, 300]) {
    assert.equal(plans.isPaidPlan(value), false)
  }
  assert.equal(plans.isStorePlan('free'), true)
  assert.equal(plans.isStorePlan('pro'), true)
  assert.equal(plans.isStorePlan('basic'), false)
})

function route(file, authorized = true) {
  const calls = []
  const query = {
    select: () => query, eq: () => query,
    insert: value => { calls.push({ insert: value }); return query },
    single: async () => ({ data: { id: 'test-store', subscription_status: 'active' }, error: null }),
  }
  const mocks = {
    'next/server': { NextResponse: { json: (body, options = {}) => ({ body, status: options.status || 200 }) } },
    '@/lib/plans': plans,
    '@/lib/owner-auth': { requireOwner: async () => authorized ? { ok: true } : { ok: false, response: { status: 401 } } },
    '@/lib/supabase/admin': { getSupabaseAdmin: () => { calls.push('admin'); return { from: () => query } } },
    '@supabase/supabase-js': { createClient: () => { throw new Error('Unexpected database access') } },
    '@/lib/payments/eganow': { collectMobileMoney: () => { throw new Error('Unexpected payment collection') } },
  }
  return { handlers: load(file, mocks), calls }
}
const request = body => ({ json: async () => body })

for (const [file, method, body] of [
  ['app/api/owner/payments/route.ts', 'POST', { store_id: 'test-store', plan: 'basic', amount: 150 }],
  ['app/api/owner/stores/route.ts', 'POST', { name: 'Test', owner_email: 'test@example.test', plan: 'basic' }],
  ['app/api/owner/stores/[id]/route.ts', 'PATCH', { plan: 'basic' }],
  ['app/api/payments/eganow/initiate/route.ts', 'POST', { storeId: 'test-store', plan: 'basic', paypartnerCode: 'MTNGH', msisdn: '0000000000' }],
]) {
  test(`${method} ${file} rejects the removed plan before any data writes or charges`, async () => {
    const { handlers, calls } = route(file)
    const response = await handlers[method](request(body), { params: { id: 'test-store' } })
    assert.equal(response.status, 400)
    assert.equal(calls.length, 0)
  })
}

test('owner payment defaults to Pro and GHS 300', async () => {
  const { handlers, calls } = route('app/api/owner/payments/route.ts')
  const response = await handlers.POST(request({ store_id: 'test-store' }))
  assert.equal(response.status, 200)
  const payment = calls.find(call => call.insert)?.insert
  assert.equal(payment.plan, 'pro')
  assert.equal(payment.amount, 300)
})

test('owner payment does not accept free as a paid package', async () => {
  const { handlers, calls } = route('app/api/owner/payments/route.ts')
  assert.equal((await handlers.POST(request({ store_id: 'test-store', plan: 'free' }))).status, 400)
  assert.equal(calls.length, 0)
})

test('owner authorization remains required', async () => {
  const { handlers, calls } = route('app/api/owner/payments/route.ts', false)
  assert.equal((await handlers.POST(request({ store_id: 'test-store', plan: 'pro' }))).status, 401)
  assert.equal(calls.length, 0)
})

test('mobile-money collection uses GHS 300 even if a caller supplies a lower amount', async () => {
  let inserted, collected
  const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const previousKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key'
  try {
    const handlers = load('app/api/payments/eganow/initiate/route.ts', {
      'next/server': { NextResponse: { json: (body, options = {}) => ({ body, status: options.status || 200 }) } },
      '@/lib/plans': plans,
      '@supabase/supabase-js': { createClient: () => ({ from: () => ({ insert: async value => { inserted = value; return { error: null } } }) }) },
      '@/lib/payments/eganow': { collectMobileMoney: async value => { collected = value; return { ok: true } } },
    })
    const response = await handlers.POST(request({ storeId: 'test-store', plan: 'pro', amount: 150, paypartnerCode: 'MTNGH', msisdn: '0000000000' }))
    assert.equal(response.status, 200)
    assert.equal(inserted.amount, 300)
    assert.equal(collected.amount, 300)
  } finally {
    if (previousUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL
    else process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl
    if (previousKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY
    else process.env.SUPABASE_SERVICE_ROLE_KEY = previousKey
  }
})
