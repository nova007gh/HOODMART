import { supabase, isSupabaseConfigured } from '@/lib/supabase/client'

export interface User {
  email: string
  name: string
  role: string
  permissions?: string[]
  storeId?: string
  avatar?: string
  phone?: string
}

export interface Session {
  user: User
  loggedInAt: number
  storeId?: string
  /** The store/business name — distinct from the signed-in person's name. */
  storeName?: string
}

type StoredUser = { password: string; name: string; role: string; permissions?: string[], storeId?: string }

const SESSION_KEY = 'hoodmart_session'
const USERS_KEY = 'hoodmart_users'

function getUsers(): Record<string, StoredUser> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(USERS_KEY)
    if (!raw) return {}
    const users = JSON.parse(raw) as Record<string, StoredUser>
    return users
  } catch {
    return {}
  }
}

function saveUsers(users: Record<string, StoredUser>): boolean {
  if (typeof window === 'undefined') return false
  try {
    const json = JSON.stringify(users)
    localStorage.setItem(USERS_KEY, json)
    // Verify the write actually persisted
    const verify = localStorage.getItem(USERS_KEY)
    if (verify !== json) {
      console.error('User save verification failed: data mismatch')
      return false
    }
    return true
  } catch (err) {
    console.error('Failed to save users to localStorage:', err)
    return false
  }
}

export async function register(email: string, password: string, name: string, role: string = 'admin', permissions: string[] = []): Promise<{ ok: boolean; error?: string }> {
  const normalized = email.trim().toLowerCase()
  if (!normalized || !password) return { ok: false, error: 'Email and password are required' }

  // If Supabase is configured, use Supabase Auth (creates store via DB trigger)
  if (isSupabaseConfigured() && supabase) {
    try {
      const { data, error } = await supabase.auth.signUp({
        email: normalized,
        password,
        options: { data: { store_name: name || normalized } }
      })
      if (error) return { ok: false, error: error.message || JSON.stringify(error) || 'Sign up failed' }
      if (!data.user) return { ok: false, error: 'Registration failed - no user returned' }

      // If email confirmation is required, data.session will be null
      // but data.user still exists. We proceed either way.
      // The store trigger should have already created the store.

      // Wait briefly for the trigger to complete
      await new Promise((r) => setTimeout(r, 500))

      // Fetch the store_id and store name from store_members + stores
      let storeId: string | undefined
      let storeName: string | undefined
      try {
        const { data: memberData, error: memberError } = await supabase
          .from('store_members')
          .select('store_id, stores(name)')
          .eq('user_id', data.user.id)
          .single()
        if (memberError) {
          console.warn('store_members query error:', memberError)
        }
        storeId = memberData?.store_id
        storeName = (memberData as any)?.stores?.name
      } catch (e) {
        console.warn('Could not fetch store_id:', e)
      }

      // Update the store name if the trigger used the email as fallback
      if (storeId && storeName && storeName !== name) {
        try {
          await supabase.from('stores').update({ name }).eq('id', storeId)
          storeName = name
        } catch (e) {
          console.warn('Could not update store name:', e)
        }
      }

      const displayName = storeName || name
      const session: Session = {
        user: { email: normalized, name: displayName, role, permissions, storeId },
        loggedInAt: Date.now(),
        storeId,
        storeName: displayName,
      }
      try {
        if (typeof window !== 'undefined') localStorage.setItem(SESSION_KEY, JSON.stringify(session))
      } catch {}
      return { ok: true }
    } catch (err: any) {
      return { ok: false, error: err.message || 'Registration failed' }
    }
  }

  // Fallback: localStorage auth
  const users = getUsers()
  if (users[normalized]) return { ok: false, error: 'An account with this email already exists' }
  users[normalized] = { password, name, role, permissions }
  const saved = saveUsers(users)
  if (!saved) return { ok: false, error: 'Failed to save user data' }
  const session: Session = { user: { email: normalized, name, role, permissions }, loggedInAt: Date.now() }
  try {
    if (typeof window !== 'undefined') localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  } catch {}
  return { ok: true }
}

export async function createUser(email: string, password: string, name: string, role: string = 'cashier', permissions: string[] = []): Promise<boolean> {
  const normalized = email.trim().toLowerCase()
  if (!normalized || !password) return false

  // If Supabase is configured, create auth user via API route
  if (isSupabaseConfigured()) {
    try {
      const session = getSession()
      const storeId = session?.storeId || session?.user?.storeId
      if (!storeId) {
        console.error('createUser: No storeId in session')
        return false
      }
      const res = await fetch('/api/create-employee', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalized, password, name, role, permissions, storeId }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        console.error('createUser API error:', data.error)
        return false
      }
      return true
    } catch (err) {
      console.error('createUser: fetch failed:', err)
      return false
    }
  }

  // Fallback: localStorage auth
  const users = getUsers()
  if (users[normalized]) return false
  users[normalized] = { password, name, role, permissions }
  const saved = saveUsers(users)
  if (!saved) {
    console.error('createUser: saveUsers failed for', normalized)
    return false
  }
  return true
}

