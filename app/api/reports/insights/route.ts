import { reportingContext, readSales, reportFailure, ReportError } from '@/lib/reporting/server'
import { summarizeSales } from '@/lib/reporting/summary'
import { parseDateRange, formatRangeLabel } from '@/lib/ai/date-range'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(request: Request) {
  try {
    const ctx = await reportingContext(request)
    const body = await request.json()
    if (typeof body.question !== 'string' || body.question.length > 500 || !body.question.trim()) throw new ReportError('Ask a question of 1–500 characters.')
    const range = parseDateRange(body.question)
    const asOf = new Date().toISOString()
    const end = range.end.toISOString() < asOf ? range.end.toISOString() : asOf
    const fullAccess = ['admin', 'manager'].includes(ctx.role)
    const own = !fullAccess || /\b(my|mine)\b/i.test(body.question)
    let sales = await readSales(ctx.db, ctx.storeId, range.start.toISOString(), end, own ? ctx.email : undefined)
    // An exact recorded salesperson name/email can narrow an administrator's
    // question; never infer identity from partial names or attribute anonymous sales.
    if (!own) {
      const names = new Map(sales.filter(s => s.userEmail).map(s => [s.userEmail!.toLowerCase(), s.userName || s.userEmail!]))
      const question = body.question.toLowerCase()
      const matched = Array.from(names).filter(([email, name]) => question.includes(email) || (name.length >= 5 && question.includes(name.toLowerCase())))
      if (matched.length === 1) sales = sales.filter(s => s.userEmail?.toLowerCase() === matched[0][0])
    }
    const report = summarizeSales(sales)
    const money = (value: number) => `GHS ${value.toFixed(2)}`
    const lines = [
      `**${own ? 'Your' : 'Store'} sales — ${formatRangeLabel(range)}**`,
      `- Revenue: ${money(report.revenue)}`,
      `- Transactions: ${report.transactions}; items sold: ${report.items}`,
      `- Average sale: ${money(report.average)}; discounts recorded: ${money(report.discounts)}`,
      `- Best item by quantity: ${report.bestItem ? `${report.bestItem.name} (${report.bestItem.quantity})` : 'No items sold'}`,
    ]
    if (/payment|cash|card|mobile/i.test(body.question)) {
      const payments = new Map<string, number>()
      for (const sale of sales) payments.set(sale.paymentMethod || 'unknown', (payments.get(sale.paymentMethod || 'unknown') || 0) + Math.round(Number(sale.total) * 100))
      lines.push('', '**Recorded payment methods**')
      for (const [method, cents] of Array.from(payments)) lines.push(`- ${method}: ${money(cents / 100)}`)
    }
    if (/last|recent|latest/i.test(body.question)) {
      lines.push('', '**Latest matching sales**')
      for (const sale of [...sales].sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 5)) lines.push(`- ${sale.timestamp}: ${money(Number(sale.total))} (${sale.paymentMethod || 'unknown'}), ${sale.userName || 'Unattributed'}.`)
    }
    if (fullAccess && /staff|cashier|salesperson|sales person|activit|employee|who|performance|analy[sz]/i.test(body.question)) {
      lines.push('', '**Recorded salesperson sales activity**')
      for (const person of report.staff) lines.push(`- ${person.name}: ${money(person.revenue)}, ${person.transactions} sales, ${person.items} items. First/last sale: ${person.firstSale} / ${person.lastSale}.`)
      if (!report.staff.length) lines.push('- No recorded sales in this period.')
      // Activity logs describe recorded inventory actions, not attendance or
      // evidence of wrongdoing. Paginate completely; never invent staff actions.
      const counts = new Map<string, number>()
      let activityError = false
      let undated = 0
      for (let offset = 0; ; offset += 1000) {
        const { data, error } = await ctx.db.from('activities').select('id,user,date').eq('store_id', ctx.storeId).order('id').range(offset, offset + 999)
        if (error) { activityError = true; break }
        for (const row of data || []) {
          // Legacy log dates are text. Do not silently misclassify ambiguous
          // local formats as an attendance record or a different business day.
          const text = String(row.date || '').replace(' ', 'T')
          const iso = text.length === 10 ? `${text}T00:00:00Z` : /(?:Z|[+-]\d{2}:\d{2})$/i.test(text) ? text : `${text}Z`
          const time = /^\d{4}-\d{2}-\d{2}/.test(text) ? Date.parse(iso) : NaN
          if (!Number.isFinite(time)) { undated++; continue }
          if (time < range.start.getTime() || time > Date.parse(end)) continue
          if (own && ![ctx.email, ctx.name.toLowerCase()].includes(String(row.user || '').toLowerCase())) continue
          counts.set(row.user || 'Unattributed', (counts.get(row.user || 'Unattributed') || 0) + 1)
        }
        if (!data || data.length < 1000) break
        if (offset >= 99000) { activityError = true; break }
      }
      lines.push('', `**${own ? 'Your' : 'Store'} inventory activity log counts**`)
      if (activityError) lines.push('- Activity logs could not be read completely; no activity totals are shown.')
      else if (!counts.size) lines.push('- No dated inventory activity records in this period.')
      else for (const [name, count] of Array.from(counts).sort((a, b) => b[1] - a[1])) lines.push(`- ${name}: ${count} logged actions.`)
      if (undated) lines.push(`- ${undated} activity records have missing/ambiguous dates and are excluded from period counts.`)
      lines.push('', 'These are recorded sales/action timestamps, not shift hours or proof of misconduct. Missing or unsynced activity cannot be assessed.')
    }
    lines.push('', `Source: all matching synced sales, paginated without the dashboard's 1,000-sale cap. As of ${asOf} (Ghana time/UTC). Unsynced device sales are excluded. Sales totals are not profit or a net-of-returns reconciliation.`)
    return Response.json({ answer: lines.join('\n'), report, range: formatRangeLabel(range), asOf })
  } catch (error) { return reportFailure(error) }
}
