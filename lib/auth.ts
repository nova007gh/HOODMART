export interface User {
  email: string
  name: string
  role: string
  permissions?: string[]
}

export interface Session {
  user: User
  loggedInAt: number
}

type StoredUser = { password: string; name: string; role: string; permissions?: string[] }

const SESSION_KEY = 'emdpos_session'
const USERS_KEY = 'emdpos_users'

function getUsers(): Record<string, StoredUser> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(USERS_KEY)
    if (!raw) {
      // First time: seed default admin
      const defaultAdmin: Record<string, StoredUser> = {
        'nova@gmail.com': { password: 'qwerty123', name: 'Nova Admin', role: 'admin', permissions: ['*'] },
      }
      saveUsers(defaultAdmin)
      return defaultAdmin
    }
    const users = JSON.parse(raw) as Record<string, StoredUser>
    return users
  } catch {
    // If JSON is corrupted, try to preserve whatever we can
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

export function register(email: string, password: string, name: string, role: string = 'admin', permissions: string[] = []): boolean {
  const normalized = email.trim().toLowerCase()
  if (!normalized || !password) return false
  const users = getUsers()
  if (users[normalized]) return false
  users[normalized] = { password, name, role, permissions }
  const saved = saveUsers(users)
  if (!saved) return false
  const session: Session = { user: { email: normalized, name, role, permissions }, loggedInAt: Date.now() }
  try {
    if (typeof window !== 'undefined') localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  } catch {
    // ignore storage errors
  }
  return true
}

export function createUser(email: string, password: string, name: string, role: string = 'cashier', permissions: string[] = []): boolean {
  const normalized = email.trim().toLowerCase()
  if (!normalized || !password) return false
  const users = getUsers()
  if (users[normalized]) return false
  users[normalized] = { password, name, role, permissions }
  const saved = saveUsers(users)
  if (!saved) {
    console.error('createUser: saveUsers failed for', normalized)
    return false
  }
  // Verify the user can be found immediately after saving
  const verify = getUsers()
  if (!verify[normalized]) {
    console.error('createUser: verification failed - user not found after save')
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

export function login(email: string, password: string): Session | null {
  const normalized = email.trim().toLowerCase()
  const users = getUsers()
  const account = users[normalized]
  if (account && account.password === password) {
    const session: Session = {
      user: { email: normalized, name: account.name, role: account.role, permissions: account.permissions || [] },
      loggedInAt: Date.now(),
    }
    try {
      if (typeof window !== 'undefined') localStorage.setItem(SESSION_KEY, JSON.stringify(session))
    } catch {
      // ignore storage errors
    }
    return session
  }
  return null
}

export function logout(): void {
  try {
    if (typeof window !== 'undefined') localStorage.removeItem(SESSION_KEY)
  } catch {
    // ignore storage errors
  }
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

export function isAdmin(user: User | null): boolean {
  return user?.role === 'admin'
}

export function hasPermission(user: User | null, permission: string): boolean {
  if (!user) return false
  if (user.role === 'admin') return true
  return user.permissions?.includes(permission) ?? false
}

export function listUsers(): { email: string; name: string; role: string }[] {
  const users = getUsers()
  return Object.entries(users).map(([email, u]) => ({ email, name: u.name, role: u.role }))
}
