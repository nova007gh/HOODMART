import { parseDateRange, DateRange, formatRangeLabel } from './date-range'
import {
  getSalesSummary,
  compareSalesPeriods,
  getBestSellingProducts,
  getWorstSellingProducts,
  getProductsNoSales,
  getProfitSummary,
  getInventoryHealth,
  getRestockRecommendations,
  getDiscountRecommendations,
  getTopCustomers,
  getGiftCardCandidates,
  getStorePerformance,
  getStaffPerformance,
  getPaymentMethodBreakdown,
  getSuspiciousActivity,
  getBusinessHealthSummary,
  getHourlySales,
  getAverageOrderValue,
} from './analytics'
import { hasPermission, AIPermission } from './permissions'
import { User } from '@/lib/auth'

export interface AIToolContext {
  user: User
  permissions: AIPermission[]
  timezone: string
  currency: string
}

export interface AIToolResult {
  toolName: string
  permission: AIPermission
  data: unknown
  error?: string
}

export interface AIToolDef {
  name: string
  description: string
  requiredPermission: AIPermission
  keywords: string[]
  execute: (ctx: AIToolContext, range: DateRange) => AIToolResult | null
}

const TOOLS: AIToolDef[] = [
  {
    name: 'get_sales_summary',
    description: 'Get sales summary for a date range including gross, net, discounts, and transaction count',
    requiredPermission: 'ai.view_sales',
    keywords: ['sales', 'sold', 'revenue', 'today', 'yesterday', 'month', 'week', 'how much'],
    execute: (ctx, range) => ({
      toolName: 'get_sales_summary',
      permission: 'ai.view_sales',
      data: getSalesSummary(range),
    }),
  },
  {
    name: 'compare_sales_periods',
    description: 'Compare current period sales with previous period',
    requiredPermission: 'ai.view_sales',
    keywords: ['compare', 'vs', 'versus', 'last week', 'last month', 'growth', 'increase', 'decrease'],
    execute: (ctx, range) => {
      const duration = range.end.getTime() - range.start.getTime()
      const prevStart = new Date(range.start.getTime() - duration)
      const prevEnd = new Date(range.start.getTime() - 1)
      return {
        toolName: 'compare_sales_periods',
        permission: 'ai.view_sales',
        data: compareSalesPeriods(range, { start: prevStart, end: prevEnd, label: 'Previous period' }),
      }
    },
  },
  {
    name: 'get_best_selling_products',
    description: 'Get top-selling products ranked by units sold and revenue',
    requiredPermission: 'ai.view_products',
    keywords: ['best selling', 'top selling', 'top products', 'most sold', 'popular', 'selling the most'],
    execute: (ctx, range) => ({
      toolName: 'get_best_selling_products',
      permission: 'ai.view_products',
      data: getBestSellingProducts(range, 10),
    }),
  },
  {
    name: 'get_worst_selling_products',
    description: 'Get worst-selling products ranked by lowest units sold',
    requiredPermission: 'ai.view_products',
    keywords: ['worst selling', 'least selling', 'selling the least', 'slow', 'poor performing'],
    execute: (ctx, range) => ({
      toolName: 'get_worst_selling_products',
      permission: 'ai.view_products',
      data: getWorstSellingProducts(range, 10),
    }),
  },
  {
    name: 'get_products_no_sales',
    description: 'Get products that have not sold in the selected period',
    requiredPermission: 'ai.view_products',
    keywords: ['no sales', 'not sold', 'haven\'t sold', 'no movement', 'unsold'],
    execute: (ctx, range) => ({
      toolName: 'get_products_no_sales',
      permission: 'ai.view_products',
      data: getProductsNoSales(range),
    }),
  },
  {
    name: 'get_profit_summary',
    description: 'Get profit summary including gross profit, margin, and cost data completeness',
    requiredPermission: 'ai.view_profit',
    keywords: ['profit', 'margin', 'cost', 'cogs', 'gross'],
    execute: (ctx, range) => ({
      toolName: 'get_profit_summary',
      permission: 'ai.view_profit',
      data: getProfitSummary(range),
    }),
  },
  {
    name: 'get_inventory_health',
    description: 'Get inventory health including low stock, out of stock, expiring, and expired products',
    requiredPermission: 'ai.view_inventory',
    keywords: ['stock', 'inventory', 'low stock', 'out of stock', 'expiry', 'expiring', 'expired'],
    execute: (ctx) => ({
      toolName: 'get_inventory_health',
      permission: 'ai.view_inventory',
      data: getInventoryHealth(),
    }),
  },
  {
    name: 'get_restock_recommendations',
    description: 'Get restock recommendations using deterministic formulas based on sales velocity and stock levels',
    requiredPermission: 'ai.view_inventory',
    keywords: ['restock', 'reorder', 'replenish', 'run out', 'running out', 'need to order'],
    execute: (ctx) => ({
      toolName: 'get_restock_recommendations',
      permission: 'ai.view_inventory',
      data: getRestockRecommendations(),
    }),
  },
  {
    name: 'get_discount_recommendations',
    description: 'Get discount recommendations for slow-moving and expiring products',
    requiredPermission: 'ai.view_products',
    keywords: ['discount', 'clearance', 'markdown', 'reduce price', 'promotion'],
    execute: (ctx) => ({
      toolName: 'get_discount_recommendations',
      permission: 'ai.view_products',
      data: getDiscountRecommendations(),
    }),
  },
  {
    name: 'get_top_customers',
    description: 'Get top customers ranked by total spend, purchase frequency, and average order value',
    requiredPermission: 'ai.view_customers',
    keywords: ['top customers', 'best customers', 'customer', 'who buys', 'who spends'],
    execute: (ctx, range) => ({
      toolName: 'get_top_customers',
      permission: 'ai.view_customers',
      data: getTopCustomers(range, 10),
    }),
  },
  {
    name: 'get_gift_card_candidates',
    description: 'Get customers who qualify for gift cards based on spending and loyalty',
    requiredPermission: 'ai.view_customers',
    keywords: ['gift card', 'loyalty', 'reward', 'appreciation', 'deserve'],
    execute: (ctx) => ({
      toolName: 'get_gift_card_candidates',
      permission: 'ai.view_customers',
      data: getGiftCardCandidates(),
    }),
  },
  {
    name: 'get_store_performance',
    description: 'Get performance breakdown by store/branch',
    requiredPermission: 'ai.view_sales',
    keywords: ['store', 'branch', 'which store', 'best store', 'performing best'],
    execute: (ctx, range) => ({
      toolName: 'get_store_performance',
      permission: 'ai.view_sales',
      data: getStorePerformance(range),
    }),
  },
  {
    name: 'get_staff_performance',
    description: 'Get staff performance ranked by sales and transactions',
    requiredPermission: 'ai.view_staff',
    keywords: ['cashier', 'staff', 'who sold', 'who processed', 'employee'],
    execute: (ctx, range) => ({
      toolName: 'get_staff_performance',
      permission: 'ai.view_staff',
      data: getStaffPerformance(range),
    }),
  },
  {
    name: 'get_payment_method_breakdown',
    description: 'Get breakdown of sales by payment method',
    requiredPermission: 'ai.view_sales',
    keywords: ['payment method', 'cash', 'card', 'mobile money', 'payment'],
    execute: (ctx, range) => ({
      toolName: 'get_payment_method_breakdown',
      permission: 'ai.view_sales',
      data: getPaymentMethodBreakdown(range),
    }),
  },
  {
    name: 'get_suspicious_activity',
    description: 'Detect unusual business activity that may require review',
    requiredPermission: 'ai.view_sales',
    keywords: ['suspicious', 'unusual', 'anomaly', 'refund', 'fraud', 'review'],
    execute: (ctx, range) => ({
      toolName: 'get_suspicious_activity',
      permission: 'ai.view_sales',
      data: getSuspiciousActivity(range),
    }),
  },
  {
    name: 'get_business_health_summary',
    description: 'Get comprehensive business health summary with key metrics and recommendations',
    requiredPermission: 'ai.view_sales',
    keywords: ['summary', 'health', 'overview', 'focus', 'today\'s business', 'business summary', 'what should i'],
    execute: (ctx, range) => ({
      toolName: 'get_business_health_summary',
      permission: 'ai.view_sales',
      data: getBusinessHealthSummary(range),
    }),
  },
  {
    name: 'get_hourly_sales',
    description: 'Get hourly sales distribution for the selected period',
    requiredPermission: 'ai.view_sales',
    keywords: ['hourly', 'time of day', 'peak hours', 'busy hours', 'when'],
    execute: (ctx, range) => ({
      toolName: 'get_hourly_sales',
      permission: 'ai.view_sales',
      data: getHourlySales(range),
    }),
  },
  {
    name: 'get_average_order_value',
    description: 'Get average order value for the selected period',
    requiredPermission: 'ai.view_sales',
    keywords: ['average order', 'aov', 'average sale', 'per transaction'],
    execute: (ctx, range) => ({
      toolName: 'get_average_order_value',
      permission: 'ai.view_sales',
      data: getAverageOrderValue(range),
    }),
  },
]

