'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { hasPermission, isAdmin, PERMISSIONS } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { SubscriptionGuard, SubscriptionBanner } from '@/components/subscription-guard'
import { NotificationBell } from '@/components/notification-bell'
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
  Gift,
  Receipt,
  FileText,
} from 'lucide-react'

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: Home, perm: null },
  { name: 'Point of Sale', href: '/pos', icon: ShoppingCart, perm: PERMISSIONS.PROCESS_SALES },
  { name: 'Products', href: '/products', icon: Package, perm: PERMISSIONS.MANAGE_PRODUCTS },
  { name: 'Inventory', href: '/inventory', icon: Database, perm: PERMISSIONS.MANAGE_INVENTORY },
  { name: 'Activities', href: '/activities', icon: Activity, perm: PERMISSIONS.MANAGE_INVENTORY },
  { name: 'Customers', href: '/customers', icon: Users, perm: PERMISSIONS.MANAGE_CUSTOMERS },
  { name: 'Employees', href: '/employees', icon: Briefcase, perm: PERMISSIONS.MANAGE_EMPLOYEES },
  { name: 'Suppliers', href: '/suppliers', icon: Truck, perm: PERMISSIONS.MANAGE_SUPPLIERS },
  { name: 'Branches', href: '/branches', icon: Store, perm: PERMISSIONS.MANAGE_BRANCHES },
  { name: 'Sales', href: '/sales', icon: CreditCard, perm: PERMISSIONS.VIEW_SALES_HISTORY },
  { name: 'Returns', href: '/returns', icon: Undo2, perm: PERMISSIONS.PROCESS_RETURNS },
  { name: 'Quotations', href: '/quotations', icon: FileText, perm: PERMISSIONS.MANAGE_QUOTATIONS },
  { name: 'Gift Cards', href: '/gift-cards', icon: Gift, perm: PERMISSIONS.MANAGE_GIFT_CARDS },
  { name: 'Expenses', href: '/expenses', icon: Receipt, perm: PERMISSIONS.MANAGE_EXPENSES },
  { name: 'Discounts', href: '/discounts', icon: Tag, perm: PERMISSIONS.MANAGE_DISCOUNTS },
  { name: 'Labels', href: '/labels', icon: TagIcon, perm: PERMISSIONS.MANAGE_PRODUCTS },
  { name: 'Reports', href: '/reports', icon: BarChart3, perm: PERMISSIONS.VIEW_REPORTS },
  { name: 'Intelligence', href: '/dashboard/assistant', icon: Brain, perm: null },
  { name: 'Billing', href: '/billing', icon: CreditCard, perm: PERMISSIONS.MANAGE_BILLING },
  { name: 'Settings', href: '/settings', icon: Settings, perm: null },
]

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const { session, logout } = useAuth()
  const [storeName, setStoreName] = useState('HOODMART')

  useEffect(() => {
    const name = session?.storeName
    if (name) {
      setStoreName(name)
      try { localStorage.setItem('hoodmart_store_name', name) } catch {}
    } else {
      try {
        setStoreName(localStorage.getItem('hoodmart_store_name') || 'HOODMART')
      } catch {
        setStoreName('HOODMART')
      }
    }
  }, [session])

  const handleLogout = async () => {
    await logout()
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
        <div className="flex h-16 items-center justify-between px-6 border-b border-yellow-500/20 shrink-0 bg-gradient-to-b from-yellow-500/5 to-transparent">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center gold-gradient rounded-lg shadow-[0_0_15px_rgba(250,204,21,0.3)]">
              <Store className="h-5 w-5 text-black" />
            </div>
            <span className="text-lg font-semibold gold-text tracking-wide">{storeName}</span>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-zinc-400 hover:text-white">
            ×
          </button>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto">
          {navigation.filter((item) => !item.perm || hasPermission(session?.user ?? null, item.perm)).map((item) => {
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
          <Link
            href="/profile"
            onClick={() => setSidebarOpen(false)}
            className="flex items-center gap-3 rounded-lg p-2 -m-2 transition-colors hover:bg-zinc-800/70"
          >
            {session?.user.avatar ? (
              <img
                src={session.user.avatar}
                alt={session.user.name}
                className="h-9 w-9 shrink-0 rounded-full object-cover ring-2 ring-yellow-500/40"
              />
            ) : (
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-700 ring-2 ring-zinc-600">
                <UserCheck className="h-4 w-4 text-zinc-300" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-medium text-white">{session?.user.name || 'Guest'}</p>
              <p className="truncate text-xs capitalize text-zinc-400">{session?.user.role || 'Unknown'}</p>
            </div>
          </Link>
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
        <SubscriptionBanner />
        <header className="sticky top-0 z-30 bg-zinc-900 border-b border-yellow-500/20 h-16 flex items-center justify-between px-4 sm:px-6 lg:px-8">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden text-zinc-400 hover:text-white"
          >
            <Menu className="h-6 w-6" />
          </button>
          <div className="flex-1" />
          <div className="flex items-center gap-2 sm:gap-3">
            {isAdmin(session?.user ?? null) && <NotificationBell />}
            {hasPermission(session?.user ?? null, PERMISSIONS.PROCESS_SALES) && (
              <Button asChild className="gold-gradient text-black">
                <Link href="/pos">
                  <ShoppingCart className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">New Sale</span>
                </Link>
              </Button>
            )}
          </div>
        </header>
        <div className="flex-1 p-4 sm:p-6 lg:p-8 overflow-x-hidden">
          <SubscriptionGuard>{children}</SubscriptionGuard>
        </div>
        <footer className="mt-auto px-4 py-3 border-t border-zinc-800 text-xs text-zinc-500 text-center space-y-1">
          <p>© HOODMART Retail OS 2026, All rights reserved.</p>
          <p>hoodmart@gmail.com</p>
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
