import { NextRequest } from 'next/server'
import { processEganowCollectionCallback } from '@/lib/payments/eganow-webhook'

// This is the exact path registered as the "Collection Callback URL" in the
// Eganow merchant dashboard (Update Callback URLs screen). Do not rename
// without also updating the dashboard setting.
export async function POST(req: NextRequest) {
  const payload = await req.json()
  return processEganowCollectionCallback(payload)
}
