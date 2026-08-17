import { NextRequest, NextResponse } from 'next/server'

// This is the exact path registered as the "Payout Callback URL" in the
// Eganow merchant dashboard. HOODMART currently has no payout flow, so this
// just acknowledges the callback to prevent Eganow retry storms.
export async function POST(req: NextRequest) {
  try {
    await req.json()
  } catch {}
  return NextResponse.json({ ok: true })
}
