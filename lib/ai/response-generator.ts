import { AIToolResult } from './tools'
import { formatRangeLabel, DateRange } from './date-range'

function money(n: number): string {
  return `GHS ${n.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function pct(n: number): string {
  return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`
}

interface SalesSummaryData {
  grossSales: number
  discountTotal: number
  refundTotal: number
  netSales: number
  transactionCount: number
  averageOrderValue: number
  totalItemsSold: number
  paymentBreakdown: Record<string, { count: number; total: number }>
}

interface ProductRankingData {
  id: string
  name: string
  unitsSold: number
  revenue: number
  transactions: number
}

interface ProfitData {
  grossProfit: number
  totalRevenue: number
  totalCost: number
  margin: number
  hasCostData: boolean
  productsWithoutCost: number
}

interface InventoryData {
  lowStock: Array<{ id: string; name: string; stock: number; minStock: number }>
  outOfStock: Array<{ id: string; name: string; stock: number }>
  expiring: Array<{ id: string; name: string; expiryDate: string; daysUntil: number }>
  expired: Array<{ id: string; name: string; expiryDate: string }>
  inventoryValue: number
  totalSkus: number
}

interface RestockData {
  id: string
  name: string
  currentStock: number
  minStock: number
  averageDailySales: number
  daysOfStockRemaining: number
  recommendedOrderQty: number
  status: string
  confidence: string
}

interface DiscountData {
  id: string
  name: string
  currentStock: number
  unitsSold30Days: number
  daysSinceLastSale: number
  currentPrice: number
  cost: number | null
  currentMargin: number | null
  recommendedDiscountPct: number
  recommendedPrice: number
  reason: string
  confidence: string
}

interface CustomerData {
  id: string
  name: string
  totalSpend: number
  purchases: number
  averageOrderValue: number
  lastPurchase: string | null
  segment: string
}

interface GiftCardData {
  name: string
  reason: string
  verifiedSpend: number
  purchases: number
  recommendedValue: number
  segment: string
  confidence: string
}

interface StorePerfData {
  branchId: string
  branchName: string
  sales: number
  transactions: number
  avgOrder: number
}

interface StaffPerfData {
  userName: string
  sales: number
  transactions: number
  avgOrder: number
}

interface PaymentData {
  method: string
  count: number
  total: number
  percentage: number
}

interface SuspiciousData {
  type: string
  description: string
  severity: string
}

interface HealthData {
  netSales: number
  grossProfit: number
  transactions: number
  averageOrderValue: number
  discounts: number
  topProduct: string | null
  topCustomer: string | null
  bestBranch: string | null
  lowStockCount: number
  outOfStockCount: number
  expiringCount: number
  recommendedActions: string[]
}

interface HourlyData {
  hour: number
  count: number
  total: number
}

interface CompareData {
  current: SalesSummaryData
  previous: SalesSummaryData
  changePct: number
}

function generateSalesSummary(data: SalesSummaryData, rangeLabel: string): string {
  if (data.transactionCount === 0) {
    return `No completed transactions were found for this period.\n\n**Period:** ${rangeLabel}\n**Scope:** All stores`
  }

  const lines: string[] = []
  lines.push(`Here are your sales figures for ${rangeLabel}:`)
  lines.push('')
  lines.push('**Verified data:**')
  lines.push(`- Net sales: ${money(data.netSales)}`)
  lines.push(`- Gross sales: ${money(data.grossSales)}`)
  lines.push(`- Discounts given: ${money(data.discountTotal)}`)
  lines.push(`- Transactions: ${data.transactionCount}`)
  lines.push(`- Items sold: ${data.totalItemsSold}`)
  lines.push(`- Average order value: ${money(data.averageOrderValue)}`)

  if (Object.keys(data.paymentBreakdown).length > 0) {
    lines.push('')
    lines.push('**Payment methods:**')
    for (const [method, info] of Object.entries(data.paymentBreakdown)) {
      lines.push(`- ${method}: ${info.count} transactions, ${money(info.total)}`)
    }
  }

  lines.push('')
  lines.push(`**Period:** ${rangeLabel}`)
  lines.push('**Scope:** All stores')
  lines.push('**Confidence:** High')

  return lines.join('\n')
}

