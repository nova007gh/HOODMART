import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

export interface OwnerAuthResult {
  ok: boolean
  userId?: string
  email?: string
  response?: NextResponse
}

/**
 * Verifies that the request's Bearer token belongs to a real Supabase user
 * AND that the user is whitelisted in the `platform_admins` table.
 *
 * Every /api/owner/* route must call this first and bail out early if `ok`
 * is false. This is the only gate protecting the software-owner console's
 * data — it deliberately does NOT trust anything from the request body.
 */
export async function requireOwner(req: NextRequest): Promise<OwnerAuthResult> {
  const authHeader = req.headers.get('authorization') || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null

  if (!token) {
    return { ok: false, response: NextResponse.json({ error: 'Missing authorization token' }, { status: 401 }) }
  }

  const admin = getSupabaseAdmin()

  const { data: userData, error: userError } = await admin.auth.getUser(token)
  if (userError || !userData?.user) {
    return { ok: false, response: NextResponse.json({ error: 'Invalid or expired session' }, { status: 401 }) }
  }

  const { data: adminRow, error: adminError } = await admin
    .from('platform_admins')
    .select('user_id, email')
    .eq('user_id', userData.user.id)
    .single()

  if (adminError || !adminRow) {
    return { ok: false, response: NextResponse.json({ error: 'Not authorized as a platform owner' }, { status: 403 }) }
  }

  return { ok: true, userId: userData.user.id, email: adminRow.email }
}
