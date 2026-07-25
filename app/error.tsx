'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Application error:', error)
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 p-4">
      <div className="max-w-md w-full text-center space-y-4">
        <div className="h-16 w-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto">
          <span className="text-2xl">⚠️</span>
        </div>
        <h1 className="text-xl font-bold text-white">Something went wrong</h1>
        <p className="text-sm text-zinc-400">
          An unexpected error occurred. Try refreshing the page. If the problem persists, clear your browser cache.
        </p>
        <div className="flex gap-3 justify-center">
          <Button onClick={reset} className="gold-gradient text-black font-bold">
            Try again
          </Button>
          <Button
            variant="outline"
            className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
            onClick={() => {
              if ('caches' in window) {
                caches.keys().then((names) => names.forEach((n) => caches.delete(n)))
              }
              if ('serviceWorker' in navigator) {
                navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister()))
              }
              window.location.href = '/'
            }}
          >
            Clear cache & reload
          </Button>
        </div>
      </div>
    </div>
  )
}
