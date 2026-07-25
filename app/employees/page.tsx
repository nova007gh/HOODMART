'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AuthGuard } from '@/components/auth-guard'
import { DashboardLayout } from '@/components/layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { store, Employee } from '@/lib/store'
import { createUser, updateUser, deleteUser, getSession, isAdmin } from '@/lib/auth'
import { Users, Search, User, Mail, Phone, Shield, Pencil, Trash2, X } from 'lucide-react'
import toast from 'react-hot-toast'

const ROLES = ['cashier', 'inventory', 'manager', 'admin']
const PERMISSIONS = [
  'manage_employees',
  'manage_products',
  'manage_inventory',
  'process_sales',
  'view_reports',
  'manage_discounts',
  'manage_branches',
]

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
  permissions: [],
}

export default function EmployeesPage() {
  const router = useRouter()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [search, setSearch] = useState('')
  const [form, setForm] = useState<FormState>(emptyForm)
  const [editId, setEditId] = useState<string | null>(null)
  const [editEmail, setEditEmail] = useState<string | null>(null)
  const [isAdminUser, setIsAdminUser] = useState(false)

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
      e.name.toLowerCase().includes(term) ||
      (e.username || '').toLowerCase().includes(term) ||
      (e.email || '').toLowerCase().includes(term) ||
      (e.phone || '').toLowerCase().includes(term) ||
      (e.role || '').toLowerCase().includes(term)
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

  const submit = (e: React.FormEvent) => {
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
      const created = createUser(form.email, form.password, form.name, form.role, form.permissions)
      if (!created) return toast.error('An account with that email already exists')
      store.addEmployee({
        name: form.name,
        username: form.username,
        email: form.email,
        phone: form.phone,
        role: form.role,
        permissions: form.permissions,
      })
      toast.success('Employee created')
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

  if (!isAdminUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-900 text-zinc-400">
        Checking admin access…
      </div>
    )
  }

  return (
    <AuthGuard>
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
              <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Full name" required className="bg-zinc-950 border-zinc-800 text-white" />
                <Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="Username" className="bg-zinc-950 border-zinc-800 text-white" />
                <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Email" type="email" required className="bg-zinc-950 border-zinc-800 text-white" />
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Phone" className="bg-zinc-950 border-zinc-800 text-white" />
                <Input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder={editId ? 'New password (optional)' : 'Password'} type="password" required={!editId} className="bg-zinc-950 border-zinc-800 text-white" />
                <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="h-10 rounded-md bg-zinc-950 border border-zinc-800 text-white px-3 focus:outline-none focus:ring-1 focus:ring-yellow-500">
                  {ROLES.map((r) => <option key={r} value={r} className="capitalize">{r}</option>)}
                </select>
                <div className="sm:col-span-2 lg:col-span-3 flex flex-wrap gap-2">
                  {PERMISSIONS.map((perm) => {
                    const active = form.permissions.includes(perm)
                    return (
                      <button
                        key={perm}
                        type="button"
                        onClick={() => togglePermission(perm)}
                        className={`text-xs px-3 py-1.5 rounded-full border transition ${active ? 'border-yellow-500 bg-yellow-500/10 text-yellow-400' : 'border-zinc-700 text-zinc-400 hover:border-zinc-500'}`}
                      >
                        {perm.replace(/_/g, ' ')}
                      </button>
                    )
                  })}
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
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => startEdit(emp)} className="p-1.5 text-zinc-500 hover:text-yellow-400"><Pencil className="h-4 w-4" /></button>
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
                          <span key={p} className="text-[10px] px-2 py-0.5 rounded-full border border-zinc-700 text-zinc-400">{p.replace(/_/g, ' ')}</span>
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
    </AuthGuard>
  )
}
