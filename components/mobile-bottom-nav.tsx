'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BarChart3, Bot, Home, Package, ShoppingCart } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { hasPermission, PERMISSIONS } from '@/lib/auth'

const tabs = [
  { name: 'Home', href: '/dashboard', icon: Home, perm: null },
  { name: 'POS', href: '/pos', icon: ShoppingCart, perm: PERMISSIONS.PROCESS_SALES },
  { name: 'Kofi AI', href: '/dashboard/assistant', icon: Bot, perm: null },
  { name: 'Products', href: '/products', icon: Package, perm: PERMISSIONS.MANAGE_PRODUCTS },
  { name: 'Reports', href: '/reports', icon: BarChart3, perm: PERMISSIONS.VIEW_REPORTS },
]

export function MobileBottomNav({ onOpenAssistant, assistantOpen = false }: { onOpenAssistant: () => void; assistantOpen?: boolean }) {
  const pathname = usePathname()
  const { session } = useAuth()

  return (
    <nav
      aria-label="Main navigation"
      className="no-print fixed inset-x-0 bottom-0 z-40 flex items-end border-t border-zinc-700/70 bg-zinc-950/95 px-2 pt-2 backdrop-blur-xl lg:hidden"
      style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
    >
      {tabs.map((tab) => {
        const allowed = !tab.perm || hasPermission(session?.user ?? null, tab.perm)
        const current = !assistantOpen && (pathname === tab.href || (
          tab.href !== '/dashboard' && pathname.startsWith(`${tab.href}/`)
        ))
        const isAssistant = tab.name === 'Kofi AI'
        const Icon = tab.icon

        // Keep the assistant centered without exposing restricted destinations.
        if (!allowed) return <div key={tab.href} className="flex-1" aria-hidden="true" />

        if (isAssistant) return (
          <button key={tab.href} type="button" onClick={onOpenAssistant} aria-haspopup="dialog" aria-expanded={assistantOpen} className="flex min-h-[64px] min-w-0 flex-1 flex-col items-center justify-end gap-1 rounded-lg pb-1 text-[11px] font-medium text-yellow-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 sm:text-xs">
            <span className="-mt-5 flex h-14 w-14 items-center justify-center rounded-full border-2 border-yellow-400 bg-gradient-to-b from-yellow-500/20 to-zinc-950 shadow-[0_0_18px_rgba(250,204,21,0.45),inset_0_0_12px_rgba(250,204,21,0.12)]"><Bot aria-hidden="true" className="h-8 w-8" strokeWidth={1.5} /></span>
            <span>Kofi AI</span>
          </button>
        )

        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={current ? 'page' : undefined}
            className={`flex min-h-[64px] min-w-0 flex-1 flex-col items-center justify-end gap-1 rounded-lg pb-1 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 sm:text-xs ${
              current ? 'text-yellow-400' : 'text-zinc-400 hover:text-zinc-100'
            }`}
          >
            <Icon aria-hidden="true" className="h-6 w-6" strokeWidth={1.8} fill={current && tab.name === 'Home' ? 'currentColor' : 'none'} />
            <span className="truncate max-w-full">{tab.name}</span>
          </Link>
        )
      })}
    </nav>
  )
}
