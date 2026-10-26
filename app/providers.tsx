'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import * as sync from '@/lib/sync'
import { getTheme, applyTheme } from '@/lib/theme'
import { watchAppUpdates } from '@/lib/pwa-updates'

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      })
  )

  useEffect(() => {
    applyTheme(getTheme())
  }, [])

  useEffect(() => {
    return watchAppUpdates(() => {
      toast((t) => (
        <div className="space-y-2 text-sm">
          <p>A HOODMART update is ready. Finish your current work, then update the app.</p>
          <div className="flex gap-3">
            <button className="font-semibold underline" onClick={() => {
              if (navigator.onLine) window.location.reload()
              else toast.error('Reconnect before updating the app.')
            }}>Update app</button>
            <button className="text-zinc-400" onClick={() => toast.dismiss(t.id)}>Later</button>
          </div>
        </div>
      ), { id: 'app-update', duration: Infinity })
    })
  }, [])

  useEffect(() => {
    const onOnline = async () => {
      toast.success('Back online. Syncing...', { id: 'net-status' })
      await sync.syncNow()
      toast.success('Sync complete', { id: 'net-status' })
    }
    const onOffline = () => {
      toast.error('Offline mode — all changes saved locally', { id: 'net-status' })
    }

    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)

    if (sync.isOnline()) {
      sync.syncNow().catch(() => {})
    } else {
      toast('Working offline', { id: 'net-status' })
    }

    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </QueryClientProvider>
  )
}
