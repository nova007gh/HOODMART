'use client'

import { useEffect, useState, useRef } from 'react'
import { AuthGuard } from '@/components/auth-guard'
import { DashboardLayout } from '@/components/layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Settings, Store, Bell, Lock, Download, Upload, Trash2, KeyRound, Users, Palette, Sun, Moon, User, Mail, CreditCard, Tag as TagIcon, ArrowUpRight, Activity, FileText, Receipt, Building2, DollarSign, ShoppingCart, Wallet } from 'lucide-react'
import toast from 'react-hot-toast'
import { getSession, updateUser, isAdmin } from '@/lib/auth'
import { getTheme, setTheme, Theme } from '@/lib/theme'

import { KEYS as STORE_KEYS, store, money } from '@/lib/store'

const KEYS = [
  STORE_KEYS.PRODUCTS,
  STORE_KEYS.DISCOUNTS,
  STORE_KEYS.SALES,
  STORE_KEYS.CUSTOMERS,
  STORE_KEYS.SUSPENDED,
  STORE_KEYS.BRANCHES,
  'hoodmart_users',
  'hoodmart_session',
  'hoodmart_store_name',
  'hoodmart_store_address',
  'hoodmart_low_stock',
  'hoodmart_ai_rate_limit',
  'hoodmart_ai_audit',
  'hoodmart_ai_conversations',
  'hoodmart_ai_messages',
]

function buildBackup() {
  const data: Record<string, any> = {}
  KEYS.forEach((k) => { const v = localStorage.getItem(k); if (v) data[k] = v })
  return data
}

