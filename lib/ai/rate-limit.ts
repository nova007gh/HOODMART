const RATE_LIMIT_KEY = 'hoodmart_ai_rate_limit'
const MAX_REQUESTS_PER_HOUR = 50
const MAX_REQUESTS_PER_MINUTE = 10

interface RateLimitEntry {
  timestamp: number
}

function getRateLimitData(): RateLimitEntry[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(RATE_LIMIT_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveRateLimitData(data: RateLimitEntry[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(data.slice(-200)))
}

export function checkRateLimit(): { allowed: boolean; reason?: string } {
  const now = Date.now()
  const data = getRateLimitData().filter((e) => now - e.timestamp < 3600000)

  const lastMinute = data.filter((e) => now - e.timestamp < 60000)
  if (lastMinute.length >= MAX_REQUESTS_PER_MINUTE) {
    return { allowed: false, reason: 'Rate limit: Too many requests in the last minute. Please wait a moment.' }
  }

  if (data.length >= MAX_REQUESTS_PER_HOUR) {
    return { allowed: false, reason: 'Rate limit: Maximum requests per hour reached. Please try again later.' }
  }

  return { allowed: true }
}

export function recordRequest() {
  const data = getRateLimitData()
  data.push({ timestamp: Date.now() })
  saveRateLimitData(data)
}

export function getRemainingRequests(): { minute: number; hour: number } {
  const now = Date.now()
  const data = getRateLimitData().filter((e) => now - e.timestamp < 3600000)
  const lastMinute = data.filter((e) => now - e.timestamp < 60000)
  return {
    minute: Math.max(0, MAX_REQUESTS_PER_MINUTE - lastMinute.length),
    hour: Math.max(0, MAX_REQUESTS_PER_HOUR - data.length),
  }
}
