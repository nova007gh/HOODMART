export interface AuditEntry {
  id: string
  timestamp: string
  user: string
  role: string
  question: string
  toolsUsed: string[]
  dateRange: string
  status: 'success' | 'error' | 'denied'
  durationMs: number
  model?: string
  error?: string
}

const AUDIT_KEY = 'hoodmart_ai_audit'

function getAuditLog(): AuditEntry[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(AUDIT_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveAuditLog(log: AuditEntry[]) {
  if (typeof window === 'undefined') return
  const trimmed = log.slice(0, 500)
  localStorage.setItem(AUDIT_KEY, JSON.stringify(trimmed))
}

export function logAudit(entry: Omit<AuditEntry, 'id'>): void {
  const log = getAuditLog()
  const id = Math.random().toString(36).slice(2) + Date.now().toString(36)
  log.unshift({ ...entry, id })
  saveAuditLog(log)
}

export function getAuditEntries(limit = 50): AuditEntry[] {
  return getAuditLog().slice(0, limit)
}

export function clearAuditLog(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(AUDIT_KEY)
}