function generateCompareData(data: CompareData, rangeLabel: string): string {
  const lines: string[] = []
  lines.push(`Sales comparison for ${rangeLabel} vs the previous period:`)
  lines.push('')
  lines.push('**Verified data:**')
  lines.push(`- Current period net sales: ${money(data.current.netSales)}`)
  lines.push(`- Previous period net sales: ${money(data.previous.netSales)}`)
  lines.push(`- Change: ${pct(data.changePct)}`)
  lines.push(`- Current transactions: ${data.current.transactionCount}`)
  lines.push(`- Previous transactions: ${data.previous.transactionCount}`)

  if (data.current.transactionCount > 0 && data.previous.transactionCount > 0) {
    const aovChange = ((data.current.averageOrderValue - data.previous.averageOrderValue) / data.previous.averageOrderValue) * 100
    lines.push(`- Current AOV: ${money(data.current.averageOrderValue)}`)
    lines.push(`- Previous AOV: ${money(data.previous.averageOrderValue)}`)
    lines.push(`- AOV change: ${pct(aovChange)}`)
  }

  lines.push('')
  if (data.changePct > 0) {
    lines.push(`**Interpretation:** Sales increased by ${data.changePct.toFixed(1)}% compared to the previous period. This is a positive trend.`)
  } else if (data.changePct < 0) {
    lines.push(`**Interpretation:** Sales decreased by ${Math.abs(data.changePct).toFixed(1)}% compared to the previous period. This may warrant investigation.`)
  } else {
    lines.push(`**Interpretation:** Sales remained flat compared to the previous period.`)
  }

  lines.push('')
  lines.push(`**Period:** ${rangeLabel}`)
  lines.push('**Scope:** All stores')
  lines.push('**Confidence:** High')

  return lines.join('\n')
}

function generateBestSelling(data: ProductRankingData[], rangeLabel: string): string {
  if (data.length === 0) {
    return `No product sales were found for this period.\n\n**Period:** ${rangeLabel}\n**Scope:** All stores`
  }

  const lines: string[] = []
  lines.push(`Here are your top ${data.length} best-selling products for ${rangeLabel}:`)
  lines.push('')
  lines.push('**Verified data:**')
  data.forEach((p, i) => {
    lines.push(`${i + 1}. **${p.name}** — ${p.unitsSold} units sold, ${money(p.revenue)} revenue (${p.transactions} transactions)`)
  })

  const top = data[0]
  lines.push('')
  lines.push(`**Interpretation:** ${top.name} is your best seller with ${top.unitsSold} units sold, generating ${money(top.revenue)} in revenue.`)

  lines.push('')
  lines.push(`**Period:** ${rangeLabel}`)
  lines.push('**Scope:** All stores')
  lines.push('**Confidence:** High')

  return lines.join('\n')
}

function generateWorstSelling(data: ProductRankingData[], rangeLabel: string): string {
  if (data.length === 0) {
    return `No product sales were found for this period.\n\n**Period:** ${rangeLabel}\n**Scope:** All stores`
  }

  const lines: string[] = []
  lines.push(`Here are your lowest-selling products for ${rangeLabel}:`)
  lines.push('')
  lines.push('**Verified data:**')
  data.forEach((p, i) => {
    lines.push(`${i + 1}. **${p.name}** — ${p.unitsSold} units sold, ${money(p.revenue)} revenue`)
  })

  const worst = data[0]
  lines.push('')
  lines.push(`**Interpretation:** ${worst.name} has the lowest sales with only ${worst.unitsSold} units sold. Consider a promotion or review pricing.`)

  lines.push('')
  lines.push(`**Recommendation:** Consider discounting or promoting slow-moving products to clear inventory.`)
  lines.push('')
  lines.push(`**Period:** ${rangeLabel}`)
  lines.push('**Scope:** All stores')
  lines.push('**Confidence:** High')

  return lines.join('\n')
}

function generateNoSales(data: Array<{ id: string; name: string; stock: number }>, rangeLabel: string): string {
  if (data.length === 0) {
    return `All products had at least one sale in this period.\n\n**Period:** ${rangeLabel}\n**Scope:** All stores`
  }

  const lines: string[] = []
  lines.push(`${data.length} product(s) had no sales during ${rangeLabel}:`)
  lines.push('')
  lines.push('**Verified data:**')
  data.slice(0, 10).forEach((p, i) => {
    lines.push(`${i + 1}. **${p.name}** — ${p.stock} units in stock`)
  })
  if (data.length > 10) lines.push(`... and ${data.length - 10} more`)

  lines.push('')
  lines.push(`**Interpretation:** These products are not moving. They may need price adjustments, promotions, or discontinuation.`)
  lines.push('')
  lines.push(`**Recommendation:** Review pricing and consider discounts for products with high stock but no sales.`)
  lines.push('')
  lines.push(`**Period:** ${rangeLabel}`)
  lines.push('**Scope:** All stores')
  lines.push('**Confidence:** High')

  return lines.join('\n')
}

