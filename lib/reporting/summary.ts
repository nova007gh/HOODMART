import type { Sale } from '@/lib/store'

export interface SalesReport {
  revenue: number
  transactions: number
  items: number
  discounts: number
  average: number
  bestItem: { name: string; quantity: number } | null
  staff: Array<{ email: string; name: string; revenue: number; transactions: number; items: number; firstSale: string; lastSale: string }>
}

export function summarizeSales(sales: Sale[]): SalesReport {
  const products = new Map<string, { name: string; quantity: number }>()
  const staff = new Map<string, SalesReport['staff'][number]>()
  let cents = 0, discounts = 0, items = 0
  for (const sale of sales) {
    if (sale.total == null || !Number.isFinite(Number(sale.total)) || !Number.isFinite(Number(sale.discount || 0))) throw new Error('A sale contains an invalid amount. Review it before finalizing a report.')
    cents += Math.round(Number(sale.total || 0) * 100)
    discounts += Math.round(Number(sale.discount || 0) * 100)
    const email = (sale.userEmail || '').trim().toLowerCase()
    const key = email || 'unattributed'
    const person = staff.get(key) || { email, name: sale.userName || email || 'Unattributed', revenue: 0, transactions: 0, items: 0, firstSale: sale.timestamp, lastSale: sale.timestamp }
    person.revenue += Math.round(Number(sale.total || 0) * 100)
    person.transactions++
    person.firstSale = person.firstSale < sale.timestamp ? person.firstSale : sale.timestamp
    person.lastSale = person.lastSale > sale.timestamp ? person.lastSale : sale.timestamp
    for (const item of sale.items || []) {
      const qty = Number(item.qty || 0)
      if (!Number.isFinite(qty)) throw new Error('A sale contains an invalid item quantity. Review it before finalizing a report.')
      items += qty
      person.items += qty
      const product = products.get(item.id || item.name) || { name: item.name || 'Unnamed item', quantity: 0 }
      product.quantity += qty
      products.set(item.id || item.name, product)
    }
    staff.set(key, person)
  }
  return {
    revenue: cents / 100, transactions: sales.length, items, discounts: discounts / 100,
    average: sales.length ? cents / 100 / sales.length : 0,
    bestItem: Array.from(products.values()).sort((a, b) => b.quantity - a.quantity || a.name.localeCompare(b.name))[0] || null,
    staff: Array.from(staff.values()).map(person => ({ ...person, revenue: person.revenue / 100 })).sort((a, b) => b.revenue - a.revenue),
  }
}

// Ghana observes UTC all year. Use UTC boundaries, never the browser timezone.
export function ghanaDay(now = new Date()) {
  const date = now.toISOString().slice(0, 10)
  return { date, start: `${date}T00:00:00.000Z`, end: now.toISOString() }
}

export function previousMonth(now = new Date()) {
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1))
  return { period: start.toISOString().slice(0, 7), start: start.toISOString(), end: end.toISOString() }
}

export function normalizeGhanaPhone(input: string): string | null {
  const phone = input.replace(/[\s()+-]/g, '')
  if (/^0\d{9}$/.test(phone)) return `233${phone.slice(1)}`
  return /^233\d{9}$/.test(phone) ? phone : null
}

function ascii(input: string, max: number) {
  // ASCII subset avoids UCS-2 and GSM extension-table double-width characters.
  return input.normalize('NFKD').replace(/[^a-zA-Z0-9 .,:/()'-]/g, '').replace(/\s+/g, ' ').trim().slice(0, max)
}

export function reportSMS(kind: 'daily' | 'monthly', period: string, report: SalesReport, cashier = ''): string {
  const label = kind === 'daily' ? `Shift ${ascii(cashier, 20)} ${period}` : `Month ${period}`
  const core = `HOODMART ${label}: GHS ${report.revenue.toFixed(2)}; ${report.transactions} sales; ${report.items} items.`
  const best = report.bestItem ? ` Top: ${ascii(report.bestItem.name, 24)} x${report.bestItem.quantity}.` : ''
  const text = `${core}${best}`
  if (text.length > 160) {
    if (core.length > 160) throw new Error('Report exceeds a single SMS segment')
    return core
  }
  return text
}
