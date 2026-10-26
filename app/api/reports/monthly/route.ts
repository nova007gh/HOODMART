import { timingSafeEqual } from 'node:crypto'
import { reportingDB, readSales, reportFailure, ReportError } from '@/lib/reporting/server'
import { previousMonth, summarizeSales, reportSMS } from '@/lib/reporting/summary'
import { queueSMS, deliverSMS } from '@/lib/reporting/sms'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: Request) {
  try {
    const expected = process.env.CRON_SECRET
    const supplied = request.headers.get('authorization') || ''
    const target = `Bearer ${expected}`
    if (!expected || Buffer.byteLength(supplied) !== Buffer.byteLength(target) || !timingSafeEqual(Buffer.from(supplied), Buffer.from(target))) throw new ReportError('Unauthorized', 401)
    const db = reportingDB()
    const now = new Date()
    let reports = 0
    // Usually created on the 1st at 08:00. Daily runs can catch up after an
    // outage (or late opt-in); the persistent month key still permits one SMS.
    if (now.getUTCHours() >= 8) {
      const period = previousMonth(now)
      for (let offset = 0; ; offset += 100) {
        const { data: settings, error } = await db.from('sms_report_settings').select('store_id').eq('enabled', true).eq('monthly_enabled', true).order('store_id').range(offset, offset + 99)
        if (error) throw new ReportError('Could not read monthly report settings.', 503)
        for (const setting of settings || []) {
          const { data: job, error: jobError } = await db.from('sms_report_outbox').select('id').eq('store_id', setting.store_id).eq('dedupe_key', `monthly:${period.period}`).maybeSingle()
          if (jobError) throw new ReportError('Could not verify monthly deduplication.', 503)
          if (job) continue
          const report = summarizeSales(await readSales(db, setting.store_id, period.start, period.end, undefined, true))
          await queueSMS(db, setting.store_id, `monthly:${period.period}`, 'monthly', reportSMS('monthly', period.period, report), false)
          reports++
        }
        if (!settings || settings.length < 100) break
      }
    }
    // Only queued/never-attempted jobs are safe to send. Never auto-retry
    // ambiguous or rejected campaigns: the provider has no idempotency key.
    const { error: staleError } = await db.from('sms_report_outbox').update({ status: 'unknown', updated_at: now.toISOString() }).eq('status', 'sending').lt('updated_at', new Date(now.getTime() - 5 * 60000).toISOString())
    if (staleError) throw new ReportError('Could not reconcile interrupted SMS attempts.', 503)
    const { data: queued, error } = await db.from('sms_report_outbox').select('*').eq('status', 'queued').order('created_at').limit(3)
    if (error) throw new ReportError('Could not read the SMS queue.', 503)
    for (const job of queued || []) await deliverSMS(db, job)
    return Response.json({ ok: true, reports, queuedChecked: queued?.length || 0 })
  } catch (error) { return reportFailure(error) }
}
