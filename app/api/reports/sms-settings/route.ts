import { reportingContext, reportFailure, ReportError } from '@/lib/reporting/server'
import { normalizeGhanaPhone } from '@/lib/reporting/summary'
import { smsConfigured } from '@/lib/reporting/sms'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { db, storeId } = await reportingContext(request, true)
    const { data, error } = await db.from('sms_report_settings').select('*').eq('store_id', storeId).maybeSingle()
    if (error) throw new ReportError('SMS reporting needs the reporting migration before it can be configured.', 503)
    const { data: recent, error: logError } = await db.from('sms_report_outbox').select('id,kind,status,message,created_at,provider_id').eq('store_id', storeId).order('created_at', { ascending: false }).limit(10)
    if (logError) throw new ReportError('Could not read SMS report history.', 503)
    return Response.json({ settings: data || { enabled: false, daily_enabled: true, monthly_enabled: true, phone: '' }, providerReady: smsConfigured(), recent: recent || [] })
  } catch (error) { return reportFailure(error) }
}

export async function PUT(request: Request) {
  try {
    const { db, storeId } = await reportingContext(request, true)
    const body = await request.json()
    if (['enabled', 'daily_enabled', 'monthly_enabled'].some(key => typeof body[key] !== 'boolean') || typeof body.phone !== 'string') throw new ReportError('Invalid SMS settings.')
    const phone = normalizeGhanaPhone(body.phone)
    if (body.enabled && (!phone || !smsConfigured())) throw new ReportError('Add a valid Ghana recipient number and configure the BMS API key and approved sender ID before enabling SMS.')
    const { error } = await db.from('sms_report_settings').upsert({ store_id: storeId, enabled: body.enabled, daily_enabled: body.daily_enabled, monthly_enabled: body.monthly_enabled, phone: phone || '', updated_at: new Date().toISOString() })
    if (error) throw new ReportError('Could not save SMS settings. Check reporting setup.', 503)
    // Delivery also rechecks the switches at send time. An already in-flight
    // provider request cannot be recalled by turning off this setting.
    return Response.json({ ok: true })
  } catch (error) { return reportFailure(error) }
}
