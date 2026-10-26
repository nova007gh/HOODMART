const assert = require('node:assert/strict')

// Run against a local Next.js server. All data is mocked: no real store
// credentials, records, payments or production services are used.
async function main() {
  const { default: puppeteer } = await import('puppeteer')
  const base = process.env.TEST_BASE_URL || 'http://localhost:3100'
  assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname))
  const browser = await puppeteer.launch({ headless: true })
  try {
    const page = await browser.newPage()
    page.on('pageerror', error => console.error('Browser error:', error.message))
    await page.evaluateOnNewDocument(() => {
      const workers = new EventTarget()
      workers.controller = {}
      workers.register = async () => ({ update: async () => {} })
      Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: workers })
      window.__testWorkers = workers
      localStorage.setItem('test_app_boots', String(Number(localStorage.getItem('test_app_boots') || 0) + 1))
      if (!localStorage.getItem('hoodmart_session')) {
        localStorage.setItem('hoodmart_session', JSON.stringify({
          user: { name: 'Test Admin', email: 'admin@example.test', role: 'admin', storeId: 'test-store', permissions: ['*'] },
          storeId: 'test-store', loggedInAt: Date.now(), storeName: 'Test Store',
        }))
      }
      localStorage.setItem('hoodmart_v2_products', '[]')
      if (!sessionStorage.getItem('subscription_test_fixture')) {
        sessionStorage.setItem('subscription_test_fixture', JSON.stringify({
          end: new Date(Date.now() + 3 * 86_400_000).toISOString(), failed: false,
        }))
      }
      const realFetch = window.fetch.bind(window)
      window.fetch = async (input, options) => {
        const url = new URL(typeof input === 'string' ? input : input.url || input.toString(), location.origin)
        if (url.hostname.endsWith('.supabase.co')) {
          const fixture = JSON.parse(sessionStorage.getItem('subscription_test_fixture'))
          const stores = url.pathname === '/rest/v1/stores'
          const data = stores
            ? fixture.failed ? { message: 'Test outage' } : { plan: 'pro', subscription_status: 'active', trial_ends_at: null, current_period_end: fixture.end }
            : []
          return new Response(JSON.stringify(data), { status: stores && fixture.failed ? 503 : 200, headers: { 'Content-Type': 'application/json' } })
        }
        return realFetch(input, options)
      }
    })
    await page.setRequestInterception(true)
    page.on('request', request => {
      const url = new URL(request.url())
      if (url.origin !== new URL(base).origin) return request.abort()
      if (url.pathname.startsWith('/api/')) return request.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { sales: [], products: [], notifications: [] }, syncedAt: new Date().toISOString() }) })
      if (request.method() !== 'GET') return request.abort()
      return request.continue()
    })

    await page.goto(base + '/dashboard', { waitUntil: 'networkidle0' })
    await page.waitForFunction(() => document.querySelector('[role="status"]')?.textContent.includes('PRO monthly subscription'))
    assert.match(await page.$eval('[role="status"]', el => el.textContent), /3 days remaining/)
    assert.ok(await page.$('nav a[href="/billing"]'))
    console.log('PASS: admin dashboard shows monthly reminder and Billing navigation')

    await page.setViewport({ width: 375, height: 812 })
    assert.ok(await page.$eval('[role="status"]', el => el.scrollWidth <= el.clientWidth))
    console.log('PASS: renewal notice fits a mobile screen without horizontal overflow')
    await page.setViewport({ width: 1280, height: 900 })

    await page.evaluate(() => {
      sessionStorage.setItem('subscription_test_fixture', JSON.stringify({ end: new Date(Date.now() + 20 * 86_400_000).toISOString(), failed: false }))
      window.dispatchEvent(new Event('focus'))
    })
    await page.waitForFunction(() => document.querySelector('[role="status"]')?.textContent.includes('20 days remaining'))
    console.log('PASS: returning to the app refreshes the renewal date')

    await page.$eval('[role="status"] button', el => el.click())
    await page.waitForFunction(() => location.pathname === '/billing')
    await page.waitForFunction(() => document.body.textContent.includes('Billing & Subscription'))
    console.log('PASS: reminder button opens Billing')

    await page.evaluate(() => sessionStorage.setItem('subscription_test_fixture', JSON.stringify({ failed: true })))
    await page.reload({ waitUntil: 'networkidle0' })
    await page.waitForFunction(() => document.querySelector('[role="status"]')?.textContent.includes('could not be verified'))
    await page.waitForFunction(() => document.body.textContent.includes('Unable to verify'))
    console.log('PASS: read errors stay visible without claiming the subscription expired')

    for (const role of ['cashier', 'salesgirl']) {
      await page.evaluate(role => {
        const session = JSON.parse(localStorage.getItem('hoodmart_session'))
        session.user.role = role
        localStorage.setItem('hoodmart_session', JSON.stringify(session))
        sessionStorage.setItem('subscription_test_fixture', JSON.stringify({ end: new Date(Date.now() + 3 * 86_400_000).toISOString(), failed: false }))
      }, role)
      await page.goto(base + '/dashboard', { waitUntil: 'networkidle0' })
      await page.waitForFunction(() => document.querySelector('[role="status"]')?.textContent.includes('PRO monthly subscription'))
      assert.equal(await page.$('nav a[href="/billing"]'), null)
      assert.equal(await page.$('[role="status"] button'), null)
      assert.match(await page.$eval('[role="status"]', el => el.textContent), /administrator/)
      console.log(`PASS: ${role} sees the subscription alert without admin renewal controls`)
    }

    const boots = await page.evaluate(() => {
      localStorage.setItem('test_unsaved_work', 'preserved')
      window.__testWorkers.dispatchEvent(new Event('controllerchange'))
      return Number(localStorage.getItem('test_app_boots'))
    })
    await page.waitForFunction(() => document.body.textContent.includes('A HOODMART update is ready'))
    assert.equal(await page.evaluate(() => Number(localStorage.getItem('test_app_boots'))), boots)
    assert.equal(await page.evaluate(() => localStorage.getItem('test_unsaved_work')), 'preserved')
    console.log('PASS: installed-app updates prompt without forcing a reload or clearing work')

    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle0' }),
      page.evaluate(() => [...document.querySelectorAll('button')].find(button => button.textContent === 'Update app').click()),
    ])
    assert.ok(await page.evaluate(() => Number(localStorage.getItem('test_app_boots'))) > boots)
    await page.waitForFunction(() => document.querySelector('[role="status"]')?.textContent.includes('PRO monthly subscription'))
    assert.equal(await page.evaluate(() => localStorage.getItem('test_unsaved_work')), 'preserved')
    console.log('PASS: explicit Update app reloads the dashboard and retains local work')
  } finally {
    await browser.close()
  }
}

main().catch(error => { console.error(error); process.exitCode = 1 })
