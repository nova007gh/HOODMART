const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')

// Exercise the actual TypeScript helper without adding a test-runner dependency.
const source = fs.readFileSync(path.join(__dirname, '../lib/subscription-status.ts'), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
const loaded = { exports: {} }
new Function('exports', 'module', compiled)(loaded.exports, loaded)
const { getSubscriptionNotice } = loaded.exports

const now = Date.parse('2026-10-19T10:00:00Z')
const info = (updates = {}) => ({
  status: 'active', plan: 'pro', trialEndsAt: null,
  currentPeriodEnd: '2026-10-22T10:00:00Z', isAllowed: true, daysRemaining: 3,
  ...updates,
})

test('paid monthly subscriptions show expiry, days remaining and renewal action', () => {
  const notice = getSubscriptionNotice(info(), now)
  assert.equal(notice.tone, 'warning')
  assert.match(notice.message, /PRO monthly subscription ends on 22 Oct 2026 \(3 days remaining\)/)
  assert.equal(notice.action, 'Renew Now')
})

test('healthy subscriptions remain visible to admins outside the warning window', () => {
  const notice = getSubscriptionNotice(info({ currentPeriodEnd: '2026-11-19T10:00:00Z' }), now)
  assert.equal(notice.tone, 'info')
  assert.match(notice.message, /31 days remaining/)
  assert.equal(notice.action, 'View Billing')
})

test('renewal warning starts seven days before expiry', () => {
  assert.equal(getSubscriptionNotice(info({ currentPeriodEnd: '2026-10-26T10:00:00Z' }), now).tone, 'warning')
  assert.equal(getSubscriptionNotice(info({ currentPeriodEnd: '2026-10-27T10:00:00Z' }), now).tone, 'info')
})

test('days remaining are recomputed rather than using stale cached counts', () => {
  const notice = getSubscriptionNotice(info({ currentPeriodEnd: '2026-10-20T09:00:00Z', daysRemaining: 10 }), now)
  assert.match(notice.message, /1 day remaining/)
})

test('an expiry earlier today is reported as ended, not zero days remaining', () => {
  const notice = getSubscriptionNotice(info({ currentPeriodEnd: '2026-10-19T09:00:00Z', daysRemaining: 0 }), now)
  assert.equal(notice.tone, 'danger')
  assert.match(notice.message, /ended on 19 Oct 2026/)
})

test('expiry at the exact current instant is ended', () => {
  assert.equal(getSubscriptionNotice(info({ currentPeriodEnd: new Date(now).toISOString() }), now).tone, 'danger')
})

test('trials use the trial end date rather than the paid period date', () => {
  const notice = getSubscriptionNotice(info({ status: 'trialing', trialEndsAt: '2026-10-21T10:00:00Z' }), now)
  assert.match(notice.message, /free trial ends on 21 Oct 2026 \(2 days remaining\)/)
  assert.equal(notice.action, 'Choose a Plan')
})

for (const status of ['past_due', 'expired', 'canceled']) {
  test(`${status} subscriptions show a billing warning even without an end date`, () => {
    const notice = getSubscriptionNotice(info({ status, currentPeriodEnd: null }), now)
    assert.equal(notice.tone, 'danger')
    assert.equal(notice.action, 'View Billing')
  })
}

test('failed reads show uncertainty instead of hiding the alert or claiming expiry', () => {
  const notice = getSubscriptionNotice(info({ loadError: true, status: 'trialing', plan: 'free' }), now)
  assert.equal(notice.tone, 'warning')
  assert.match(notice.message, /could not be verified/)
  assert.doesNotMatch(notice.message, /expired|ended/)
})

test('missing and invalid expiry dates request support rather than inventing a date', () => {
  for (const currentPeriodEnd of [null, 'invalid']) {
    assert.match(getSubscriptionNotice(info({ currentPeriodEnd }), now).message, /renewal date is not set/)
  }
})

test('local-only free mode has no subscription reminder', () => {
  assert.equal(getSubscriptionNotice(info({ plan: 'free', currentPeriodEnd: null }), now), null)
})

function subscriptionClient({ configured = true, storeId = 'test-store', data = null, error = null, throws = false } = {}) {
  const source = fs.readFileSync(path.join(__dirname, '../lib/subscription.ts'), 'utf8')
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
  const query = { select: () => query, eq: () => query, single: async () => {
    if (throws) throw new Error('Test network outage')
    return { data, error }
  } }
  const mocks = {
    '@/lib/plans': { PLAN_PRICE_GHS: { pro: 300 } },
    '@/lib/supabase/client': { supabase: { from: () => query }, isSupabaseConfigured: () => configured },
    '@/lib/auth': { getStoreId: () => storeId },
  }
  const loaded = { exports: {} }
  new Function('require', 'exports', 'module', compiled)(name => {
    assert.ok(name in mocks, `Unexpected dependency: ${name}`)
    return mocks[name]
  }, loaded.exports, loaded)
  return loaded.exports
}

test('subscription read errors become visible without changing fail-open access', async () => {
  for (const options of [{ error: { message: 'Test permission error' } }, { throws: true }, { storeId: null }]) {
    const result = await subscriptionClient(options).getSubscriptionInfo()
    assert.equal(result.loadError, true)
    assert.equal(result.isAllowed, true)
  }
})

test('unconfigured local-only mode does not show a false billing outage', async () => {
  const result = await subscriptionClient({ configured: false }).getSubscriptionInfo()
  assert.equal(result.loadError, undefined)
  assert.equal(getSubscriptionNotice(result), null)
})

test('successful reads keep the real plan, status and renewal date', async () => {
  const result = await subscriptionClient({ data: {
    plan: 'pro', subscription_status: 'active', trial_ends_at: null, current_period_end: '2099-01-01T00:00:00Z',
  } }).getSubscriptionInfo()
  assert.equal(result.loadError, undefined)
  assert.equal(result.plan, 'pro')
  assert.equal(result.currentPeriodEnd, '2099-01-01T00:00:00Z')
  assert.equal(result.isAllowed, true)
})