export function updateUser(email: string, updates: Partial<StoredUser>): boolean {
  const normalized = email.trim().toLowerCase()
  const users = getUsers()
  if (!users[normalized]) return false
  users[normalized] = { ...users[normalized], ...updates }
  if (updates.password) users[normalized].password = updates.password
  return saveUsers(users)
}

export function deleteUser(email: string): void {
  const normalized = email.trim().toLowerCase()
  const users = getUsers()
  delete users[normalized]
  saveUsers(users)
}

export async function login(email: string, password: string): Promise<Session | null> {
  const normalized = email.trim().toLowerCase()

  // If Supabase is configured, use Supabase Auth
  if (isSupabaseConfigured() && supabase) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: normalized,
        password,
      })
      if (error || !data.user) return null

      // Fetch store_id, store name, role, and permissions from store_members
      let storeId: string | undefined
      let storeName: string | undefined
      let role = 'admin'
      let permissions: string[] = ['*']
      try {
        const { data: memberData } = await supabase
          .from('store_members')
          .select('store_id, role, permissions, stores(name)')
          .eq('user_id', data.user.id)
          .single()
        if (memberData) {
          storeId = memberData.store_id
          storeName = (memberData as any)?.stores?.name
          role = memberData.role || 'admin'
          const perms = memberData.permissions
          if (Array.isArray(perms)) {
            permissions = perms
          } else if (typeof perms === 'string') {
            try { permissions = JSON.parse(perms) } catch {}
          }
        }
      } catch {}

      // Fetch this person's own profile (name / avatar / phone) from employees
      let personName: string | undefined
      let avatar: string | undefined
      let phone: string | undefined
      try {
        const { data: empRows } = await supabase
          .from('employees')
          .select('name, avatar, phone')
          .eq('email', normalized)
          .limit(1)
        const emp = empRows?.[0] as any
        if (emp) {
          personName = emp.name || undefined
          avatar = emp.avatar || undefined
          phone = emp.phone || undefined
        }
      } catch {}

      // Fall back to permissions implied by the role when none are stored
      if (!permissions.length) permissions = defaultPermissionsForRole(role)

      const name =
        personName ||
        data.user.user_metadata?.name ||
        storeName ||
        data.user.user_metadata?.store_name ||
        data.user.email?.split('@')[0] ||
        'Store Owner'

      const session: Session = {
        user: { email: normalized, name, role, permissions, storeId, avatar, phone },
        loggedInAt: Date.now(),
        storeId,
        storeName: storeName || data.user.user_metadata?.store_name || 'HOODMART',
      }
      try {
        if (typeof window !== 'undefined') localStorage.setItem(SESSION_KEY, JSON.stringify(session))
      } catch {}
      return session
    } catch {
      return null
    }
  }

  // Fallback: localStorage auth
  const users = getUsers()
  const account = users[normalized]
  if (account && account.password === password) {
    const session: Session = {
      user: { email: normalized, name: account.name, role: account.role, permissions: account.permissions || [], storeId: account.storeId },
      loggedInAt: Date.now(),
      storeId: account.storeId,
    }
    try {
      if (typeof window !== 'undefined') localStorage.setItem(SESSION_KEY, JSON.stringify(session))
    } catch {}
    return session
  }
  return null
}

export async function logout(): Promise<void> {
  if (isSupabaseConfigured() && supabase) {
    try { await supabase.auth.signOut() } catch {}
  }
  try {
    if (typeof window !== 'undefined') localStorage.removeItem(SESSION_KEY)
  } catch {}
}

export function getSession(): Session | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    return JSON.parse(raw) as Session
  } catch {
    return null
  }
}

export function isAuthenticated(): boolean {
  return typeof window !== 'undefined' && !!getSession()
}

/** Merge fields into the current session's user and persist it. */
export function updateSessionUser(updates: Partial<User>): Session | null {
  const session = getSession()
  if (!session) return null
  session.user = { ...session.user, ...updates }
  try {
    if (typeof window !== 'undefined') localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  } catch {}
  return session
}

export function isAdmin(user: User | null): boolean {
  return user?.role === 'admin'
}

export function hasPermission(user: User | null, permission: string): boolean {
  if (!user) return false
  if (user.role === 'admin') return true
  if (user.permissions?.includes('*')) return true
  return user.permissions?.includes(permission) ?? false
}

