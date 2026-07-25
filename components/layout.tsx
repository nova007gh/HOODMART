'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import {
  Store,
  ShoppingCart,
  Package,
  Users,
  Home,
  CreditCard,
  Database,
  Undo2,
  Tag,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  UserCheck,
  Tag as TagIcon,
  Brain,
  Briefcase,
  Truck,
  Activity,
} from 'lucide-react'

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: Home },
  { name: 'Point of Sale', href: '/pos', icon: ShoppingCart },
  { name: 'Products', href: '/products', icon: Package },
  { name: 'Inventory', href: '/inventory', icon: Database },
  { name: 'Activities', href: '/activities', icon: Activity },
  { name: 'Customers', href: '/customers', icon: Users },
  { name: 'Employees', href: '/employees', icon: Briefcase },
  { name: 'Suppliers', href: '/suppliers', icon: Truck },
  { name: 'Branches', href: '/branches', icon: Store },
  { name: 'Sales', href: '/sales', icon: CreditCard },
  { name: 'Returns', href: '/returns', icon: Undo2 },
  { name: 'Discounts', href: '/discounts', icon: Tag },
  { name: 'Labels', href: '/labels', icon: TagIcon },
  { name: 'Reports', href: '/reports', icon: BarChart3 },
  { name: 'Intelligence', href: '/dashboard/assistant', icon: Brain },
  { name: 'Settings', href: '/settings', icon: Settings },
]

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const { session, logout } = useAuth()
  const [storeName, setStoreName] = useState('EMDPOS')

  useEffect(() => {
    setStoreName(localStorage.getItem('emdpos_store_name') || 'EMDPOS')
  }, [])

  const handleLogout = () => {
    logout()
    router.push('/login')
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-zinc-900 border-r border-zinc-800 flex flex-col transform transition-transform duration-300 ease-in-out lg:transform-none ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="flex h-16 items-center justify-between px-6 border-b border-zinc-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center gold-gradient rounded-lg">
              <Store className="h-5 w-5 text-black" />
            </div>
            <span className="text-lg font-semibold text-white">{storeName}</span>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-zinc-400 hover:text-white">
            ×
          </button>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto">
          {navigation.map((item) => {
            const Icon = item.icon
            const current = pathname === item.href
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  current
                    ? 'bg-yellow-500/10 text-yellow-500 border-l-2 border-yellow-500'
                    : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
                }`}
              >
                <Icon className="h-5 w-5" />
                {item.name}
              </Link>
            )
          })}
        </nav>

        <div className="border-t border-zinc-800 p-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-zinc-700 flex items-center justify-center">
              <UserCheck className="h-4 w-4 text-zinc-300" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{session?.user.name || 'Guest'}</p>
              <p className="text-xs text-zinc-400 truncate">{session?.user.role || 'Unknown'}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="mt-3 w-full flex items-center gap-2 px-2 py-1 text-xs text-zinc-400 hover:text-white transition-colors"
          >
            <LogOut className="h-3 w-3" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0 flex flex-col min-h-screen">
        <header className="sticky top-0 z-30 bg-zinc-900 border-b border-zinc-800 h-16 flex items-center justify-between px-4 sm:px-6 lg:px-8">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden text-zinc-400 hover:text-white"
          >
            <Menu className="h-6 w-6" />
          </button>
          <div className="flex-1" />
          <Button asChild className="gold-gradient text-black">
            <Link href="/pos">
              <ShoppingCart className="h-4 w-4 mr-2" />
              New Sale
            </Link>
          </Button>
        </header>
        <div className="flex-1 p-4 sm:p-6 lg:p-8 overflow-x-hidden">{children}</div>
        <footer className="mt-auto px-4 py-3 border-t border-zinc-800 text-xs text-zinc-500 text-center space-y-1">
          <p>© EMD POS 2026, All rights reserved. MDLab Enterprise.</p>
          <p>Tel: 0244-6475-10 | www.emdulab.com | admin@emdulab.com</p>
        </footer>
      </main>
      {/* Floating Nova AI button — hidden on POS which has its own Sales AI */}
      {pathname !== '/pos' && (
        <Link
          href="/dashboard/assistant"
          className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40"
        >
          <div className="group flex items-center gap-2 pl-3 pr-4 py-2 gold-gradient rounded-full shadow-lg hover:shadow-yellow-500/30 transition-all hover:scale-105 active:scale-95">
            <Brain className="h-4 w-4 text-black" />
            <span className="text-xs font-bold text-black whitespace-nowrap">Kofi AI</span>
          </div>
        </Link>
      )}
    </div>
  )
}
