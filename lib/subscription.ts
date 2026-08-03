import { supabase, isSupabaseConfigured } from '@/lib/supabase/client'
import { getStoreId } from '@/lib/auth'

export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'expired' | 'canceled'

export interface SubscriptionInfo {
  status: SubscriptionStatus
  plan: string
  trialEndsAt: string | null
  currentPeriodEnd: string | null
  isAllowed: boolean
  daysRemaining: number | null
}

export const PLAN_PRICE_GHS = {
  basic: 150,
  pro: 300,
} as const

export type PlanKey = keyof typeof PLAN_PRICE_GHS

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null
  const diffMs = new Date(dateStr).getTime() - Date.now()
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24))
}

/**
 * Resolves the current subscription state for the logged-in store.
 *
 * In localStorage-only mode (Supabase not configured), there is no backend
 * to enforce billing against, so access is always allowed. Real subscription
 * enforcement requires Supabase.
 */
export async function getSubscriptionInfo(): Promise<SubscriptionInfo> {
  if (!isSupabaseConfigured() || !supabase) {
    return {
      status: 'active',
      plan: 'free',
      trialEndsAt: null,
      currentPeriodEnd: null,
      isAllowed: true,
      daysRemaining: null,
    }
  }

  const storeId = getStoreId()
  if (!storeId) {
    return {
      status: 'trialing',
      plan: 'free',
      trialEndsAt: null,
      currentPeriodEnd: null,
      isAllowed: true,
      daysRemaining: null,
    }
  }

  try {
    const { data, error } = await supabase
      .from('stores')
      .select('plan, subscription_status, trial_ends_at, current_period_end')
      .eq('id', storeId)
      .single()

    if (error || !data) {
      // Fail open rather than locking a store out due to a transient read error.
      // Suppress console noise from missing subscription columns or RLS issues.
      if (error) console.debug('[subscription] query skipped:', error.message)
      return {
        status: 'trialing',
        plan: 'free',
        trialEndsAt: null,
        currentPeriodEnd: null,
        isAllowed: true,
        daysRemaining: null,
      }
    }

    const status = (data.subscription_status || 'trialing') as SubscriptionStatus
    const trialEndsAt = data.trial_ends_at as string | null
    const currentPeriodEnd = data.current_period_end as string | null

    let isAllowed = false
    let daysRemaining: number | null = null

    if (status === 'trialing') {
      daysRemaining = daysUntil(trialEndsAt)
      isAllowed = daysRemaining === null ? true : daysRemaining >= 0
    } else if (status === 'active') {
      daysRemaining = daysUntil(currentPeriodEnd)
      isAllowed = daysRemaining === null ? true : daysRemaining >= 0
    } else {
      isAllowed = false
    }

    return {
      status,
      plan: data.plan || 'free',
      trialEndsAt,
      currentPeriodEnd,
      isAllowed,
      daysRemaining,
    }
  } catch {
    return {
      status: 'trialing',
      plan: 'free',
      trialEndsAt: null,
      currentPeriodEnd: null,
      isAllowed: true,
      daysRemaining: null,
    }
  }
}
