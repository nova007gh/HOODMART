const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

class Target {
  listeners = new Map()
  addEventListener(name, fn) { if (!this.listeners.has(name)) this.listeners.set(name, new Set()); this.listeners.get(name).add(fn) }
  removeEventListener(name, fn) { this.listeners.get(name)?.delete(fn) }
  fire(name) { this.listeners.get(name)?.forEach(fn => fn()) }
}
const settle = () => new Promise(resolve => setImmediate(resolve))

function fixture(controlled = true) {
  const workers = new Target()
  workers.controller = controlled ? {} : null
  let now = 0, checks = 0, notices = 0, cleared = false, interval
  const registrations = []
  const registration = { update: async () => { checks++ } }
  workers.register = async (...args) => { registrations.push(args); return registration }
  const win = new Target()
  win.setInterval = fn => { interval = fn; return 1 }
  win.clearInterval = () => { cleared = true }
  const doc = new Target()
  doc.visibilityState = 'visible'
  const nav = { serviceWorker: workers, onLine: true }
  const module = { exports: {} }
  const source = fs.readFileSync(path.join(__dirname, '../lib/pwa-updates.ts'), 'utf8')
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
  vm.runInNewContext(compiled, { module, exports: module.exports, navigator: nav, window: win, document: doc, Date: { now: () => now }, console })
  const stop = module.exports.watchAppUpdates(() => { notices++ })
  return { workers, win, doc, nav, registrations, stop, advance: ms => { now += ms }, tick: () => interval(), checks: () => checks, notices: () => notices, cleared: () => cleared }
}

test('installed apps bypass the HTTP cache when checking the worker script', async () => {
  const f = fixture()
  await settle()
  assert.equal(f.registrations[0][0], '/sw.js')
  assert.equal(f.registrations[0][1].updateViaCache, 'none')
  f.advance(60_001)
  f.win.fire('focus')
  await settle()
  assert.equal(f.checks(), 1)
  f.stop()
})

test('checks are throttled and do not run offline or while hidden', async () => {
  const f = fixture()
  await settle()
  f.win.fire('focus')
  assert.equal(f.checks(), 0)
  f.advance(60_001)
  f.nav.onLine = false
  f.tick()
  assert.equal(f.checks(), 0)
  f.nav.onLine = true
  f.doc.visibilityState = 'hidden'
  f.tick()
  assert.equal(f.checks(), 0)
  f.doc.visibilityState = 'visible'
  f.doc.fire('visibilitychange')
  await settle()
  assert.equal(f.checks(), 1)
  f.stop()
})

test('upgrades notify once, without automatically reloading the app', () => {
  const f = fixture()
  f.workers.controller = {}
  f.workers.fire('controllerchange')
  f.workers.fire('controllerchange')
  assert.equal(f.notices(), 1)
  f.stop()
})

test('first installation does not incorrectly prompt for an update', () => {
  const f = fixture(false)
  f.workers.controller = {}
  f.workers.fire('controllerchange')
  assert.equal(f.notices(), 0)
  f.stop()
  assert.equal(f.cleared(), true)
  f.workers.fire('controllerchange')
  assert.equal(f.notices(), 0)
})

function workerFixture(fetch) {
  const handlers = {}, deleted = []
  let claimed = false
  const self = { location: { origin: 'https://hoodmart.example' }, addEventListener: (name, fn) => { handlers[name] = fn }, clients: { claim: async () => { claimed = true } } }
  const caches = { keys: async () => ['hoodmart-v2.2.0', 'hoodmart-v2.3.0', 'another-app'], delete: async key => { deleted.push(key) }, match: async () => undefined }
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../public/sw.js'), 'utf8'), { self, caches, fetch, URL, console })
  return { handlers, deleted, claimed: () => claimed }
}

test('worker never caches subscription/auth APIs, RSC payloads or the worker itself', () => {
  const f = workerFixture(() => { throw new Error('Unexpected fetch') })
  for (const [url, rsc] of [
    ['https://db.supabase.co/rest/v1/stores', false],
    ['https://hoodmart.example/api/sync', false],
    ['https://hoodmart.example/sw.js', false],
    ['https://hoodmart.example/dashboard', true],
  ]) {
    f.handlers.fetch({ request: { method: 'GET', url, headers: new Headers(rsc ? { RSC: '1' } : {}) }, respondWith: () => assert.fail('Request must bypass worker cache') })
  }
})

test('navigation fetches fresh app code instead of using the HTTP cache', async () => {
  let options, response
  const f = workerFixture(async (_, next) => { options = next; return { status: 200, type: 'default' } })
  f.handlers.fetch({ request: { method: 'GET', url: 'https://hoodmart.example/dashboard', headers: new Headers(), mode: 'navigate' }, respondWith: promise => { response = promise } })
  await response
  assert.equal(options.cache, 'no-store')
})

test('activation clears only obsolete HOODMART caches and claims existing windows', async () => {
  const f = workerFixture()
  let activation
  f.handlers.activate({ waitUntil: promise => { activation = promise } })
  await activation
  assert.deepEqual(f.deleted, ['hoodmart-v2.2.0'])
  assert.equal(f.claimed(), true)
})
