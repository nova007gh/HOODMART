/** Check installed apps for fresh code without interrupting an in-progress sale. */
export function watchAppUpdates(onUpdate: () => void): () => void {
  if (!('serviceWorker' in navigator)) return () => {}

  const workers = navigator.serviceWorker
  let controlled = Boolean(workers.controller)
  let registration: ServiceWorkerRegistration | undefined
  let stopped = false
  let pending = false
  let lastChecked = Date.now()
  let notified = false

  const controllerChanged = () => {
    if (!workers.controller) return
    if (controlled && !notified) {
      notified = true
      onUpdate()
    }
    controlled = true
  }
  const check = () => {
    if (!registration || stopped || pending || !navigator.onLine || document.visibilityState !== 'visible') return
    if (Date.now() - lastChecked < 60_000) return
    lastChecked = Date.now()
    pending = true
    registration.update().catch((error) => {
      console.warn('App update check failed:', error)
    }).finally(() => { pending = false })
  }

  workers.addEventListener('controllerchange', controllerChanged)
  workers.register('/sw.js', { updateViaCache: 'none' }).then((next) => {
    if (!stopped) registration = next
  }).catch((error) => {
    console.warn('Service worker registration failed:', error)
  })
  const interval = window.setInterval(check, 5 * 60 * 1000)
  window.addEventListener('focus', check)
  window.addEventListener('online', check)
  document.addEventListener('visibilitychange', check)

  return () => {
    stopped = true
    window.clearInterval(interval)
    workers.removeEventListener('controllerchange', controllerChanged)
    window.removeEventListener('focus', check)
    window.removeEventListener('online', check)
    document.removeEventListener('visibilitychange', check)
  }
}