function generateProfit(data: ProfitData, rangeLabel: string): string {
  const lines: string[] = []
  lines.push(`Here is your profit analysis for ${rangeLabel}:`)
  lines.push('')
  lines.push('**Verified data:**')
  lines.push(`- Total revenue: ${money(data.totalRevenue)}`)
  lines.push(`- Total cost: ${money(data.totalCost)}`)
  lines.push(`- Gross profit: ${money(data.grossProfit)}`)
  lines.push(`- Profit margin: ${data.margin.toFixed(1)}%`)

  if (!data.hasCostData) {
    lines.push('')
    lines.push(`**Note:** Profit figures are partial because ${data.productsWithoutCost} product(s) do not have cost data recorded. Please update product costs for accurate profit reporting.`)
  }

  lines.push('')
  if (data.margin > 30) {
    lines.push(`**Interpretation:** Your profit margin of ${data.margin.toFixed(1)}% is healthy.`)
  } else if (data.margin > 15) {
    lines.push(`**Interpretation:** Your profit margin of ${data.margin.toFixed(1)}% is moderate. Look for opportunities to reduce costs or increase prices.`)
  } else if (data.margin > 0) {
    lines.push(`**Interpretation:** Your profit margin of ${data.margin.toFixed(1)}% is low. Consider reviewing pricing and cost structure.`)
  } else {
    lines.push(`**Interpretation:** You are operating at a loss. Urgent review of pricing and costs is needed.`)
  }

  lines.push('')
  lines.push(`**Period:** ${rangeLabel}`)
  lines.push('**Scope:** All stores')
  lines.push(`**Confidence:** ${data.hasCostData ? 'High' : 'Medium'}`)

  return lines.join('\n')
}

function generateInventory(data: InventoryData): string {
  const lines: string[] = []
  lines.push('Here is your current inventory health status:')
  lines.push('')
  lines.push('**Verified data:**')
  lines.push(`- Total SKUs: ${data.totalSkus}`)
  lines.push(`- Inventory value: ${money(data.inventoryValue)}`)
  lines.push(`- Low stock items: ${data.lowStock.length}`)
  lines.push(`- Out of stock items: ${data.outOfStock.length}`)
  lines.push(`- Expiring soon: ${data.expiring.length}`)
  lines.push(`- Already expired: ${data.expired.length}`)

  if (data.outOfStock.length > 0) {
    lines.push('')
    lines.push('**Out of stock:**')
    data.outOfStock.slice(0, 5).forEach((p) => lines.push(`- ${p.name}`))
    if (data.outOfStock.length > 5) lines.push(`... and ${data.outOfStock.length - 5} more`)
  }

  if (data.lowStock.length > 0) {
    lines.push('')
    lines.push('**Low stock:**')
    data.lowStock.slice(0, 5).forEach((p) => lines.push(`- ${p.name} (${p.stock}/${p.minStock} units)`))
    if (data.lowStock.length > 5) lines.push(`... and ${data.lowStock.length - 5} more`)
  }

  if (data.expiring.length > 0) {
    lines.push('')
    lines.push('**Expiring soon:**')
    data.expiring.slice(0, 5).forEach((p) => lines.push(`- ${p.name} (expires in ${p.daysUntil} days)`))
  }

  if (data.expired.length > 0) {
    lines.push('')
    lines.push('**Expired:**')
    data.expired.slice(0, 5).forEach((p) => lines.push(`- ${p.name} (expired ${p.expiryDate})`))
  }

  const issues = data.outOfStock.length + data.lowStock.length + data.expiring.length + data.expired.length
  lines.push('')
  if (issues === 0) {
    lines.push('**Interpretation:** Your inventory is healthy. No critical alerts.')
  } else {
    lines.push(`**Interpretation:** There are ${issues} inventory issues that need attention.`)
    if (data.outOfStock.length > 0) lines.push(`**Recommendation:** Restock ${data.outOfStock.length} out-of-stock products immediately.`)
    if (data.expired.length > 0) lines.push(`**Recommendation:** Remove ${data.expired.length} expired products from inventory.`)
    if (data.expiring.length > 0) lines.push(`**Recommendation:** Consider discounting ${data.expiring.length} products expiring soon.`)
  }

  lines.push('')
  lines.push('**Period:** Current snapshot')
  lines.push('**Scope:** All stores')
  lines.push('**Confidence:** High')

  return lines.join('\n')
}

