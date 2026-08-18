'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AuthGuard, PermissionGuard } from '@/components/auth-guard'
import { DashboardLayout } from '@/components/layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { store, Employee } from '@/lib/store'
import {
  createUser,
  updateUser,
  deleteUser,
  getSession,
  isAdmin,
  ALL_PERMISSIONS,
  PERMISSION_LABELS,
  defaultPermissionsForRole,
} from '@/lib/auth'
import { Users, Search, User, Mail, Phone, Shield, Pencil, Trash2, X } from 'lucide-react'
import toast from 'react-hot-toast'

const ROLES = ['salesgirl', 'cashier', 'inventory', 'manager', 'admin']
const PERMISSIONS = ALL_PERMISSIONS

type FormState = {
  name: string
  username: string
  email: string
  phone: string
  password: string
  role: string
  permissions: string[]
}

const emptyForm: FormState = {
  name: '',
  username: '',
  email: '',
  phone: '',
  password: '',
  role: 'cashier',
  permissions: defaultPermissionsForRole('cashier'),
}

export default function EmployeesPage() {
  const router = useRouter()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [search, setSearch] = useState('')
  const [form, setForm] = useState<FormState>(emptyForm)
  const [editId, setEditId] = useState<string | null>(null)
  const [editEmail, setEditEmail] = useState<string | null>(null)
  const [isAdminUser, setIsAdminUser] = useState(false)
  const [createdCreds, setCreatedCreds] = useState<{ email: string; password: string; name: string } | null>(null)

  const load = () => {
    const session = getSession()
    if (!session || !isAdmin(session.user)) {
      router.replace('/dashboard')
      return
    }
    setIsAdminUser(true)
    setEmployees(store.getEmployees())
  }

  useEffect(() => { load() }, [router])

  const stats = useMemo(() => {
    const active = employees.filter((e) => !e.deleted).length
    return { total: employees.length, active }
  }, [employees])

  const filtered = useMemo(() => {
    const term = search.toLowerCase()
    return employees.filter((e) =>
      String(e.name || '').toLowerCase().includes(term) ||
      String(e.username || '').toLowerCase().includes(term) ||
      String(e.email || '').toLowerCase().includes(term) ||
      String(e.phone || '').toLowerCase().includes(term) ||
      String(e.role || '').toLowerCase().includes(term)
    )
  }, [employees, search])

  const togglePermission = (perm: string) => {
    setForm((f) => ({
      ...f,
      permissions: f.permissions.includes(perm)
        ? f.permissions.filter((p) => p !== perm)
        : [...f.permissions, perm],
    }))
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name) return toast.error('Name is required')
    if (!form.email) return toast.error('Email is required')

    if (editId) {
      if (!editEmail) return
      store.updateEmployee(editId, {
        name: form.name,
        username: form.username,
        email: form.email,
        phone: form.phone,
        role: form.role,
        permissions: form.permissions,
      })
      updateUser(editEmail, {
        name: form.name,
        role: form.role,
        permissions: form.permissions,
        password: form.password || undefined,
      })
      toast.success('Employee updated')
    } else {
      if (!form.password) return toast.error('Password is required for new employee')
      const created = await createUser(form.email, form.password, form.name, form.role, form.permissions)
      if (!created) return toast.error('Failed to create employee account. That email may already be registered.')
      store.addEmployee({
        name: form.name,
        username: form.username,
        email: form.email,
        phone: form.phone,
        role: form.role,
        permissions: form.permissions,
      })
      setCreatedCreds({ email: form.email.trim().toLowerCase(), password: form.password, name: form.name })
      toast.success(`Employee created! Login with ${form.email.trim().toLowerCase()}`)
    }

    setForm(emptyForm)
    setEditId(null)
    setEditEmail(null)
    setEmployees(store.getEmployees())
  }

  const startEdit = (emp: Employee) => {
    setEditId(emp.id)
    setEditEmail(emp.email || null)
    setForm({
      name: emp.name,
      username: emp.username || '',
      email: emp.email || '',
      phone: emp.phone || '',
      password: '',
      role: emp.role || 'cashier',
      permissions: emp.permissions || [],
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const cancelEdit = () => {
    setEditId(null)
    setEditEmail(null)
    setForm(emptyForm)
  }

  const remove = (emp: Employee) => {
    store.deleteEmployee(emp.id)
    if (emp.email) deleteUser(emp.email)
    setEmployees(store.getEmployees())
    toast.success('Employee removed')
  }

  const toggleStatus = (emp: Employee) => {
    store.updateEmployee(emp.id, { deleted: !emp.deleted })
    setEmployees(store.getEmployees())
    toast.success(emp.deleted ? 'Employee activated' : 'Employee deactivated')
  }

  if (!isAdminUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-900 text-zinc-400">
        Checking admin access…
      </div>
    )
  }

  return (
    <AuthGuard>
      <PermissionGuard permission="manage_employees">
      <DashboardLayout>
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="card-gold"><CardContent className="p-4"><p className="text-zinc-400 text-sm">Total Employees</p><p className="text-2xl font-bold gold-text">{stats.total}</p></CardContent></Card>
            <Card className="card-gold"><CardContent className="p-4"><p className="text-zinc-400 text-sm">Active</p><p className="text-2xl font-bold gold-text">{stats.active}</p></CardContent></Card>
            <Card className="card-gold"><CardContent className="p-4"><p className="text-zinc-400 text-sm">Inactive</p><p className="text-2xl font-bold gold-text">{stats.total - stats.active}</p></CardContent></Card>
          </div>

          <Card className="glass-card">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <CardTitle className="text-white flex items-center gap-2"><Users className="h-5 w-5 text-yellow-500" /> {editId ? 'Edit Employee' : 'Add Employee'}</CardTitle>
              {editId && <Button variant="outline" onClick={cancelEdit} className="text-zinc-300 border-zinc-700"><X className="h-4 w-4 mr-1" /> Cancel</Button>}
            </CardHeader>
            <CardContent className="space-y-4">
              {createdCreds && (
                <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-4 space-y-2">
                  <p className="text-sm font-semibold text-green-400">✓ Employee Created Successfully</p>
                  <p className="text-xs text-zinc-300">Share these login credentials with <span className="text-white font-medium">{createdCreds.name}</span>:</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-zinc-950 border border-zinc-800 rounded p-2">
                      <p className="text-zinc-500">Login Email</p>
                      <p className="text-white font-mono">{createdCreds.email}</p>
                    </div>
                    <div className="bg-zinc-950 border border-zinc-800 rounded p-2">
                      <p className="text-zinc-500">Password</p>
                      <p className="text-white font-mono">{createdCreds.password}</p>
                    </div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => setCreatedCreds(null)} className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 mt-2">Dismiss</Button>
                </div>
              )}
              <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-zinc-400 font-medium">Full Name *</label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Ama Serwaa" required className="bg-zinc-950 border-zinc-800 text-white" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-zinc-400 font-medium">Username</label>
                  <Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="e.g. aserwaa" className="bg-zinc-950 border-zinc-800 text-white" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-zinc-400 font-medium">Email (Login ID) *</label>
                  <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="e.g. ama@store.com" type="email" required className="bg-zinc-950 border-zinc-800 text-white" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-zinc-400 font-medium">Phone</label>
                  <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="e.g. 0244-123-456" className="bg-zinc-950 border-zinc-800 text-white" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-zinc-400 font-medium">Password {editId ? '(leave blank to keep)' : '*'}</label>
                  <Input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder={editId ? 'New password (optional)' : 'Set a password'} type="password" required={!editId} className="bg-zinc-950 border-zinc-800 text-white" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-zinc-400 font-medium">Role</label>
                  <select
                    value={form.role}
                    onChange={(e) => {
                      const role = e.target.value
                      // Applying a role pre-selects the permissions that role should have
                      setForm((f) => ({ ...f, role, permissions: defaultPermissionsForRole(role).filter((p) => p !== '*') }))
                    }}
                    className="h-10 rounded-md bg-zinc-950 border border-zinc-800 text-white px-3 focus:outline-none focus:ring-1 focus:ring-yellow-500"
                  >
                    {ROLES.map((r) => <option key={r} value={r} className="capitalize">{r}</option>)}
                  </select>
                </div>
                <div className="sm:col-span-2 lg:col-span-3 space-y-2">
                  <p className="text-xs font-medium text-zinc-400">
                    What this person can do
                    {form.role === 'admin' && (
                      <span className="ml-2 text-yellow-500">Administrators always have full access.</span>
                    )}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {PERMISSIONS.map((perm) => {
                      const active = form.role === 'admin' || form.permissions.includes(perm)
                      return (
                        <button
                          key={perm}
                          type="button"
                          disabled={form.role === 'admin'}
                          onClick={() => togglePermission(perm)}
                          className={`text-xs px-3 py-1.5 rounded-full border transition disabled:cursor-not-allowed disabled:opacity-60 ${active ? 'border-yellow-500 bg-yellow-500/10 text-yellow-400' : 'border-zinc-700 text-zinc-400 hover:border-zinc-500'}`}
                        >
                          {PERMISSION_LABELS[perm] || perm.replace(/_/g, ' ')}
                        </button>
                      )
                    })}
                  </div>
                </div>
                <div className="sm:col-span-2 lg:col-span-3">
                  <Button type="submit" className="gold-gradient text-black w-full sm:w-auto">{editId ? 'Update Employee' : 'Create Employee'}</Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <CardTitle className="text-white flex items-center gap-2"><Shield className="h-5 w-5 text-yellow-500" /> Manage Employees</CardTitle>
              <div className="relative max-w-xs">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-500" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search employees..." className="pl-9 bg-zinc-950 border-zinc-800 text-white placeholder:text-zinc-500" />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map((emp) => (
                  <Card key={emp.id} className={`bg-zinc-900/60 border-zinc-800 p-4 ${emp.deleted ? 'opacity-60' : ''}`}>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-yellow-500/10 flex items-center justify-center">
                          <User className="h-5 w-5 text-yellow-500" />
                        </div>
                        <div>
                          <p className="font-semibold text-white">{emp.name}</p>
                          <p className="text-xs text-zinc-400">{emp.username || 'No username'} · <span className="text-yellow-500 capitalize">{emp.role || 'cashier'}</span></p>
                        </div>
                        {emp.deleted && <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30">Inactive</span>}
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => startEdit(emp)} className="p-1.5 text-zinc-500 hover:text-yellow-400"><Pencil className="h-4 w-4" /></button>
                        <button onClick={() => toggleStatus(emp)} className={`p-1.5 ${emp.deleted ? 'text-green-500 hover:text-green-400' : 'text-zinc-500 hover:text-zinc-300'}`} title={emp.deleted ? 'Activate' : 'Deactivate'}><Shield className="h-4 w-4" /></button>
                        <button onClick={() => remove(emp)} className="p-1.5 text-zinc-500 hover:text-red-400"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </div>
                    <div className="mt-3 space-y-1 text-xs text-zinc-400">
                      {emp.email && <p className="flex items-center gap-2"><Mail className="h-3 w-3" /> {emp.email}</p>}
                      {emp.phone && <p className="flex items-center gap-2"><Phone className="h-3 w-3" /> {emp.phone}</p>}
                    </div>
                    {emp.permissions && emp.permissions.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1">
                        {emp.permissions.map((p) => (
                          <span key={p} className="text-[10px] px-2 py-0.5 rounded-full border border-zinc-700 text-zinc-400">{p === '*' ? 'full access' : (PERMISSION_LABELS[p] || p.replace(/_/g, ' '))}</span>
                        ))}
                      </div>
                    )}
                  </Card>
                ))}
                {filtered.length === 0 && <p className="text-zinc-500 col-span-full">No employees found.</p>}
              </div>
            </CardContent>
          </Card>

        </div>
      </DashboardLayout>
      </PermissionGuard>
    </AuthGuard>
  )
}
