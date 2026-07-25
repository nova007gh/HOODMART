import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { to, subject, html, text, type } = (await req.json()) as {
      to?: string
      subject: string
      html: string
      text?: string
      type?: 'customer' | 'admin'
    }

    const apiKey = process.env.RESEND_API_KEY
    const from = process.env.FROM_EMAIL || 'onboarding@resend.dev'

    if (!apiKey) {
      console.warn('[EMAIL] RESEND_API_KEY not configured. Email not sent.')
      return NextResponse.json({ ok: false, error: 'Email not configured' })
    }

    let recipient = to
    if (type === 'admin') {
      const adminEmail = process.env.ADMIN_EMAIL
      if (!adminEmail) {
        console.warn('[EMAIL] ADMIN_EMAIL not configured. Admin email not sent.')
        return NextResponse.json({ ok: false, error: 'Admin email not configured' })
      }
      recipient = adminEmail
    }

    if (!recipient) {
      return NextResponse.json({ ok: false, error: 'No recipient' })
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: recipient,
        subject,
        html,
        text,
      }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      console.error('[EMAIL] Resend error:', err)
      return NextResponse.json({ ok: false, error: err.message || 'Failed to send email' })
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('[EMAIL] Unexpected error:', e)
    return NextResponse.json({ ok: false, error: e.message || 'Unexpected error' })
  }
}
