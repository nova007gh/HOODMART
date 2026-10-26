const assert = require('node:assert/strict')
const fs = require('node:fs')

// Local-only fixture: never signs in, writes records, or contacts production.
async function main() {
  const { default: puppeteer } = await import('puppeteer')
  const base = process.env.TEST_BASE_URL || 'http://localhost:3000'
  assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname))
  const browser = await puppeteer.launch({ headless: true, executablePath: process.env.PUPPETEER_EXECUTABLE_PATH })
  try {
    const page = await browser.newPage()
    const env = fs.readFileSync('.env.local', 'utf8')
    const ref = new URL(env.match(/^NEXT_PUBLIC_SUPABASE_URL=["']?([^\s"']+)/m)[1]).hostname.split('.')[0]
    await page.evaluateOnNewDocument(ref => {
      // A local browser fixture only. Every API/Supabase request below is
      // intercepted; these are not real credentials or a production session.
      const encode = value => btoa(JSON.stringify(value)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
      const token = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: 'test-user', exp: Math.floor(Date.now() / 1000) + 3600, role: 'authenticated' })}.test-signature`
      document.cookie = `sb-${ref}-auth-token=base64-${encode({ access_token: token, refresh_token: 'test-refresh-token', expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: 'bearer', user: { id: 'test-user', email: 'admin@example.test', role: 'authenticated' } })}; path=/; SameSite=Lax`
      if (!localStorage.getItem('hoodmart_session')) {
        localStorage.setItem('hoodmart_session', JSON.stringify({
          user: { name: 'Test Admin', email: 'admin@example.test', role: 'admin', storeId: 'test-store', permissions: ['*'] },
          storeId: 'test-store', loggedInAt: Date.now(), storeName: 'Test Store',
        }))
      }
      localStorage.setItem('hoodmart_v2_products', '[]')
      const realFetch = window.fetch.bind(window)
      window.fetch = async (input, options) => {
        const url = new URL(typeof input === 'string' ? input : input.url || input.toString(), location.origin)
        if (url.hostname.endsWith('.supabase.co')) {
          const data = url.pathname === '/rest/v1/stores'
            ? { plan: 'pro', subscription_status: 'active', current_period_end: new Date(Date.now() + 20 * 86400000).toISOString() }
            : []
          return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } })
        }
        return realFetch(input, options)
      }
    }, ref)
    await page.setRequestInterception(true)
    let closeRequests = 0
    page.on('request', request => {
      const url = new URL(request.url())
      if (url.origin !== new URL(base).origin) return request.abort()
      if (url.pathname === '/api/reports/close-day') {
        const closed = request.method() === 'POST'
        if (closed) closeRequests++
        return request.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ date: new Date().toISOString().slice(0, 10), cutoff: new Date().toISOString(), report: { revenue: 24.5, transactions: 3, items: 5, bestItem: { name: 'Test Water', quantity: 4 } }, closed, ...(closed ? { sms: 'disabled' } : {}) }) })
      }
      if (url.pathname.startsWith('/api/')) return request.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { sales: [], products: [], notifications: [] }, syncedAt: new Date().toISOString() }) })
      if (request.method() !== 'GET') return request.abort()
      return request.continue()
    })

    await page.setViewport({ width: 390, height: 844 })
    await page.goto(base + '/dashboard', { waitUntil: 'networkidle0' })
    const nav = 'nav[aria-label="Main navigation"]'
    await page.waitForSelector(`${nav} a[href="/reports"]`)
    // Development-only query tools otherwise cover the Reports tab; they are
    // not rendered in the production build.
    await page.addStyleTag({ content: '.tsqd-parent-container { display: none !important; }' })
    assert.deepEqual(await page.$$eval(`${nav} a, ${nav} button`, links => links.map(link => link.textContent.trim())), ['Home', 'POS', 'Kofi AI', 'Products', 'Reports'])
    assert.equal(await page.$eval(`${nav} [aria-current="page"]`, el => el.textContent.trim()), 'Home')

    for (const width of [320, 375, 390, 768]) {
      await page.setViewport({ width, height: 844 })
      const bounds = await page.$eval(nav, el => {
        const r = el.getBoundingClientRect()
        return { bottom: r.bottom, width: r.width, display: getComputedStyle(el).display, overflow: el.scrollWidth > el.clientWidth }
      })
      assert.equal(bounds.bottom, 844)
      assert.equal(bounds.width, width)
      assert.notEqual(bounds.display, 'none')
      assert.equal(bounds.overflow, false)
    }
    await page.setViewport({ width: 390, height: 844 })
    if (process.env.TEST_SCREENSHOT) await page.screenshot({ path: process.env.TEST_SCREENSHOT, fullPage: false })
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    assert.equal(await page.$eval(nav, el => el.getBoundingClientRect().bottom), 844)
    console.log('PASS: all five tabs, active Home, mobile/tablet sizing, fixed position while scrolling')

    await page.click(`${nav} button[aria-haspopup="dialog"]`)
    await page.waitForSelector('[role="dialog"][aria-labelledby="kofi-dialog-title"]')
    const panel = await page.$eval('[aria-labelledby="kofi-dialog-title"]', el => ({ height: el.getBoundingClientRect().height, background: getComputedStyle(el).backgroundColor, modal: el.getAttribute('aria-modal') }))
    assert.ok(panel.height <= 440)
    assert.match(panel.background, /rgba\(.+, 0\.65\)/)
    assert.equal(panel.modal, 'false')
    if (process.env.TEST_AI_SCREENSHOT) await page.screenshot({ path: process.env.TEST_AI_SCREENSHOT, fullPage: false })
    assert.equal(new URL(page.url()).pathname, '/dashboard')
    await page.keyboard.press('Escape')
    await page.waitForSelector('[aria-labelledby="kofi-dialog-title"]', { hidden: true })
    console.log('PASS: Kofi opens a compact translucent nonmodal panel without leaving the page; Escape closes it')

    for (const [href, label] of [['/products', 'Products'], ['/reports', 'Reports'], ['/pos', 'POS']]) {
      console.log(`Checking ${label} navigation`)
      await page.evaluate(() => window.scrollTo(0, 0))
      await page.click(`${nav} a[href="${href}"]`)
      await page.waitForFunction(expected => location.pathname === expected, {}, href)
      await page.waitForSelector(`${nav} a[aria-current="page"][href="${href}"]`)
      assert.equal(await page.$eval(`${nav} [aria-current="page"]`, el => el.textContent.trim()), label)
    }
    console.log('PASS: Products, Reports and POS links navigate and highlight correctly')

    await page.click('button::-p-text(Close today\'s sales)')
    await page.waitForSelector('dialog[open]')
    await page.waitForFunction(() => document.querySelector('dialog[open]')?.textContent.includes('Test Water'))
    assert.match(await page.$eval('dialog[open]', el => el.textContent), /24.50/)
    if (process.env.TEST_CLOSE_SCREENSHOT) await page.screenshot({ path: process.env.TEST_CLOSE_SCREENSHOT, fullPage: false })
    await page.click('dialog[open] button::-p-text(Confirm close)')
    await page.waitForFunction(() => document.querySelector('dialog[open]')?.textContent.includes('switched off'))
    assert.equal(closeRequests, 1)
    assert.equal(await page.$eval('dialog[open] button.gold-gradient', el => el.disabled), true)
    await page.click('button[aria-label="Close shift summary"]')
    console.log('PASS: cashier close previews totals/best item, confirms once, and accurately displays SMS-off status')

    await page.setViewport({ width: 768, height: 900 })
    const overlap = await page.evaluate(() => {
      const nav = document.querySelector('nav[aria-label="Main navigation"]').getBoundingClientRect()
      const assistant = [...document.querySelectorAll('button')].find(el => el.textContent.includes('Sales AI'))
      return assistant ? assistant.getBoundingClientRect().bottom > nav.top : false
    })
    assert.equal(overlap, false)
    await page.emulateMediaType('print')
    assert.equal(await page.$eval(nav, el => getComputedStyle(el).display), 'none')
    await page.emulateMediaType('screen')
    console.log('PASS: bottom bar stays off printed receipts and clear of POS assistant')

    await page.setViewport({ width: 1280, height: 900 })
    assert.equal(await page.$eval(nav, el => getComputedStyle(el).display), 'none')
    console.log('PASS: desktop sidebar retained; mobile bar hidden on desktop')

    await page.evaluate(() => {
      const session = JSON.parse(localStorage.getItem('hoodmart_session'))
      session.user.role = 'cashier'
      session.user.permissions = ['process_sales']
      localStorage.setItem('hoodmart_session', JSON.stringify(session))
    })
    await page.setViewport({ width: 390, height: 844 })
    await page.goto(base + '/dashboard', { waitUntil: 'networkidle0' })
    await page.waitForSelector(`${nav} a[href="/pos"]`)
    assert.deepEqual(await page.$$eval(`${nav} a, ${nav} button`, links => links.map(link => link.textContent.trim())), ['Home', 'POS', 'Kofi AI'])
    console.log('PASS: cashier permissions do not expose Products or Reports')
  } finally {
    await browser.close()
  }
}

main().catch(error => { console.error(error); process.exitCode = 1 })