export function selectTools(question: string, ctx: AIToolContext): AIToolDef[] {
  const lower = question.toLowerCase()
  const selected: AIToolDef[] = []
  const selectedNames = new Set<string>()

  for (const tool of TOOLS) {
    if (!ctx.permissions.includes(tool.requiredPermission)) continue
    const matched = tool.keywords.some((kw) => lower.includes(kw))
    if (matched && !selectedNames.has(tool.name)) {
      selected.push(tool)
      selectedNames.add(tool.name)
    }
  }

  if (selected.length === 0) {
    const summaryTool = TOOLS.find((t) => t.name === 'get_business_health_summary')
    if (summaryTool && ctx.permissions.includes(summaryTool.requiredPermission)) {
      selected.push(summaryTool)
    }
  }

  return selected
}

export function executeTools(question: string, ctx: AIToolContext): {
  results: AIToolResult[]
  dateRange: DateRange
  rangeLabel: string
} {
  const range = parseDateRange(question)
  const tools = selectTools(question, ctx)
  const results: AIToolResult[] = []

  for (const tool of tools) {
    if (!ctx.permissions.includes(tool.requiredPermission)) {
      results.push({
        toolName: tool.name,
        permission: tool.requiredPermission,
        data: null,
        error: 'Permission denied',
      })
      continue
    }
    try {
      const result = tool.execute(ctx, range)
      if (result) results.push(result)
    } catch (err) {
      results.push({
        toolName: tool.name,
        permission: tool.requiredPermission,
        data: null,
        error: err instanceof Error ? err.message : 'Tool execution failed',
      })
    }
  }

  return {
    results,
    dateRange: range,
    rangeLabel: formatRangeLabel(range),
  }
}

export function getAvailableTools(ctx: AIToolContext): Array<{ name: string; description: string }> {
  return TOOLS
    .filter((t) => ctx.permissions.includes(t.requiredPermission))
    .map((t) => ({ name: t.name, description: t.description }))
}

export { TOOLS }
