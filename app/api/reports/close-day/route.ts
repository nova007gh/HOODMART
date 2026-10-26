import { ghanaDay, summarizeSales, reportSMS } from '@/lib/reporting/summary'
import { reportingContext, readSales, reportFailure, ReportError } from '@/lib/reporting/server'
import { queueSMS } from '@/lib/reporting/sms'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

async function existingClose(ctx: Awaited<ReturnType<typeof reportingContext>>, date: string) {
  const { data, error } = await ctx.db.from('cashier_day_closes').select('*').eq('store_id', ctx.storeId).eq('user_id', ctx.userId).eq('business_date', date).maybeSingle()
  if (error) throw new ReportError('Day closing needs the reporting migration. Checkout is unaffected.', 503)
  return data
}

export async function GET(request: Request) {
  try {
    const ctx = await reportingContext(request)
    const day = ghanaDay()
    const closed = await existingClose(ctx, day.date)
    if (closed) return Response.json({ date: day.date, report: closed.summary, cutoff: closed.cutoff_at, closed: true })
    const sales = await readSales(ctx.db, ctx.storeId, day.start, day.end, ctx.email)
    return Response.json({ date: day.date, report: summarizeSales(sales), cutoff: day.end, closed: false })
  } catch (error) { return reportFailure(error) }
}

export async function POST(request: Request) {
  try {
    const ctx = await reportingContext(request)
    const day = ghanaDay()
    const body = await request.json()
    if (body.date !== day.date) throw new ReportError('The business date changed. Reopen today\'s report before closing.')
    let closed = await existingClose(ctx, day.date)
    if (!closed) {
      const sales = await readSales(ctx.db, ctx.storeId, day.start, day.end, ctx.email)
      if (!sales.length) throw new ReportError('No synced sales for your account today. Nothing was closed.')
      const { data, error } = await ctx.db.from('cashier_day_closes').insert({ store_id: ctx.storeId, user_id: ctx.userId, cashier_name: ctx.name, business_date: day.date, cutoff_at: day.end, summary: summarizeSales(sales) }).select('*').single()
      if (error?.code === '23505') closed = await existingClose(ctx, day.date)
      else if (error) throw new ReportError('Could not save the shift report. Try again; sales remain unchanged.', 503)
      else closed = data
    }
    if (!closed) throw new ReportError('Could not verify shift close.', 503)
    const sms = await queueSMS(ctx.db, ctx.storeId, `daily:${ctx.userId}:${day.date}`, 'daily', reportSMS('daily', day.date, closed.summary, closed.cashier_name))
    return Response.json({ date: day.date, report: closed.summary, cutoff: closed.cutoff_at, closed: true, sms })
  } catch (error) { return reportFailure(error) }
}