// ---------------------------------------------------------------------------
// Permission catalogue
// ---------------------------------------------------------------------------

export const PERMISSIONS = {
  PROCESS_SALES: 'process_sales',
  MANAGE_CUSTOMERS: 'manage_customers',
  MANAGE_EXPENSES: 'manage_expenses',
  MANAGE_PRODUCTS: 'manage_products',
  MANAGE_INVENTORY: 'manage_inventory',
  MANAGE_EMPLOYEES: 'manage_employees',
  MANAGE_BRANCHES: 'manage_branches',
  MANAGE_DISCOUNTS: 'manage_discounts',
  MANAGE_SUPPLIERS: 'manage_suppliers',
  MANAGE_GIFT_CARDS: 'manage_gift_cards',
  MANAGE_QUOTATIONS: 'manage_quotations',
  PROCESS_RETURNS: 'process_returns',
  VIEW_SALES_HISTORY: 'view_sales_history',
  VIEW_REPORTS: 'view_reports',
  MANAGE_BILLING: 'manage_billing',
  MANAGE_STORE_SETTINGS: 'manage_store_settings',
} as const

export const ALL_PERMISSIONS: string[] = Object.values(PERMISSIONS)

/** Permissions a sales person (cashier / salesgirl) gets by default:
 *  sell products, add customers, record expenses. Nothing else. */
export const SALES_PERSON_PERMISSIONS: string[] = [
  PERMISSIONS.PROCESS_SALES,
  PERMISSIONS.MANAGE_CUSTOMERS,
  PERMISSIONS.MANAGE_EXPENSES,
]

export const ROLE_DEFAULT_PERMISSIONS: Record<string, string[]> = {
  admin: ['*'],
  manager: [
    PERMISSIONS.PROCESS_SALES,
    PERMISSIONS.MANAGE_CUSTOMERS,
    PERMISSIONS.MANAGE_EXPENSES,
    PERMISSIONS.MANAGE_PRODUCTS,
    PERMISSIONS.MANAGE_INVENTORY,
    PERMISSIONS.MANAGE_SUPPLIERS,
    PERMISSIONS.PROCESS_RETURNS,
    PERMISSIONS.VIEW_SALES_HISTORY,
    PERMISSIONS.VIEW_REPORTS,
  ],
  cashier: SALES_PERSON_PERMISSIONS,
  salesgirl: SALES_PERSON_PERMISSIONS,
  inventory: [PERMISSIONS.MANAGE_INVENTORY, PERMISSIONS.MANAGE_PRODUCTS],
}

export function defaultPermissionsForRole(role: string): string[] {
  return ROLE_DEFAULT_PERMISSIONS[role] ?? SALES_PERSON_PERMISSIONS
}

export const PERMISSION_LABELS: Record<string, string> = {
  [PERMISSIONS.PROCESS_SALES]: 'Sell products (POS)',
  [PERMISSIONS.MANAGE_CUSTOMERS]: 'Add customers',
  [PERMISSIONS.MANAGE_EXPENSES]: 'Record expenses',
  [PERMISSIONS.MANAGE_PRODUCTS]: 'Manage products',
  [PERMISSIONS.MANAGE_INVENTORY]: 'Manage inventory',
  [PERMISSIONS.MANAGE_EMPLOYEES]: 'Manage employees',
  [PERMISSIONS.MANAGE_BRANCHES]: 'Manage branches',
  [PERMISSIONS.MANAGE_DISCOUNTS]: 'Manage discounts',
  [PERMISSIONS.MANAGE_SUPPLIERS]: 'Manage suppliers',
  [PERMISSIONS.MANAGE_GIFT_CARDS]: 'Manage gift cards',
  [PERMISSIONS.MANAGE_QUOTATIONS]: 'Manage quotations',
  [PERMISSIONS.PROCESS_RETURNS]: 'Process returns',
  [PERMISSIONS.VIEW_SALES_HISTORY]: 'View sales history',
  [PERMISSIONS.VIEW_REPORTS]: 'View reports',
  [PERMISSIONS.MANAGE_BILLING]: 'Manage billing',
  [PERMISSIONS.MANAGE_STORE_SETTINGS]: 'Change store settings',
}

export function listUsers(): { email: string; name: string; role: string }[] {
  const users = getUsers()
  return Object.entries(users).map(([email, u]) => ({ email, name: u.name, role: u.role }))
}

export function getStoreId(): string | undefined {
  const session = getSession()
  return session?.storeId || session?.user?.storeId
}

export function setStoreId(storeId: string): void {
  const session = getSession()
  if (session) {
    session.storeId = storeId
    session.user.storeId = storeId
    try {
      if (typeof window !== 'undefined') localStorage.setItem(SESSION_KEY, JSON.stringify(session))
    } catch {}
  }
}
