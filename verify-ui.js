const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const BASE = 'http://localhost:3000';
const OUT = path.join(__dirname, 'ui-verify');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT);

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

async function loginAs(page, email, password) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2', timeout: 60000 });
  await delay(1200);
  await page.evaluate(() => {
    document.querySelectorAll('input').forEach((i) => (i.value = ''));
  });
  await page.type('input[type="email"]', email);
  await page.type('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await delay(9000); // login + full sync
}

async function shot(page, name) {
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: true });
  console.log('  shot:', name);
}

async function navLinks(page) {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll('aside nav a')).map((a) => a.textContent.trim())
  );
}

async function main() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: { width: 1440, height: 900 },
  });

  // ---------- CASHIER ----------
  console.log('=== CASHIER (jacklyn) ===');
  const ctxA = await browser.createBrowserContext();
  const cashier = await ctxA.newPage();
  const errs = [];
  cashier.on('pageerror', (e) => errs.push(String(e)));
  cashier.on('console', (m) => {
    if (m.type() === 'error') errs.push(m.text());
  });

  await loginAs(cashier, 'jacklyn@hoodmart.com', 'Jacklyn2026');
  console.log('  URL:', cashier.url());
  console.log('  NAV:', JSON.stringify(await navLinks(cashier)));
  await shot(cashier, 'cashier-01-dashboard');

  await cashier.goto(`${BASE}/pos`, { waitUntil: 'networkidle2' });
  await delay(3500);
  await shot(cashier, 'cashier-02-pos');

  // Check for the cashier identity card + no "+ Add" product button
  const posInfo = await cashier.evaluate(() => {
    const body = document.body.innerText;
    return {
      hasAddButton: Array.from(document.querySelectorAll('button')).some((b) =>
        b.textContent.includes('+ Add')
      ),
      hasMySales: body.includes('My Sales'),
      hasMyTotal: body.includes('My Total'),
      hasBell: !!document.querySelector('[aria-label="Notifications"]'),
    };
  });
  console.log('  POS:', JSON.stringify(posInfo));

  await cashier.goto(`${BASE}/settings`, { waitUntil: 'networkidle2' });
  await delay(2500);
  await shot(cashier, 'cashier-03-settings');
  const setInfo = await cashier.evaluate(() => {
    const t = document.body.innerText;
    return {
      dangerZone: t.includes('Danger Zone'),
      backup: t.includes('Backup & Restore'),
      appearance: t.includes('Appearance'),
      adminOnlyNote: t.includes('Only an administrator'),
    };
  });
  console.log('  SETTINGS:', JSON.stringify(setInfo));

  await cashier.goto(`${BASE}/profile`, { waitUntil: 'networkidle2' });
  await delay(2500);
  await shot(cashier, 'cashier-04-profile');

  await cashier.goto(`${BASE}/dashboard/assistant`, { waitUntil: 'networkidle2' });
  await delay(3000);
  await shot(cashier, 'cashier-05-ai');
  const aiInfo = await cashier.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'))
      .map((b) => b.textContent.trim())
      .filter((t) => t.includes('?'));
    return { prompts: btns };
  });
  console.log('  AI PROMPTS:', JSON.stringify(aiInfo.prompts));

  // ---------- ADMIN ----------
  console.log('\n=== ADMIN (eunice) ===');
  const ctxB = await browser.createBrowserContext();
  const admin = await ctxB.newPage();
  admin.on('pageerror', (e) => errs.push('ADMIN: ' + String(e)));

  await loginAs(admin, 'eunicekorkor2020gh@gmail.com', 'Korkor2020');
  console.log('  URL:', admin.url());
  console.log('  NAV:', JSON.stringify(await navLinks(admin)));
  await shot(admin, 'admin-01-dashboard');

  const adminInfo = await admin.evaluate(() => ({
    hasBell: !!document.querySelector('[aria-label="Notifications"]'),
  }));
  console.log('  ADMIN header bell:', JSON.stringify(adminInfo));

  // Open the notification panel
  if (adminInfo.hasBell) {
    await admin.click('[aria-label="Notifications"]');
    await delay(900);
    await shot(admin, 'admin-02-notifications');
  }

  await admin.goto(`${BASE}/settings`, { waitUntil: 'networkidle2' });
  await delay(2500);
  await shot(admin, 'admin-03-settings');
  const adminSet = await admin.evaluate(() => {
    const t = document.body.innerText;
    return {
      dangerZone: t.includes('Danger Zone'),
      backup: t.includes('Backup & Restore'),
      emailAlerts: t.includes('Email me team activity'),
    };
  });
  console.log('  ADMIN SETTINGS:', JSON.stringify(adminSet));

  await admin.goto(`${BASE}/employees`, { waitUntil: 'networkidle2' });
  await delay(2500);
  await shot(admin, 'admin-04-employees');

  console.log('\n=== JS ERRORS ===');
  const real = errs.filter(
    (e) => !/favicon|manifest|404|Failed to load resource|notifications|avatar/i.test(e)
  );
  console.log(real.length ? real.slice(0, 10).join('\n') : '  none');

  await browser.close();
}

main().catch((e) => {
  console.error('FATAL:', e.message);
  process.exit(1);
});
