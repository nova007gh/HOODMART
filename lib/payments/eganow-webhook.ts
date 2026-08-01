import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Shared handler for Eganow's server-to-server collection callback.
// Eganow calls this at whatever "Collection Callback URL" is configured
// in the merchant dashboard (Update Callback URLs screen) — this is an
// ACCOUNT-LEVEL setting, not the per-transaction `callback` field.
export async function processEganowCollectionCallback(payload: any): Promise<NextResponse> {
  try {
    const transactionId: string | undefined =
      payload.transactionId || payload.transaction_id || payload.reference || payload.eganowReferenceNo

    const rawStatus: string = (payload.transactionStatus || payload.status || '').toString().toUpperCase()

    if (!transactionId) {
      return NextResponse.json({ error: 'Missing transaction identifier in callback' }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
    }
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: payment, error: findError } = await supabaseAdmin
      .from('payments')
      .select('id, store_id, plan')
      .eq('transaction_id', transactionId)
      .single()

    if (findError || !payment) {
      return NextResponse.json({ error: 'Unknown transaction' }, { status: 404 })
    }

    const isSuccessful = rawStatus === 'SUCCESSFUL'
    const isFailed = rawStatus === 'FAILED' || rawStatus === 'EXPIRED' || rawStatus === 'CANCELLED'

    await supabaseAdmin
      .from('payments')
      .update({
        status: isSuccessful ? 'successful' : isFailed ? 'failed' : 'pending',
        provider_reference: payload.eganowReferenceNo || null,
        raw_payload: payload,
        updated_at: new Date().toISOString(),
      })
      .eq('id', payment.id)

    if (isSuccessful) {
      const periodEnd = new Date()
      periodEnd.setDate(periodEnd.getDate() + 30)

      await supabaseAdmin
        .from('stores')
        .update({
          subscription_status: 'active',
          plan: payment.plan,
          subscription_provider: 'eganow',
          current_period_end: periodEnd.toISOString(),
        })
        .eq('id', payment.store_id)
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Webhook processing failed' }, { status: 500 })
  }
}
