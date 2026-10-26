export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'expired' | 'canceled'

export interface SubscriptionInfo {
  status: SubscriptionStatus
  plan: string
  trialEndsAt: string | null
  currentPeriodEnd: string | null
  isAllowed: boolean
  daysRemaining: number | null
  /** Keep access available on read failures, but never hide billing uncertainty. */
  loadError?: boolean
}

export interface SubscriptionNotice {
  tone: 'info' | 'warning' | 'danger'
  message: string
  action: string
}

export function getSubscriptionNotice(info: SubscriptionInfo, now = Date.now()): SubscriptionNotice | null {
  if (info.loadError) {
    return { tone: 'warning', message: 'Subscription status could not be verified. Reconnect or contact support to confirm your renewal date.', action: 'View Billing' }
  }
  if (info.plan === 'free' && info.status === 'active') return null

  if (info.status === 'past_due' || info.status === 'expired' || info.status === 'canceled') {
    const status = info.status === 'past_due' ? 'past due' : info.status
    return { tone: 'danger', message: `Your subscription is ${status}. Review your billing and renew to continue using HOODMART.`, action: 'View Billing' }
  }

  const trial = info.status === 'trialing'
  const end = trial ? info.trialEndsAt : info.currentPeriodEnd
  const endTime = end ? new Date(end).getTime() : NaN
  if (!Number.isFinite(endTime)) {
    return { tone: 'warning', message: 'Your subscription renewal date is not set. Contact support to confirm your billing period.', action: 'View Billing' }
  }
  const date = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Accra' }).format(new Date(endTime))
  const label = trial ? 'free trial' : `${info.plan.toUpperCase()} monthly subscription`
  if (endTime <= now) {
    return { tone: 'danger', message: `Your ${label} ended on ${date}. Please renew.`, action: trial ? 'Choose a Plan' : 'Renew Now' }
  }
  const days = Math.ceil((endTime - now) / 86_400_000)
  return {
    tone: days <= 7 ? 'warning' : 'info',
    message: `Your ${label} ends on ${date} (${days} day${days === 1 ? '' : 's'} remaining).${days <= 7 ? ' Renew before it expires.' : ''}`,
    action: days <= 7 ? (trial ? 'Choose a Plan' : 'Renew Now') : 'View Billing',
  }
}
