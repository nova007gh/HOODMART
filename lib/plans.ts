/** The only paid subscription offered by HOODMART. Free is trial-only. */
export const PLAN_PRICE_GHS = { pro: 300 } as const
export type PlanKey = keyof typeof PLAN_PRICE_GHS

export function isPaidPlan(plan: unknown): plan is PlanKey {
  return plan === 'pro'
}

export function isStorePlan(plan: unknown): plan is PlanKey | 'free' {
  return plan === 'free' || isPaidPlan(plan)
}