function generateRestock(data: RestockData[]): string {
  if (data.length === 0) {
    return 'All products have healthy stock levels. No restocking needed at this time.\n\n**Period:** Current snapshot\n**Scope:** All stores\n**Confidence:** High'
  }

  const lines: string[] = []
  const critical = data.filter((d) => d.status === 'Critical')
  const soon = data.filter((d) => d.status === 'Restock soon')
  const overstocked = data.filter((d) => d.status === 'Overstocked')

  lines.push(`Here are your restock recommendations:`)
  lines.push('')
  lines.push('**Verified data:**')

  if (critical.length > 0) {
    lines.push('')
    lines.push(`**Critical (${critical.length}):**`)
    critical.slice(0, 5).forEach((p) => {
      const days = p.daysOfStockRemaining === -1 ? 'Out of stock' : `${p.daysOfStockRemaining} days remaining`
      lines.push(`- **${p.name}** — Stock: ${p.currentStock}, ${days}, Order: ${p.recommendedOrderQty} units`)
    })
  }

  if (soon.length > 0) {
    lines.push('')
    lines.push(`**Restock soon (${soon.length}):**`)
    soon.slice(0, 5).forEach((p) => {
      lines.push(`- **${p.name}** — Stock: ${p.currentStock}, ${p.daysOfStockRemaining} days remaining, Order: ${p.recommendedOrderQty} units`)
    })
  }

  if (overstocked.length > 0) {
    lines.push('')
    lines.push(`**Overstocked (${overstocked.length}):**`)
    overstocked.slice(0, 3).forEach((p) => {
      lines.push(`- **${p.name}** — Stock: ${p.currentStock}, ${p.daysOfStockRemaining} days remaining`)
    })
  }

  lines.push('')
  if (critical.length > 0) {
    lines.push(`**Recommendation:** Order ${critical.length} critical product(s) immediately to avoid stockouts.`)
  } else if (soon.length > 0) {
    lines.push(`**Recommendation:** Plan to restock ${soon.length} product(s) within the next week.`)
  }
  if (overstocked.length > 0) {
    lines.push(`**Recommendation:** ${overstocked.length} product(s) are overstocked. Consider promotions to reduce excess inventory.`)
  }

  lines.push('')
  lines.push('**Period:** Current snapshot (based on 30-day sales velocity)')
  lines.push('**Scope:** All stores')
  lines.push('**Confidence:** Medium')

  return lines.join('\n')
}

function generateDiscount(data: DiscountData[]): string {
  if (data.length === 0) {
    return 'No products currently need discounting. All products are selling well or have manageable stock levels.\n\n**Period:** Current snapshot\n**Scope:** All stores\n**Confidence:** High'
  }

  const lines: string[] = []
  lines.push(`Here are ${data.length} product(s) that would benefit from a discount:`)
  lines.push('')
  lines.push('**Verified data:**')
  data.slice(0, 8).forEach((p) => {
    lines.push(`- **${p.name}** — Current price: ${money(p.currentPrice)}, Recommended discount: ${p.recommendedDiscountPct}% (new price: ${money(p.recommendedPrice)})`)
    lines.push(`  Reason: ${p.reason}`)
  })

  lines.push('')
  lines.push('**Recommendation:** Apply the suggested discounts to clear slow-moving and expiring inventory. None of the recommended prices are below cost.')
  lines.push('')
  lines.push('**Period:** Current snapshot (based on 30-day sales data)')
  lines.push('**Scope:** All stores')
  lines.push('**Confidence:** Medium')

  return lines.join('\n')
}

