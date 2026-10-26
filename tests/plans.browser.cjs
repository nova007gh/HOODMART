const assert = require('node:assert/strict')

async function main() {
  const { default: puppeteer } = await import('puppeteer')
  const base = process.env.TEST_BASE_URL || 'http://localhost:3101'
  assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname))
  const browser = await puppeteer.launch({ headless: true })
  try {
    const page = await browser.newPage()
    await page.setViewport({ width: 1280, height: 900 })
    page.on('pageerror', error => console.error('Browser error:', error.message))
    await page.evaluateOnNewDocument(() => {
      const end = new Date(Date.now() + 20 * 86_400_000).toISOString()
      const store = { id: 'test-store', name: 'Test Store', owner_email: 'test@example.test', plan: 'pro', subscription_status: 'active', trial_ends_at: null, current_period_end: end, subscription_provider: 'manual', created_at: new Date().toISOString(), lastActiveAt: null }
      if (location.pathname !== '/') {
        localStorage.setItem('hoodmart_session', JSON.stringify({ user: { name: 'Test Admin', role: 'admin', email: 'test@example.test', storeId: store.id }, storeId: store.id, loggedInAt: Date.now(), storeName: store.name }))
        localStorage.setItem('hoodmart_v2_products', '[]')
      }
      // Fake local owner session. Authentication and every data response below
      // are fixtures; nothing reaches Supabase or production.
      const encode = value => btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
      const expiry = Math.floor(Date.now() / 1000) + 3600
      const session = { access_token: `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: 'test-owner', exp: expiry })}.fixture`, refresh_token: 'fixture', expires_at: expiry, expires_in: 3600, token_type: 'bearer', user: { id: 'test-owner', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {} } }
      for (const ref of ['qntdupejkvalakjfbrtk', 'ntnpyjvbstlofqymihbt']) {
        document.cookie = `sb-${ref}-auth-token=base64-${encode(session)}; path=/; SameSite=Lax`
      }
      const realFetch = window.fetch.bind(window)
      window.fetch = async (input, options) => {
        const url = new URL(typeof input === 'string' ? input : input.url || input.toString(), location.origin)
        const json = data => new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } })
        if (url.hostname.endsWith('.supabase.co')) return json(url.pathname === '/rest/v1/stores' ? store : [])
        if (url.pathname === '/api/owner/me') return json({ ok: true })
        if (url.pathname === '/api/owner/stats') return json({ totalStores: 1, active: 1, trialing: 0, pastDue: 0, expired: 0, canceled: 0, mrr: 300, revenue30d: 0, successfulPayments30d: 0, failedPayments30d: 0 })
        if (url.pathname === '/api/owner/stores') return json({ stores: [store] })
        if (url.pathname === '/api/owner/payments') return json({ payments: [] })
        if (url.pathname === '/api/owner/activity') return json({ logins: [], recentSales: [], salesByDay: [], salesByWeek: [], salesByMonth: [], usage: [] })
        if (url.pathname === '/api/owner/stores/test-store') return json({ store, members: [], payments: [] })
        if (url.pathname.startsWith('/api/')) return json({ data: { sales: [], products: [] } })
        return realFetch(input, options)
      }
    })
    await page.setRequestInterception(true)
    page.on('request', request => {
      if (new URL(request.url()).origin !== new URL(base).origin || request.method() !== 'GET') return request.abort()
      return request.continue()
    })
    const assertNoBasic = async () => assert.doesNotMatch(await page.$eval('body', el => el.innerText), /\bbasic\b|GHS\s*150/i)

    await page.goto(base, { waitUntil: 'networkidle0' })
    const pricing = await page.$eval('#pricing', el => el.innerText)
    assert.match(pricing, /GHS 300/)
    assert.doesNotMatch(pricing, /basic|150/i)
    assert.equal((pricing.match(/\/month/g) || []).length, 1)
    console.log('PASS: public pricing offers only Pro at GHS 300/month')

    await page.goto(base + '/billing', { waitUntil: 'networkidle0' })
    await page.waitForFunction(() => document.body.textContent.includes('all features included'))
    await assertNoBasic()
    assert.match(await page.$eval('body', el => el.innerText), /Amount\s*GHS 300/)
    console.log('PASS: customer billing offers only Pro and requests GHS 300')

    await page.goto(base + '/owner', { waitUntil: 'networkidle0' })
    await page.waitForFunction(() => document.body.textContent.includes('Plan Distribution'))
    await assertNoBasic()
    assert.match(await page.$eval('body', el => el.innerText), /Pro \(GHS 300\)/)
    console.log('PASS: owner distribution has no Basic package')

    await page.click('button[title="Record payment & renew"]')
    await page.waitForFunction(() => document.body.textContent.includes('Renew subscription — Test Store'))
    await assertNoBasic()
    assert.ok(await page.$eval('.fixed.inset-0.z-50', el => [...el.querySelectorAll('input')].some(input => input.value === '300')))
    console.log('PASS: owner renewal defaults to Pro and GHS 300')

    await page.reload({ waitUntil: 'networkidle0' })
    await page.evaluate(() => [...document.querySelectorAll('button')].find(button => button.textContent.includes('Add Store')).click())
    await page.waitForFunction(() => document.body.textContent.includes('Add client store'))
    assert.deepEqual(await page.$$eval('.fixed.inset-0.z-50 select option', options => options.map(option => option.value)), ['free', 'pro'])
    console.log('PASS: new stores can select only a trial or Pro')

    await page.goto(base + '/owner/stores/test-store', { waitUntil: 'networkidle0' })
    await page.waitForFunction(() => document.body.textContent.includes('Subscription Overrides'))
    await assertNoBasic()
    assert.deepEqual(await page.$$eval('select', selects => [...selects[1].options].map(option => option.value)), ['pro', 'free'])
    console.log('PASS: store overrides cannot assign Basic')
  } finally {
    await browser.close()
  }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
