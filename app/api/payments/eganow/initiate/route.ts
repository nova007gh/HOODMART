import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { collectMobileMoney } from '@/lib/payments/eganow'
import { PLAN_PRICE_GHS, PlanKey } from '@/lib/subscription'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { storeId, plan, paypartnerCode, msisdn } = body as {
      storeId: string
      plan: PlanKey
      paypartnerCode: 'MTNGH' | 'TCELGH' | 'ATGH'
      msisdn: string
    }

    if (!storeId || !plan || !paypartnerCode || !msisdn) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const amount = PLAN_PRICE_GHS[plan]
    if (!amount) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const transactionId = crypto.randomUUID()
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    // Kept in sync with the "Collection Callback URL" registered in the
    // Eganow merchant dashboard (Update Callback URLs screen).
    const callbackUrl = `${appUrl}/api/collections`

    // Record a pending payment before calling Eganow, so the webhook always has a row to update.
    const { error: insertError } = await supabaseAdmin.from('payments').insert({
      store_id: storeId,
      provider: 'eganow',
      transaction_id: transactionId,
      amount,
      currency: 'GHS',
      plan,
      status: 'pending',
    })
    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    const result = await collectMobileMoney({
      paypartnerCode,
      amount,
      msisdn,
      transactionId,
      narration: `EMDPOS ${plan} plan subscription`,
      callbackUrl,
    })

    return NextResponse.json({ ok: true, transactionId, ...result })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Payment initiation failed' }, { status: 500 })
  }
}
