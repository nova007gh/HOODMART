'use client'

import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { OwnerAuthGuard, ownerSignOut } from '@/components/owner/owner-auth-guard'
import { LayoutDashboard, LogOut, ShieldCheck } from 'lucide-react'

export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()

  if (pathname === '/owner/login') {
    return <>{children}</>
  }

  return (
    <OwnerAuthGuard>
      <div className="min-h-screen bg-black text-zinc-100 flex">
        <aside className="w-56 shrink-0 border-r border-zinc-800 bg-zinc-950 flex flex-col">
          <div className="h-16 flex items-center gap-2 px-4 border-b border-zinc-800">
            <ShieldCheck className="h-5 w-5 text-yellow-500" />
            <span className="font-bold text-sm">Owner Console</span>
          </div>
          <nav className="flex-1 p-3 space-y-1">
            <Link
              href="/owner"
              className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-zinc-300 hover:bg-zinc-900 hover:text-white transition-colors"
            >
              <LayoutDashboard className="h-4 w-4" />
              Dashboard
            </Link>
          </nav>
          <div className="p-3 border-t border-zinc-800">
            <button
              onClick={async () => {
                await ownerSignOut()
                router.replace('/owner/login')
              }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </button>
          </div>
        </aside>
        <main className="flex-1 min-w-0 p-6 overflow-x-hidden">{children}</main>
      </div>
    </OwnerAuthGuard>
  )
}