export default function SettingsPage() {
  const [storeName, setStoreName] = useState('HOODMART Store')
  const [address, setAddress] = useState('')
  const [lowStock, setLowStock] = useState(true)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [theme, setThemeState] = useState<Theme>('gold')
  const [userIsAdmin, setUserIsAdmin] = useState(false)
  const [emailAlerts, setEmailAlerts] = useState(true)
  const [allTimeStats, setAllTimeStats] = useState({ revenue: 0, orders: 0, customers: 0, profit: 0 })
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setStoreName(localStorage.getItem('hoodmart_store_name') || 'HOODMART Store')
    setAddress(localStorage.getItem('hoodmart_store_address') || '')
    setLowStock(localStorage.getItem('hoodmart_low_stock') !== 'false')
    setEmailAlerts(localStorage.getItem('hoodmart_email_alerts') !== 'false')
    setThemeState(getTheme())
    const session = getSession()
    setUserIsAdmin(isAdmin(session?.user ?? null))

    // Calculate all-time stats
    const sales = store.getSales()
    const products = store.getProducts()
    const totalRevenue = sales.reduce((sum, s) => sum + (s.total || 0), 0)
    const uniqueCustomers = new Set(sales.map((s) => s.customer).filter(Boolean)).size
    const grossProfit = sales.reduce((sum, s) => {
      const itemProfit = s.items.reduce((p, item) => {
        const prod = products.find((x) => x.id === item.id)
        const cost = prod?.cost || 0
        return p + (item.price - cost) * item.qty
      }, 0)
      return sum + itemProfit
    }, 0)
    setAllTimeStats({ revenue: totalRevenue, orders: sales.length, customers: uniqueCustomers, profit: grossProfit })
  }, [])

  const handleThemeChange = (t: Theme) => {
    setTheme(t)
    setThemeState(t)
    toast.success(`Switched to ${t === 'gold' ? 'Gold' : 'White'} theme`)
  }

  const save = (e: React.FormEvent) => {
    e.preventDefault()
    // Store identity is admin-only; sales staff can still save their own preferences
    if (userIsAdmin) {
      localStorage.setItem('hoodmart_store_name', storeName)
      localStorage.setItem('hoodmart_store_address', address)
      localStorage.setItem('hoodmart_email_alerts', emailAlerts ? 'true' : 'false')
    }
    localStorage.setItem('hoodmart_low_stock', lowStock ? 'true' : 'false')
    toast.success('Settings saved')
  }

  const changePassword = (e: React.FormEvent) => {
    e.preventDefault()
    const session = getSession()
    if (!session) return
    if (!newPassword || newPassword.length < 6) return toast.error('Password must be at least 6 characters')
    if (newPassword !== confirmPassword) return toast.error('Passwords do not match')
    updateUser(session.user.email, { password: newPassword })
    setNewPassword('')
    setConfirmPassword('')
    toast.success('Password changed successfully')
  }

  const exportData = () => {
    const data = buildBackup()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `hoodmart-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Backup downloaded')
  }

  const importData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string)
        Object.entries(data).forEach(([k, v]) => localStorage.setItem(k, v as string))
        toast.success('Backup restored. Reloading...')
        window.location.reload()
      } catch {
        toast.error('Invalid backup file')
      }
    }
    reader.readAsText(file)
  }

  const clearAll = () => {
    if (!confirm('Delete all data? This cannot be undone.')) return
    KEYS.forEach((k) => localStorage.removeItem(k))
    toast.success('All data cleared')
    window.location.reload()
  }

  return (
    <AuthGuard>
      <DashboardLayout>
        <form onSubmit={save} className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2"><Store className="h-5 w-5 text-yellow-500" /> Store Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {userIsAdmin ? (
                <>
                  <input value={storeName} onChange={(e) => setStoreName(e.target.value)} placeholder="Store name" />
                  <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Store address" />
                </>
              ) : (
                <>
                  <div className="space-y-1">
                    <p className="text-xs text-zinc-500">Store name</p>
                    <p className="text-sm font-medium text-white">{storeName}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-zinc-500">Store address</p>
                    <p className="text-sm text-zinc-300">{address || '—'}</p>
                  </div>
                  <p className="flex items-center gap-1.5 pt-1 text-xs text-zinc-500">
                    <Lock className="h-3 w-3" /> Only an administrator can change store details.
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          {userIsAdmin && (
            <Card className="glass-card md:col-span-2">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2"><DollarSign className="h-5 w-5 text-yellow-500" /> All-Time Business Stats</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="rounded-lg bg-zinc-900/60 border border-zinc-800 p-4">
                    <div className="flex items-center gap-2 text-zinc-400 text-xs mb-1">
                      <DollarSign className="h-3.5 w-3.5 text-yellow-500" /> Total Sales
                    </div>
                    <p className="text-xl font-bold gold-text">{money(allTimeStats.revenue)}</p>
                    <p className="text-xs text-zinc-500 mt-0.5">{allTimeStats.orders} transactions (all-time)</p>
                  </div>
                  <div className="rounded-lg bg-zinc-900/60 border border-zinc-800 p-4">
                    <div className="flex items-center gap-2 text-zinc-400 text-xs mb-1">
                      <ShoppingCart className="h-3.5 w-3.5 text-yellow-500" /> Total Orders
                    </div>
                    <p className="text-xl font-bold gold-text">{allTimeStats.orders.toLocaleString()}</p>
                    <p className="text-xs text-zinc-500 mt-0.5">All time orders</p>
                  </div>
                  <div className="rounded-lg bg-zinc-900/60 border border-zinc-800 p-4">
                    <div className="flex items-center gap-2 text-zinc-400 text-xs mb-1">
                      <Users className="h-3.5 w-3.5 text-yellow-500" /> Customers
                    </div>
                    <p className="text-xl font-bold gold-text">{allTimeStats.customers.toLocaleString()}</p>
                    <p className="text-xs text-zinc-500 mt-0.5">Unique customers</p>
                  </div>
                  <div className="rounded-lg bg-green-500/10 border border-green-500/20 p-4">
                    <div className="flex items-center gap-2 text-zinc-400 text-xs mb-1">
                      <Wallet className="h-3.5 w-3.5 text-green-500" /> Net Profit
                    </div>
                    <p className="text-xl font-bold text-green-400">{money(allTimeStats.profit)}</p>
                    <p className="text-xs text-zinc-500 mt-0.5">Estimated margin</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2"><User className="h-5 w-5 text-yellow-500" /> My Profile</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-zinc-400">Update your display name, phone number and profile picture.</p>
              <Button asChild type="button" className="gold-gradient text-black font-semibold">
                <Link href="/profile">Open My Profile</Link>
              </Button>
            </CardContent>
          </Card>

          {userIsAdmin && (
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2"><CreditCard className="h-5 w-5 text-yellow-500" /> Billing</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-zinc-400">Manage your subscription, view invoices and update payment methods.</p>
                <Button asChild type="button" variant="outline" className="border-zinc-700 text-zinc-300 hover:bg-zinc-800">
                  <Link href="/billing">Open Billing <ArrowUpRight className="h-3.5 w-3.5 ml-1 inline" /></Link>
                </Button>
              </CardContent>
            </Card>
          )}

          {userIsAdmin && (
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2"><TagIcon className="h-5 w-5 text-yellow-500" /> Labels</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-zinc-400">Generate and print product labels and barcodes for your inventory.</p>
                <Button asChild type="button" variant="outline" className="border-zinc-700 text-zinc-300 hover:bg-zinc-800">
                  <Link href="/labels">Open Labels <ArrowUpRight className="h-3.5 w-3.5 ml-1 inline" /></Link>
                </Button>
              </CardContent>
            </Card>
          )}

          {userIsAdmin && (
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2"><Activity className="h-5 w-5 text-yellow-500" /> Activities</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-zinc-400">View the log of team actions — sales, stock changes, customer additions and more.</p>
                <Button asChild type="button" variant="outline" className="border-zinc-700 text-zinc-300 hover:bg-zinc-800">
                  <Link href="/activities">Open Activities <ArrowUpRight className="h-3.5 w-3.5 ml-1 inline" /></Link>
                </Button>
              </CardContent>
            </Card>
          )}

          {userIsAdmin && (
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2"><Building2 className="h-5 w-5 text-yellow-500" /> Branches</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-zinc-400">Manage your store branches, view per-branch performance and assign staff.</p>
                <Button asChild type="button" variant="outline" className="border-zinc-700 text-zinc-300 hover:bg-zinc-800">
                  <Link href="/branches">Open Branches <ArrowUpRight className="h-3.5 w-3.5 ml-1 inline" /></Link>
                </Button>
              </CardContent>
            </Card>
          )}

          {userIsAdmin && (
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2"><FileText className="h-5 w-5 text-yellow-500" /> Quotations</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-zinc-400">Create and manage price quotations for customers and bulk buyers.</p>
                <Button asChild type="button" variant="outline" className="border-zinc-700 text-zinc-300 hover:bg-zinc-800">
                  <Link href="/quotations">Open Quotations <ArrowUpRight className="h-3.5 w-3.5 ml-1 inline" /></Link>
                </Button>
              </CardContent>
            </Card>
          )}

          {userIsAdmin && (
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2"><Receipt className="h-5 w-5 text-yellow-500" /> Expenses</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-zinc-400">Record and track business expenses — rent, utilities, supplies and more.</p>
                <Button asChild type="button" variant="outline" className="border-zinc-700 text-zinc-300 hover:bg-zinc-800">
                  <Link href="/expenses">Open Expenses <ArrowUpRight className="h-3.5 w-3.5 ml-1 inline" /></Link>
                </Button>
              </CardContent>
            </Card>
          )}

          {userIsAdmin && (
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2"><Palette className="h-5 w-5 text-yellow-500" /> Appearance</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-zinc-400">Choose the app's color theme for all users of your store.</p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => handleThemeChange('gold')}
                    className={`flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-all ${
                      theme === 'gold' ? 'border-yellow-500 bg-yellow-500/10' : 'border-zinc-700 hover:border-zinc-600'
                    }`}
                  >
                    <div className="h-10 w-10 rounded-full gold-gradient flex items-center justify-center">
                      <Moon className="h-5 w-5 text-black" />
                    </div>
                    <span className="text-sm font-medium text-white">Gold & Black</span>
                    {theme === 'gold' && <span className="text-xs text-yellow-500">Active</span>}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleThemeChange('white')}
                    className={`flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-all ${
                      theme === 'white' ? 'border-yellow-500 bg-yellow-500/10' : 'border-zinc-700 hover:border-zinc-600'
                    }`}
                  >
                    <div className="h-10 w-10 rounded-full bg-white border border-zinc-300 flex items-center justify-center">
                      <Sun className="h-5 w-5 text-amber-500" />
                    </div>
                    <span className="text-sm font-medium text-white">White & Gold</span>
                    {theme === 'white' && <span className="text-xs text-yellow-500">Active</span>}
                  </button>
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2"><Bell className="h-5 w-5 text-yellow-500" /> Notifications</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <label className="flex cursor-pointer items-center gap-2 text-zinc-300">
                <input type="checkbox" checked={lowStock} onChange={(e) => setLowStock(e.target.checked)} /> Low stock alerts
              </label>
              {userIsAdmin && (
                <>
                  <label className="flex cursor-pointer items-start gap-2 text-zinc-300">
                    <input
                      type="checkbox"
                      checked={emailAlerts}
                      onChange={(e) => setEmailAlerts(e.target.checked)}
                      className="mt-1"
                    />
                    <span>
                      <span className="flex items-center gap-1.5">
                        <Mail className="h-3.5 w-3.5 text-yellow-500" /> Email me team activity
                      </span>
                      <span className="mt-0.5 block text-xs text-zinc-500">
                        Receive an email when your sales staff complete a sale, add a customer or
                        record an expense.
                      </span>
                    </span>
                  </label>
                  <p className="text-xs text-zinc-500">
                    In-app activity from your team always appears in the bell icon at the top of the
                    screen.
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          {userIsAdmin && (
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2"><Download className="h-5 w-5 text-yellow-500" /> Backup & Restore</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-zinc-400">Export all products, sales, users and settings to a JSON file, or restore from a previous backup.</p>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" onClick={exportData} className="gold-gradient text-black"><Download className="h-4 w-4 mr-2" /> Export Backup</Button>
                  <Button type="button" onClick={() => fileRef.current?.click()} variant="outline" className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"><Upload className="h-4 w-4 mr-2" /> Import Backup</Button>
                  <input ref={fileRef} type="file" accept="application/json" onChange={importData} className="hidden" />
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2"><Lock className="h-5 w-5 text-yellow-500" /> Security</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <form onSubmit={changePassword} className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs text-zinc-400 flex items-center gap-1"><KeyRound className="h-3 w-3" /> New Password</label>
                  <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Enter new password" className="w-full bg-zinc-950 border border-zinc-800 text-white rounded p-2 text-sm" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-zinc-400">Confirm Password</label>
                  <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirm new password" className="w-full bg-zinc-950 border border-zinc-800 text-white rounded p-2 text-sm" />
                </div>
                <Button type="submit" variant="outline" className="border-zinc-700 text-zinc-300 hover:bg-zinc-800">Change Password</Button>
              </form>
            </CardContent>
          </Card>

          {userIsAdmin && (
            <Card className="glass-card md:col-span-2 border-red-500/20">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2"><Trash2 className="h-5 w-5 text-red-500" /> Danger Zone</CardTitle>
              </CardHeader>
              <CardContent>
                <Button type="button" onClick={clearAll} variant="outline" className="border-red-500/40 text-red-400 hover:bg-red-900/20">Clear All Data</Button>
              </CardContent>
            </Card>
          )}

          <div className="md:col-span-2">
            <Button type="submit" className="gold-gradient text-black font-bold">Save Settings</Button>
          </div>
        </form>
      </DashboardLayout>
    </AuthGuard>
  )
}