function generateTopCustomers(data: CustomerData[], rangeLabel: string): string {
  if (data.length === 0) {
    return `No customer sales were found for this period.\n\n**Period:** ${rangeLabel}\n**Scope:** All stores`
  }

  const lines: string[] = []
  lines.push(`Here are your top ${data.length} customers for ${rangeLabel}:`)
  lines.push('')
  lines.push('**Verified data:**')
  data.forEach((c, i) => {
    lines.push(`${i + 1}. **${c.name}** — Total spend: ${money(c.totalSpend)}, Purchases: ${c.purchases}, AOV: ${money(c.averageOrderValue)}, Segment: ${c.segment}`)
  })

  const top = data[0]
  lines.push('')
  lines.push(`**Interpretation:** ${top.name} is your top customer with ${money(top.totalSpend)} in total spend across ${top.purchases} purchases.`)

  lines.push('')
  lines.push(`**Period:** ${rangeLabel}`)
  lines.push('**Scope:** All stores')
  lines.push('**Confidence:** High')

  return lines.join('\n')
}

function generateGiftCard(data: GiftCardData[]): string {
  if (data.length === 0) {
    return 'No customers currently qualify for gift cards. Customers need at least GHS 1,000 in spend and 10+ purchases in the last 90 days.\n\n**Period:** Past 90 days\n**Scope:** All stores\n**Confidence:** High'
  }

  const lines: string[] = []
  lines.push(`Here are ${data.length} customer(s) who qualify for a gift card based on their spending and loyalty:`)
  lines.push('')
  lines.push('**Verified data:**')
  data.forEach((c, i) => {
    lines.push(`${i + 1}. **${c.name}** — Verified spend: ${money(c.verifiedSpend)}, Purchases: ${c.purchases}, Recommended gift card value: ${money(c.recommendedValue)}`)
    lines.push(`   Reason: ${c.reason}`)
  })

  lines.push('')
  lines.push('**Recommendation:** These are suggestions only. Gift cards should be issued manually after review. No gift cards have been created automatically.')
  lines.push('')
  lines.push('**Period:** Past 90 days')
  lines.push('**Scope:** All stores')
  lines.push('**Confidence:** Medium')

  return lines.join('\n')
}

function generateStorePerf(data: StorePerfData[], rangeLabel: string): string {
  if (data.length === 0) {
    return `No store performance data was found for this period.\n\n**Period:** ${rangeLabel}\n**Scope:** All stores`
  }

  const lines: string[] = []
  lines.push(`Here is your store performance for ${rangeLabel}:`)
  lines.push('')
  lines.push('**Verified data:**')
  data.forEach((s, i) => {
    lines.push(`${i + 1}. **${s.branchName}** — Sales: ${money(s.sales)}, Transactions: ${s.transactions}, AOV: ${money(s.avgOrder)}`)
  })

  const top = data[0]
  lines.push('')
  lines.push(`**Interpretation:** ${top.branchName} is your best-performing store with ${money(top.sales)} in sales.`)

  lines.push('')
  lines.push(`**Period:** ${rangeLabel}`)
  lines.push('**Scope:** All stores')
  lines.push('**Confidence:** High')

  return lines.join('\n')
}

function generateStaffPerf(data: StaffPerfData[], rangeLabel: string): string {
  if (data.length === 0) {
    return `No staff performance data was found for this period.\n\n**Period:** ${rangeLabel}\n**Scope:** All stores`
  }

  const lines: string[] = []
  lines.push(`Here is your staff performance for ${rangeLabel}:`)
  lines.push('')
  lines.push('**Verified data:**')
  data.forEach((s, i) => {
    lines.push(`${i + 1}. **${s.userName}** — Sales: ${money(s.sales)}, Transactions: ${s.transactions}, AOV: ${money(s.avgOrder)}`)
  })

  const top = data[0]
  lines.push('')
  lines.push(`**Interpretation:** ${top.userName} is your top-performing staff member with ${money(top.sales)} in sales.`)

  lines.push('')
  lines.push(`**Period:** ${rangeLabel}`)
  lines.push('**Scope:** All stores')
  lines.push('**Confidence:** High')

  return lines.join('\n')
}

function generatePaymentMethods(data: PaymentData[], rangeLabel: string): string {
  if (data.length === 0) {
    return `No payment method data was found for this period.\n\n**Period:** ${rangeLabel}\n**Scope:** All stores`
  }

  const lines: string[] = []
  lines.push(`Here is your payment method breakdown for ${rangeLabel}:`)
  lines.push('')
  lines.push('**Verified data:**')
  data.forEach((p) => {
    lines.push(`- **${p.method}** — ${p.count} transactions (${p.percentage.toFixed(1)}%), ${money(p.total)}`)
  })

  const top = data[0]
  lines.push('')
  lines.push(`**Interpretation:** ${top.method} is your most used payment method with ${top.percentage.toFixed(1)}% of transactions.`)

  lines.push('')
  lines.push(`**Period:** ${rangeLabel}`)
  lines.push('**Scope:** All stores')
  lines.push('**Confidence:** High')

  return lines.join('\n')
}

