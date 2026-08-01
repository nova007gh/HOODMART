import { NextRequest, NextResponse } from 'next/server'
import { requireOwner } from '@/lib/owner-auth'

export async function GET(req: NextRequest) {
  const auth = await requireOwner(req)
  if (!auth.ok) return auth.response
  return NextResponse.json({ ok: true, email: auth.email })
}
