// Server-only Eganow payment gateway helper.
// Docs: https://docs.sandbox.egacoreapi.com/
//
// Required environment variables (set these in Vercel / .env.local):
//   EGANOW_BASE_URL         e.g. https://developer.sandbox.egacoreapi.com (sandbox)
//                            or the production base URL once you go live.
//   EGANOW_SECRET_USERNAME  Secret username from the Eganow Business Dashboard.
//   EGANOW_SECRET_PASSWORD  Secret password from the Eganow Business Dashboard.
//   EGANOW_X_AUTH           x-Auth value from the Eganow Business Dashboard.

interface EganowTokenResponse {
  message: string
  egaMerchantId: string
  developerJwtToken: string
  isSuccess: boolean
}

interface EganowCollectionResponse {
  transactionStatus: string
  eganowReferenceNo: string
  message: string
}

function getConfig() {
  const baseUrl = process.env.EGANOW_BASE_URL
  const username = process.env.EGANOW_SECRET_USERNAME
  const password = process.env.EGANOW_SECRET_PASSWORD
  const xAuth = process.env.EGANOW_X_AUTH

  if (!baseUrl || !username || !password || !xAuth) {
    throw new Error(
      'Eganow is not configured. Set EGANOW_BASE_URL, EGANOW_SECRET_USERNAME, EGANOW_SECRET_PASSWORD, and EGANOW_X_AUTH.'
    )
  }
  return { baseUrl, username, password, xAuth }
}

/** Generates a short-lived (1hr) JWT using the merchant's Basic Auth credentials. */
export async function getEganowToken(): Promise<string> {
  const { baseUrl, username, password, xAuth } = getConfig()
  const basicAuth = Buffer.from(`${username}:${password}`).toString('base64')

  const res = await fetch(`${baseUrl}/api/auth/token`, {
    method: 'GET',
    headers: {
      Authorization: `Basic ${basicAuth}`,
      'x-Auth': xAuth,
    },
  })

  if (!res.ok) {
    throw new Error(`Eganow auth failed: ${res.status} ${await res.text()}`)
  }

  const data: EganowTokenResponse = await res.json()
  if (!data.isSuccess) throw new Error(data.message || 'Eganow authentication failed')
  return data.developerJwtToken
}

export interface MobileMoneyCollectionParams {
  paypartnerCode: 'MTNGH' | 'TCELGH' | 'ATGH'
  amount: number
  msisdn: string
  accountName?: string
  transactionId: string
  narration?: string
  callbackUrl: string
}

/** Initiates a Mobile Money charge against the customer's wallet. */
export async function collectMobileMoney(params: MobileMoneyCollectionParams): Promise<EganowCollectionResponse> {
  const { baseUrl, xAuth } = getConfig()
  const token = await getEganowToken()

  const res = await fetch(`${baseUrl}/api/transactions/collection`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'x-Auth': xAuth,
    },
    body: JSON.stringify({
      paypartnerCode: params.paypartnerCode,
      amount: params.amount,
      accountNoOrCardNoOrMSISDN: params.msisdn,
      accountName: params.accountName || '',
      transactionId: params.transactionId,
      narration: params.narration || 'HOODMART subscription payment',
      transCurrencyIso: 'GHS',
      expiryDateMonth: 0,
      expiryDateYear: 0,
      cvv: '',
      languageId: 'en',
      callback: params.callbackUrl,
    }),
  })

  if (!res.ok) {
    throw new Error(`Eganow collection failed: ${res.status} ${await res.text()}`)
  }
  return res.json()
}

export interface CardCollectionParams {
  amount: number
  cardNumber: string
  cardholderName: string
  expiryMonth: number
  expiryYear: number
  cvv: string
  transactionId: string
  narration?: string
  callbackUrl: string
}

/** Initiates a Visa/Mastercard charge (may require 3DS redirect handling). */
export async function collectCard(params: CardCollectionParams): Promise<EganowCollectionResponse & { redirectHtml?: string }> {
  const { baseUrl, xAuth } = getConfig()
  const token = await getEganowToken()

  const res = await fetch(`${baseUrl}/api/transactions/card/collect`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'x-Auth': xAuth,
    },
    body: JSON.stringify({
      paypartnerCode: 'CARDGATEWAY',
      amount: params.amount,
      accountNoOrCardNoOrMSISDN: params.cardNumber,
      accountName: params.cardholderName,
      transactionId: params.transactionId,
      narration: params.narration || 'HOODMART subscription payment',
      transCurrencyIso: 'GHS',
      expiryDateMonth: params.expiryMonth,
      expiryDateYear: params.expiryYear,
      cvv: params.cvv,
      languageId: 'en',
      callback: params.callbackUrl,
    }),
  })

  if (!res.ok) {
    throw new Error(`Eganow card collection failed: ${res.status} ${await res.text()}`)
  }
  return res.json()
}

/** Checks the current status of a previously initiated transaction. */
export async function getTransactionStatus(transactionId: string) {
  const { baseUrl, xAuth } = getConfig()
  const token = await getEganowToken()

  const res = await fetch(`${baseUrl}/api/transactions/status`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'x-Auth': xAuth,
    },
    body: JSON.stringify({ transactionId, languageId: 'en' }),
  })

  if (!res.ok) {
    throw new Error(`Eganow status check failed: ${res.status} ${await res.text()}`)
  }
  return res.json()
}