function generateSuspicious(data: SuspiciousData[], rangeLabel: string): string {
  if (data.length === 0) {
    return `No unusual activity was detected for ${rangeLabel}. All transactions appear normal.\n\n**Period:** ${rangeLabel}\n**Scope:** All stores\n**Confidence:** High`
  }

  const lines: string[] = []
  const high = data.filter((d) => d.severity === 'high')
  const medium = data.filter((d) => d.severity === 'medium')
  const low = data.filter((d) => d.severity === 'low')

  lines.push(`I detected ${data.length} item(s) that may require review for ${rangeLabel}:`)
  lines.push('')
  lines.push('**Verified data:**')

  if (high.length > 0) {
    lines.push('')
    lines.push(`**High priority (${high.length}):**`)
    high.slice(0, 5).forEach((a) => lines.push(`- ${a.type}: ${a.description}`))
  }

  if (medium.length > 0) {
    lines.push('')
    lines.push(`**Medium priority (${medium.length}):**`)
    medium.slice(0, 5).forEach((a) => lines.push(`- ${a.type}: ${a.description}`))
  }

  if (low.length > 0) {
    lines.push('')
    lines.push(`**Low priority (${low.length}):**`)
    low.slice(0, 5).forEach((a) => lines.push(`- ${a.type}: ${a.description}`))
  }

  lines.push('')
  lines.push('**Interpretation:** These activities differ from the normal pattern and may require review. This does not indicate any wrongdoing.')
  lines.push('')
  lines.push(`**Period:** ${rangeLabel}`)
  lines.push('**Scope:** All stores')
  lines.push('**Confidence:** Medium')

  return lines.join('\n')
}

function generateHealthSummary(data: HealthData, rangeLabel: string): string {
  const lines: string[] = []
  lines.push(`Here is your business health summary for ${rangeLabel}:`)
  lines.push('')
  lines.push('**Verified data:**')
  lines.push(`- Net sales: ${money(data.netSales)}`)
  lines.push(`- Gross profit: ${money(data.grossProfit)}`)
  lines.push(`- Transactions: ${data.transactions}`)
  lines.push(`- Average order value: ${money(data.averageOrderValue)}`)
  lines.push(`- Discounts given: ${money(data.discounts)}`)

  if (data.topProduct) lines.push(`- Top product: ${data.topProduct}`)
  if (data.topCustomer) lines.push(`- Top customer: ${data.topCustomer}`)
  if (data.bestBranch) lines.push(`- Best branch: ${data.bestBranch}`)

  lines.push(`- Low stock items: ${data.lowStockCount}`)
  lines.push(`- Out of stock items: ${data.outOfStockCount}`)
  lines.push(`- Expiring soon: ${data.expiringCount}`)

  if (data.recommendedActions.length > 0) {
    lines.push('')
    lines.push('**Recommended actions:**')
    data.recommendedActions.forEach((a) => lines.push(`- ${a}`))
  }

  lines.push('')
  if (data.transactions === 0) {
    lines.push('**Interpretation:** No sales were recorded in this period. If this is unexpected, check your POS system and staff activity.')
  } else {
    lines.push(`**Interpretation:** Your business processed ${data.transactions} transactions with ${money(data.netSales)} in net sales.`)
  }

  lines.push('')
  lines.push(`**Period:** ${rangeLabel}`)
  lines.push('**Scope:** All stores')
  lines.push('**Confidence:** High')

  return lines.join('\n')
}

