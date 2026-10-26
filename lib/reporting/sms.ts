import { ReportError, type ReportingDB } from './server'

export function smsConfigured() {
  return Boolean(process.env.BMS_SMS_API_KEY && /^[A-Za-z0-9 ]{1,11}$/.test(process.env.BMS_SMS_SENDER || ''))
}

export async function queueSMS(db: ReportingDB, storeId: string, key: string, kind: 'daily' | 'monthly', message: string, deliverNow = true) {
  if (message.length > 160 || !/^[a-zA-Z0-9 .,:;/()'-]+$/.test(message)) throw new ReportError('SMS report must fit one basic-GSM segment.')
  const { data: settings, error } = await db.from('sms_report_settings').select('*').eq('store_id', storeId).maybeSingle()
  if (error) throw new ReportError('SMS report settings are not installed yet.', 503)
  if (!settings?.enabled || !settings[`${kind}_enabled`]) return 'disabled'
  const { error: insertError } = await db.from('sms_report_outbox').upsert({ store_id: storeId, dedupe_key: key, kind, recipient: settings.phone, message }, { onConflict: 'store_id,dedupe_key', ignoreDuplicates: true })
  if (insertError) throw new ReportError('Report saved, but its SMS could not be queued. Reopen the close report to try queueing again.', 503)
  const { data: job, error: readError } = await db.from('sms_report_outbox').select('*').eq('store_id', storeId).eq('dedupe_key', key).single()
  if (readError) throw new ReportError('Could not verify SMS queue status.', 503)
  return deliverNow ? deliverSMS(db, job) : job.status
}

export async function deliverSMS(db: ReportingDB, job: any): Promise<string> {
  if (job.status !== 'queued' || !smsConfigured()) return job.status
  // A compare-and-set claim prevents concurrent requests/cron runs from sending
  // twice. Ambiguous provider outcomes are NEVER automatically retried.
  const { data: claim, error } = await db.from('sms_report_outbox').update({ status: 'sending', updated_at: new Date().toISOString() }).eq('id', job.id).eq('status', 'queued').select('id').maybeSingle()
  if (error) throw new ReportError('Could not claim the SMS job safely.', 503)
  if (!claim) return 'sending'
  const { data: settings, error: settingsError } = await db.from('sms_report_settings').select('*').eq('store_id', job.store_id).single()
  if (settingsError) {
    await db.from('sms_report_outbox').update({ status: 'queued', updated_at: new Date().toISOString() }).eq('id', job.id)
    return 'queued'
  }
  if (!settings.enabled || !settings[`${job.kind}_enabled`] || settings.phone !== job.recipient) {
    await db.from('sms_report_outbox').update({ status: 'canceled', updated_at: new Date().toISOString() }).eq('id', job.id)
    return 'canceled'
  }
  let status = 'unknown'
  let providerId: string | null = null
  try {
    const endpoint = new URL('https://api.mnotify.com/api/sms/quick')
    endpoint.searchParams.set('key', process.env.BMS_SMS_API_KEY!)
    const response = await fetch(endpoint, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipient: [job.recipient], sender: process.env.BMS_SMS_SENDER, message: job.message, is_schedule: false, schedule_date: '' }),
      signal: AbortSignal.timeout(12000), cache: 'no-store',
    })
    const body = await response.json()
    if (response.ok && body.status === 'success' && String(body.code) === '2000' && Number(body.summary?.total_sent) === 1 && Number(body.summary?.total_rejected) === 0) {
      status = 'accepted'
      providerId = String(body.summary._id || '') || null
    } else if (body.status === 'error' && Number(body.summary?.total_sent) === 0) {
      status = 'rejected'
    }
  } catch {
    // A timeout may occur AFTER acceptance. Never log the API-key URL or resend
    // automatically: an administrator must reconcile it with BMS first.
  }
  const { error: saveError } = await db.from('sms_report_outbox').update({ status, provider_id: providerId, updated_at: new Date().toISOString() }).eq('id', job.id).eq('status', 'sending')
  if (saveError) return 'unknown'
  return status
}
