export interface DateRange {
  start: Date
  end: Date
  label: string
}

const TIMEZONE = 'Africa/Accra'

function startOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function endOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(23, 59, 59, 999)
  return x
}

function startOfWeek(d: Date): Date {
  const x = startOfDay(d)
  const day = x.getDay()
  x.setDate(x.getDate() - day)
  return x
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999)
}

function startOfQuarter(d: Date): Date {
  const q = Math.floor(d.getMonth() / 3)
  return new Date(d.getFullYear(), q * 3, 1)
}

function endOfQuarter(d: Date): Date {
  const q = Math.floor(d.getMonth() / 3)
  return new Date(d.getFullYear(), q * 3 + 3, 0, 23, 59, 59, 999)
}

function startOfYear(d: Date): Date {
  return new Date(d.getFullYear(), 0, 1)
}

function endOfYear(d: Date): Date {
  return new Date(d.getFullYear(), 11, 31, 23, 59, 59, 999)
}

const MONTH_NAMES = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
]

function parseSpecificDate(text: string): { start: Date; end: Date } | null {
  const lower = text.toLowerCase()

  const dateMatch = lower.match(/(\d{1,2})(?:st|nd|rd|th)?\s+(\w+)(?:\s+(\d{4}))?/)
  if (dateMatch) {
    const day = parseInt(dateMatch[1], 10)
    const monthIdx = MONTH_NAMES.findIndex((m) => m.startsWith(dateMatch[2].slice(0, 3)))
    if (monthIdx >= 0) {
      const year = dateMatch[3] ? parseInt(dateMatch[3], 10) : new Date().getFullYear()
      const start = new Date(year, monthIdx, day)
      return { start, end: endOfDay(start) }
    }
  }

  const monthOnlyMatch = lower.match(new RegExp(`(?:in|during)\\s+(${MONTH_NAMES.join('|')})(?:\\s+(\\d{4}))?`))
  if (monthOnlyMatch) {
    const monthIdx = MONTH_NAMES.findIndex((m) => m.startsWith(monthOnlyMatch[1].slice(0, 3)))
    if (monthIdx >= 0) {
      const year = monthOnlyMatch[2] ? parseInt(monthOnlyMatch[2], 10) : new Date().getFullYear()
      const start = new Date(year, monthIdx, 1)
      return { start, end: endOfMonth(start) }
    }
  }

  return null
}

/**
 * Check if a question contains any date-related keywords.
 * Used to determine if a follow-up question needs context from
 * the previous question.
 */
export function hasDateKeyword(question: string): boolean {
  const lower = question.toLowerCase()
  return (
    lower.includes('today') ||
    lower.includes('yesterday') ||
    lower.includes('this week') ||
    lower.includes('last week') ||
    lower.includes('this month') ||
    lower.includes('last month') ||
    lower.includes('this quarter') ||
    lower.includes('last quarter') ||
    lower.includes('this year') ||
    lower.includes('last year') ||
    lower.includes('past ') ||
    lower.includes('last 7') ||
    lower.includes('last 30') ||
    /(\d{1,2})(?:st|nd|rd|th)?\s+(\w+)/.test(lower) ||
    new RegExp(`(?:in|during)\\s+(${MONTH_NAMES.join('|')})`).test(lower)
  )
}

export function parseDateRange(question: string): DateRange {
  const now = new Date()
  const lower = question.toLowerCase()
  const today = startOfDay(now)

  if (lower.includes('today')) {
    return { start: today, end: endOfDay(now), label: 'Today' }
  }

  if (lower.includes('yesterday')) {
    const y = new Date(today)
    y.setDate(y.getDate() - 1)
    return { start: y, end: endOfDay(y), label: 'Yesterday' }
  }

  if (lower.includes('this week')) {
    return { start: startOfWeek(now), end: endOfDay(now), label: 'This week' }
  }

  if (lower.includes('last week')) {
    const ws = startOfWeek(now)
    ws.setDate(ws.getDate() - 7)
    const we = new Date(ws)
    we.setDate(we.getDate() + 6)
    return { start: ws, end: endOfDay(we), label: 'Last week' }
  }

  if (lower.includes('this month')) {
    return { start: startOfMonth(now), end: endOfDay(now), label: 'This month' }
  }

  if (lower.includes('last month')) {
    const m = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    return { start: m, end: endOfMonth(m), label: 'Last month' }
  }

  if (lower.includes('this quarter')) {
    return { start: startOfQuarter(now), end: endOfDay(now), label: 'This quarter' }
  }

  if (lower.includes('last quarter')) {
    const q = startOfQuarter(now)
    q.setMonth(q.getMonth() - 3)
    return { start: q, end: endOfQuarter(q), label: 'Last quarter' }
  }

  if (lower.includes('this year')) {
    return { start: startOfYear(now), end: endOfDay(now), label: 'This year' }
  }

  if (lower.includes('last year')) {
    const y = new Date(now.getFullYear() - 1, 0, 1)
    return { start: y, end: endOfYear(y), label: 'Last year' }
  }

  const pastDaysMatch = lower.match(/past\s+(\d+)\s+days?/)
  if (pastDaysMatch) {
    const days = parseInt(pastDaysMatch[1], 10)
    const start = new Date(today)
    start.setDate(start.getDate() - (days - 1))
    return { start, end: endOfDay(now), label: `Past ${days} days` }
  }

  if (lower.includes('past 7 days') || lower.includes('last 7 days')) {
    const start = new Date(today)
    start.setDate(start.getDate() - 6)
    return { start, end: endOfDay(now), label: 'Past 7 days' }
  }

  if (lower.includes('past 30 days') || lower.includes('last 30 days')) {
    const start = new Date(today)
    start.setDate(start.getDate() - 29)
    return { start, end: endOfDay(now), label: 'Past 30 days' }
  }

  const specific = parseSpecificDate(lower)
  if (specific) {
    return { start: specific.start, end: specific.end, label: specific.start.toLocaleDateString('en-GH', { year: 'numeric', month: 'long', day: 'numeric' }) }
  }

  return { start: new Date(0), end: endOfDay(now), label: 'All time' }
}

export function formatRangeLabel(range: DateRange): string {
  const opts: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' }
  const startStr = range.start.toLocaleDateString('en-GH', opts)
  const endStr = range.end.toLocaleDateString('en-GH', opts)
  if (startStr === endStr) return startStr
  return `${startStr} – ${endStr}`
}

export function isInDateRange(timestamp: string, range: DateRange): boolean {
  const ts = new Date(timestamp).getTime()
  return ts >= range.start.getTime() && ts <= range.end.getTime()
}

export { TIMEZONE }