function generateHourly(data: HourlyData[], rangeLabel: string): string {
  const active = data.filter((h) => h.count > 0)
  if (active.length === 0) {
    return `No sales were found for ${rangeLabel} to analyze hourly patterns.\n\n**Period:** ${rangeLabel}\n**Scope:** All stores`
  }

  const peak = active.reduce((max, h) => (h.total > max.total ? h : max), active[0])
  const lines: string[] = []

  lines.push(`Here is your hourly sales distribution for ${rangeLabel}:`)
  lines.push('')
  lines.push('**Verified data:**')
  active.forEach((h) => {
    const hourLabel = h.hour === 0 ? '12 AM' : h.hour < 12 ? `${h.hour} AM` : h.hour === 12 ? '12 PM' : `${h.hour - 12} PM`
    lines.push(`- ${hourLabel}: ${h.count} transactions, ${money(h.total)}`)
  })

  const peakLabel = peak.hour === 0 ? '12 AM' : peak.hour < 12 ? `${peak.hour} AM` : peak.hour === 12 ? '12 PM' : `${peak.hour - 12} PM`
  lines.push('')
  lines.push(`**Interpretation:** Your busiest hour is ${peakLabel} with ${peak.count} transactions generating ${money(peak.total)}.`)
  lines.push('')
  lines.push(`**Recommendation:** Schedule more staff during peak hours to handle customer flow efficiently.`)
  lines.push('')
  lines.push(`**Period:** ${rangeLabel}`)
  lines.push('**Scope:** All stores')
  lines.push('**Confidence:** High')

  return lines.join('\n')
}

function generateAOV(value: number, rangeLabel: string): string {
  const lines: string[] = []
  lines.push(`Your average order value for ${rangeLabel} is ${money(value)}.`)
  lines.push('')
  lines.push(`**Period:** ${rangeLabel}`)
  lines.push('**Scope:** All stores')
  lines.push('**Confidence:** High')
  return lines.join('\n')
}

export function generateResponse(
  results: AIToolResult[],
  rangeLabel: string,
  question: string
): string {
  if (results.length === 0) {
    return `I couldn't find relevant data for your question. Try asking about sales, products, inventory, customers, profit, or business summary.\n\n**Period:** ${rangeLabel}\n**Scope:** All stores`
  }

  const parts: string[] = []

  for (const result of results) {
    if (result.error) {
      parts.push(`**${result.toolName.replace(/_/g, ' ')}**: Error — ${result.error}`)
      continue
    }

    switch (result.toolName) {
      case 'get_sales_summary':
        parts.push(generateSalesSummary(result.data as SalesSummaryData, rangeLabel))
        break
      case 'compare_sales_periods':
        parts.push(generateCompareData(result.data as CompareData, rangeLabel))
        break
      case 'get_best_selling_products':
        parts.push(generateBestSelling(result.data as ProductRankingData[], rangeLabel))
        break
      case 'get_worst_selling_products':
        parts.push(generateWorstSelling(result.data as ProductRankingData[], rangeLabel))
        break
      case 'get_products_no_sales':
        parts.push(generateNoSales(result.data as Array<{ id: string; name: string; stock: number }>, rangeLabel))
        break
      case 'get_profit_summary':
        parts.push(generateProfit(result.data as ProfitData, rangeLabel))
        break
      case 'get_inventory_health':
        parts.push(generateInventory(result.data as InventoryData))
        break
      case 'get_restock_recommendations':
        parts.push(generateRestock(result.data as RestockData[]))
        break
      case 'get_discount_recommendations':
        parts.push(generateDiscount(result.data as DiscountData[]))
        break
      case 'get_top_customers':
        parts.push(generateTopCustomers(result.data as CustomerData[], rangeLabel))
        break
      case 'get_gift_card_candidates':
        parts.push(generateGiftCard(result.data as GiftCardData[]))
        break
      case 'get_store_performance':
        parts.push(generateStorePerf(result.data as StorePerfData[], rangeLabel))
        break
      case 'get_staff_performance':
        parts.push(generateStaffPerf(result.data as StaffPerfData[], rangeLabel))
        break
      case 'get_payment_method_breakdown':
        parts.push(generatePaymentMethods(result.data as PaymentData[], rangeLabel))
        break
      case 'get_suspicious_activity':
        parts.push(generateSuspicious(result.data as SuspiciousData[], rangeLabel))
        break
      case 'get_business_health_summary':
        parts.push(generateHealthSummary(result.data as HealthData, rangeLabel))
        break
      case 'get_hourly_sales':
        parts.push(generateHourly(result.data as HourlyData[], rangeLabel))
        break
      case 'get_average_order_value':
        parts.push(generateAOV(result.data as number, rangeLabel))
        break
      default:
        parts.push(`Data retrieved from ${result.toolName}.`)
    }
  }

  return parts.join('\n\n---\n\n')
}
