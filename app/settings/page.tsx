'use client'

import { useEffect, useState, useRef } from 'react'
import { AuthGuard } from '@/components/auth-guard'
import { DashboardLayout } from '@/components/layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Settings, Store, Bell, Lock, Download, Upload, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'

import { KEYS as STORE_KEYS } from '@/lib/store'

const KEYS = [
  STORE_KEYS.PRODUCTS,
  STORE_KEYS.DISCOUNTS,
  STORE_KEYS.SALES,
  STORE_KEYS.CUSTOMERS,
  STORE_KEYS.SUSPENDED,
  STORE_KEYS.BRANCHES,
  'emdpos_users',
  'emdpos_session',
  'emdpos_store_name',
  'emdpos_store_address',
  'emdpos_low_stock',
  'emdpos_ai_rate_limit',
  'emdpos_ai_audit',
  'emdpos_ai_conversations',
  'emdpos_ai_messages',
]

function buildBackup() {
  const data: Record<string, any> = {}
  KEYS.forEach((k) => { const v = localStorage.getItem(k); if (v) data[k] = v })
  return data
}

export default function SettingsPage() {
  const [storeName, setStoreName] = useState('EMDPOS Store')
  const [address, setAddress] = useState('')
  const [lowStock, setLowStock] = useState(true)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setStoreName(localStorage.getItem('emdpos_store_name') || 'EMDPOS Store')
    setAddress(localStorage.getItem('emdpos_store_address') || '')
    setLowStock(localStorage.getItem('emdpos_low_stock') !== 'false')
  }, [])

  const save = (e: React.FormEvent) => {
    e.preventDefault()
    localStorage.setItem('emdpos_store_name', storeName)
    localStorage.setItem('emdpos_store_address', address)
    localStorage.setItem('emdpos_low_stock', lowStock ? 'true' : 'false')
    toast.success('Settings saved')
  }

  const exportData = () => {
    const data = buildBackup()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `emdpos-backup-${new Date().toISOString().slice(0, 10)}.json`
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
              <input value={storeName} onChange={(e) => setStoreName(e.target.value)} placeholder="Store name" />
              <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Store address" />
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2"><Bell className="h-5 w-5 text-yellow-500" /> Notifications</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <label className="flex items-center gap-2 text-zinc-300">
                <input type="checkbox" checked={lowStock} onChange={(e) => setLowStock(e.target.checked)} /> Low stock alerts
              </label>
            </CardContent>
          </Card>

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

          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2"><Lock className="h-5 w-5 text-yellow-500" /> Security</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <input type="password" placeholder="New password (coming soon)" disabled title="Password editing coming soon" />
            </CardContent>
          </Card>

          <Card className="glass-card md:col-span-2">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2"><Trash2 className="h-5 w-5 text-red-500" /> Danger Zone</CardTitle>
            </CardHeader>
            <CardContent>
              <Button type="button" onClick={clearAll} variant="outline" className="border-red-500/40 text-red-400 hover:bg-red-900/20">Clear All Data</Button>
            </CardContent>
          </Card>

          <div className="md:col-span-2">
            <Button type="submit" className="gold-gradient text-black font-bold">Save Settings</Button>
          </div>
        </form>
      </DashboardLayout>
    </AuthGuard>
  )
}
