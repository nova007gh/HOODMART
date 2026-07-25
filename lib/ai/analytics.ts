import { store, Sale, Product, Customer, Branch } from '@/lib/store'
import { DateRange, isInDateRange } from './date-range'

export interface SalesSummary {
  grossSales: number
  discountTotal: number
  refundTotal: number
  netSales: number
  transactionCount: number
  averageOrderValue: number
  totalItemsSold: number
  paymentBreakdown: Record<string, { count: number; total: number }>
}

export interface ProductRanking {
  id: string
  name: string
  unitsSold: number
  revenue: number
  transactions: number
}

export interface ProfitSummary {
  grossProfit: number
  totalRevenue: number
  totalCost: number
  margin: number
  hasCostData: boolean
  productsWithoutCost: number
}

export interface InventoryHealth {
  lowStock: Array<{ id: string; name: string; stock: number; minStock: number }>
  outOfStock: Array<{ id: string; name: string; stock: number }>
  expiring: Array<{ id: string; name: string; expiryDate: string; daysUntil: number }>
  expired: Array<{ id: string; name: string; expiryDate: string }>
  inventoryValue: number
  totalSkus: number
}

export interface RestockRecommendation {
  id: string
  name: string
  currentStock: number
  minStock: number
  averageDailySales: number
  daysOfStockRemaining: number
  recommendedOrderQty: number
  status: 'Critical' | 'Restock soon' | 'Healthy' | 'Overstocked'
  confidence: 'High' | 'Medium' | 'Low'
}

export interface DiscountRecommendation {
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
  confidence: 'High' | 'Medium' | 'Low'
}

export interface CustomerRanking {
  id: string
  name: string
  totalSpend: number
  purchases: number
  averageOrderValue: number
  lastPurchase: string | null
  segment: string
}

export interface BusinessHealthSummary {
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

export interface StorePerformance {
  branchId: string
  branchName: string
  sales: number
  transactions: number
  avgOrder: number
}

export interface StaffPerformance {
  userName: string
  sales: number
  transactions: number
  avgOrder: number
}

export interface SuspiciousActivity {
  type: string
  description: string
  severity: 'low' | 'medium' | 'high'
}

function filterSalesByRange(sales: Sale[], range: DateRange): Sale[] {
  return sales.filter((s) => isInDateRange(s.timestamp, range))
}

function daysBetween(a: Date, b: Date): number {
  return Math.ceil((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24))
}

export function getSalesSummary(range: DateRange): SalesSummary {
  const sales = filterSalesByRange(store.getSales(), range)
  const grossSales = sales.reduce((s, x) => s + x.subtotal, 0)
  const discountTotal = sales.reduce((s, x) => s + x.discount, 0)
  const netSales = sales.reduce((s, x) => s + x.total, 0)
  const totalItemsSold = sales.reduce((s, x) => s + x.items.reduce((is, i) => is + i.qty, 0), 0)
  const paymentBreakdown: Record<string, { count: number; total: number }> = {}
  sales.forEach((s) => {
    const method = s.paymentMethod || 'unknown'
    if (!paymentBreakdown[method]) paymentBreakdown[method] = { count: 0, total: 0 }
    paymentBreakdown[method].count++
    paymentBreakdown[method].total += s.total
  })

  return {
    grossSales,
    discountTotal,
    refundTotal: 0,
    netSales,
    transactionCount: sales.length,
    averageOrderValue: sales.length ? netSales / sales.length : 0,
    totalItemsSold,
    paymentBreakdown,
  }
}

export function compareSalesPeriods(current: DateRange, previous: DateRange): {
  current: SalesSummary
  previous: SalesSummary
  changePct: number
} {
  const cur = getSalesSummary(current)
  const prev = getSalesSummary(previous)
  const changePct = prev.netSales > 0 ? ((cur.netSales - prev.netSales) / prev.netSales) * 100 : 0
  return { current: cur, previous: prev, changePct }
}

export function getBestSellingProducts(range: DateRange, limit = 10): ProductRanking[] {
  const sales = filterSalesByRange(store.getSales(), range)
  const map = new Map<string, ProductRanking>()
  sales.forEach((s) => s.items.forEach((i) => {
    const cur = map.get(i.id) || { id: i.id, name: i.name, unitsSold: 0, revenue: 0, transactions: 0 }
    cur.unitsSold += i.qty
    cur.revenue += i.price * i.qty
    cur.transactions++
    map.set(i.id, cur)
  }))
  return Array.from(map.values()).sort((a, b) => b.unitsSold - a.unitsSold).slice(0, limit)
}

export function getWorstSellingProducts(range: DateRange, limit = 10): ProductRanking[] {
  const sales = filterSalesByRange(store.getSales(), range)
  const map = new Map<string, ProductRanking>()
  sales.forEach((s) => s.items.forEach((i) => {
    const cur = map.get(i.id) || { id: i.id, name: i.name, unitsSold: 0, revenue: 0, transactions: 0 }
    cur.unitsSold += i.qty
    cur.revenue += i.price * i.qty
    cur.transactions++
    map.set(i.id, cur)
  }))
  return Array.from(map.values()).sort((a, b) => a.unitsSold - b.unitsSold).slice(0, limit)
}

export function getProductsNoSales(range: DateRange): Array<{ id: string; name: string; stock: number }> {
  const products = store.getProducts()
  const sales = filterSalesByRange(store.getSales(), range)
  const soldIds = new Set<string>()
  sales.forEach((s) => s.items.forEach((i) => soldIds.add(i.id)))
  return products
    .filter((p) => !soldIds.has(p.id))
    .map((p) => ({ id: p.id, name: p.name, stock: p.stock ?? 0 }))
}

export function getProfitSummary(range: DateRange): ProfitSummary {
  const sales = filterSalesByRange(store.getSales(), range)
  let totalRevenue = 0
  let totalCost = 0
  let productsWithoutCost = 0
  sales.forEach((s) => s.items.forEach((i) => {
    totalRevenue += i.price * i.qty
    if (i.cost != null) {
      totalCost += i.cost * i.qty
    } else {
      productsWithoutCost++
    }
  }))
  const grossProfit = totalRevenue - totalCost
  const margin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0
  return {
    grossProfit,
    totalRevenue,
    totalCost,
    margin,
    hasCostData: productsWithoutCost === 0,
    productsWithoutCost,
  }
}

export function getInventoryHealth(): InventoryHealth {
  const products = store.getProducts()
  const now = new Date()
  const lowStock = products
    .filter((p) => (p.stock ?? 0) > 0 && (p.stock ?? 0) < (p.minStock ?? 0))
    .map((p) => ({ id: p.id, name: p.name, stock: p.stock ?? 0, minStock: p.minStock ?? 0 }))
  const outOfStock = products
    .filter((p) => (p.stock ?? 0) <= 0)
    .map((p) => ({ id: p.id, name: p.name, stock: p.stock ?? 0 }))
  const expiring: Array<{ id: string; name: string; expiryDate: string; daysUntil: number }> = []
  const expired: Array<{ id: string; name: string; expiryDate: string }> = []
  products.forEach((p) => {
    if (!p.expiryDate) return
    const days = daysBetween(now, new Date(p.expiryDate))
    if (days < 0) {
      expired.push({ id: p.id, name: p.name, expiryDate: p.expiryDate })
    } else if (days <= 7) {
      expiring.push({ id: p.id, name: p.name, expiryDate: p.expiryDate, daysUntil: days })
    }
  })
  const inventoryValue = products.reduce((s, p) => s + (p.stock ?? 0) * (p.cost ?? p.price), 0)
  return {
    lowStock,
    outOfStock,
    expiring: expiring.sort((a, b) => a.daysUntil - b.daysUntil),
    expired,
    inventoryValue,
    totalSkus: products.length,
  }
}

export function getRestockRecommendations(): RestockRecommendation[] {
  const products = store.getProducts()
  const sales = store.getSales()
  const now = new Date()
  const thirtyDaysAgo = new Date(now)
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  return products
    .map((p) => {
      const productSales = sales.filter((s) => new Date(s.timestamp) >= thirtyDaysAgo)
      const unitsSold = productSales.reduce((sum, s) => {
        const item = s.items.find((i) => i.id === p.id)
        return sum + (item ? item.qty : 0)
      }, 0)
      const averageDailySales = unitsSold / 30
      const currentStock = p.stock ?? 0
      const minStock = p.minStock ?? 0
      const daysOfStockRemaining = averageDailySales > 0 ? currentStock / averageDailySales : Infinity
      const targetStock = Math.max(minStock * 3, averageDailySales * 14)
      const recommendedOrderQty = Math.max(0, Math.ceil(targetStock - currentStock))

      let status: RestockRecommendation['status'] = 'Healthy'
      let confidence: RestockRecommendation['confidence'] = 'High'

      if (currentStock <= 0) {
        status = 'Critical'
      } else if (daysOfStockRemaining <= 3) {
        status = 'Critical'
      } else if (daysOfStockRemaining <= 7 || currentStock < minStock) {
        status = 'Restock soon'
      } else if (averageDailySales > 0 && daysOfStockRemaining > 60) {
        status = 'Overstocked'
      }

      if (unitsSold < 5) confidence = 'Low'
      else if (unitsSold < 15) confidence = 'Medium'

      return {
        id: p.id,
        name: p.name,
        currentStock,
        minStock,
        averageDailySales: Math.round(averageDailySales * 10) / 10,
        daysOfStockRemaining: daysOfStockRemaining === Infinity ? -1 : Math.round(daysOfStockRemaining * 10) / 10,
        recommendedOrderQty,
        status,
        confidence,
      }
    })
    .filter((r) => r.status !== 'Healthy')
    .sort((a, b) => {
      const order: Record<string, number> = { Critical: 0, 'Restock soon': 1, Overstocked: 2, Healthy: 3 }
      return order[a.status] - order[b.status]
    })
}

export function getDiscountRecommendations(): DiscountRecommendation[] {
  const products = store.getProducts()
  const sales = store.getSales()
  const now = new Date()
  const thirtyDaysAgo = new Date(now)
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const recommendations: DiscountRecommendation[] = []

  for (const p of products) {
      const recentSales = sales.filter((s) => new Date(s.timestamp) >= thirtyDaysAgo)
      const unitsSold = recentSales.reduce((sum, s) => {
        const item = s.items.find((i) => i.id === p.id)
        return sum + (item ? item.qty : 0)
      }, 0)

      const productSales = sales.filter((s) => s.items.some((i) => i.id === p.id))
      const lastSaleDate = productSales.length > 0
        ? productSales.reduce((latest, s) => new Date(s.timestamp) > new Date(latest) ? s.timestamp : latest, productSales[0].timestamp)
        : null
      const daysSinceLastSale = lastSaleDate ? daysBetween(new Date(lastSaleDate), now) : -1

      const currentPrice = p.price
      const cost = p.cost ?? null
      const currentMargin = cost != null ? ((currentPrice - cost) / currentPrice) * 100 : null

      let recommendedDiscountPct = 0
      let reason = ''
      let confidence: DiscountRecommendation['confidence'] = 'Medium'

      const stock = p.stock ?? 0
      const expiryDays = p.expiryDate ? daysBetween(now, new Date(p.expiryDate)) : null

      if (expiryDays != null && expiryDays <= 14 && expiryDays > 0) {
        recommendedDiscountPct = 20
        reason = `Expiring in ${expiryDays} days with ${stock} units in stock`
        confidence = 'High'
      } else if (daysSinceLastSale > 14 && stock > 20) {
        recommendedDiscountPct = 15
        reason = `No sales in ${daysSinceLastSale} days with ${stock} units in stock`
        confidence = 'High'
      } else if (unitsSold < 5 && stock > 30) {
        recommendedDiscountPct = 10
        reason = `Only ${unitsSold} units sold in 30 days with ${stock} units in stock`
        confidence = 'Medium'
      } else if (daysSinceLastSale > 7 && stock > 10) {
        recommendedDiscountPct = 10
        reason = `Slow-moving inventory: ${unitsSold} units sold in 30 days`
        confidence = 'Medium'
      }

      if (recommendedDiscountPct === 0) continue

      const recommendedPrice = currentPrice * (1 - recommendedDiscountPct / 100)

      if (cost != null && recommendedPrice < cost) {
        recommendedDiscountPct = Math.floor(((currentPrice - cost) / currentPrice) * 100 * 0.5)
      }

      recommendations.push({
        id: p.id,
        name: p.name,
        currentStock: stock,
        unitsSold30Days: unitsSold,
        daysSinceLastSale,
        currentPrice,
        cost,
        currentMargin,
        recommendedDiscountPct,
        recommendedPrice: Math.round(recommendedPrice * 100) / 100,
        reason,
        confidence,
      })
    }

  return recommendations.sort((a, b) => b.recommendedDiscountPct - a.recommendedDiscountPct)
}

export function getTopCustomers(range: DateRange, limit = 10): CustomerRanking[] {
  const customers = store.getCustomers()
  const sales = filterSalesByRange(store.getSales(), range)

  const customerSales = new Map<string, { totalSpend: number; purchases: number; lastPurchase: string | null }>()
  sales.forEach((s) => {
    if (!s.customer) return
    const cur = customerSales.get(s.customer) || { totalSpend: 0, purchases: 0, lastPurchase: null }
    cur.totalSpend += s.total
    cur.purchases++
    if (!cur.lastPurchase || new Date(s.timestamp) > new Date(cur.lastPurchase)) {
      cur.lastPurchase = s.timestamp
    }
    customerSales.set(s.customer, cur)
  })

  const rankings: CustomerRanking[] = []
  customerSales.forEach((data, name) => {
    const aov = data.purchases > 0 ? data.totalSpend / data.purchases : 0
    let segment = 'New customer'
    if (data.totalSpend > 5000) segment = 'VIP'
    else if (data.totalSpend > 2000) segment = 'High value'
    else if (data.purchases > 20) segment = 'Frequent buyer'
    else if (data.purchases > 5) segment = 'Growing customer'
    else if (data.purchases > 0) segment = 'New customer'

    const daysSince = data.lastPurchase ? daysBetween(new Date(data.lastPurchase), new Date()) : -1
    if (daysSince > 60) segment = 'Inactive'
    else if (daysSince > 30) segment = 'At risk'

    rankings.push({
      id: name,
      name,
      totalSpend: data.totalSpend,
      purchases: data.purchases,
      averageOrderValue: aov,
      lastPurchase: data.lastPurchase,
      segment,
    })
  })

  return rankings.sort((a, b) => b.totalSpend - a.totalSpend).slice(0, limit)
}

export function getGiftCardCandidates(): Array<{
  name: string
  reason: string
  verifiedSpend: number
  purchases: number
  recommendedValue: number
  segment: string
  confidence: 'High' | 'Medium' | 'Low'
}> {
  const now = new Date()
  const ninetyDaysAgo = new Date(now)
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
  const range: DateRange = { start: ninetyDaysAgo, end: now, label: 'Past 90 days' }
  const top = getTopCustomers(range, 20)

  const candidates: Array<{
    name: string
    reason: string
    verifiedSpend: number
    purchases: number
    recommendedValue: number
    segment: string
    confidence: 'High' | 'Medium' | 'Low'
  }> = []

  for (const c of top) {
    if (c.totalSpend <= 1000 || c.purchases < 10) continue
    const recommendedValue = Math.round(c.totalSpend * 0.01 / 10) * 10
    const conf: 'High' | 'Medium' | 'Low' = c.purchases >= 20 ? 'High' : 'Medium'
    candidates.push({
      name: c.name,
      reason: `High spending (${c.segment}) with ${c.purchases} purchases in 90 days`,
      verifiedSpend: c.totalSpend,
      purchases: c.purchases,
      recommendedValue: Math.max(50, recommendedValue),
      segment: c.segment,
      confidence: conf,
    })
  }

  return candidates.slice(0, 10)
}

export function getStorePerformance(range: DateRange): StorePerformance[] {
  const sales = filterSalesByRange(store.getSales(), range)
  const branches = store.getBranches()
  const branchMap = new Map<string, StorePerformance>()

  branches.forEach((b) => {
    branchMap.set(b.id, { branchId: b.id, branchName: b.name, sales: 0, transactions: 0, avgOrder: 0 })
  })

  sales.forEach((s) => {
    if (!s.branchId) return
    const cur = branchMap.get(s.branchId)
    if (cur) {
      cur.sales += s.total
      cur.transactions++
    }
  })

  const results = Array.from(branchMap.values())
  results.forEach((r) => {
    r.avgOrder = r.transactions > 0 ? r.sales / r.transactions : 0
  })
  return results.sort((a, b) => b.sales - a.sales)
}

export function getStaffPerformance(range: DateRange): StaffPerformance[] {
  const sales = filterSalesByRange(store.getSales(), range)
  const staffMap = new Map<string, StaffPerformance>()

  sales.forEach((s) => {
    const name = s.userName || s.userEmail || 'Unknown'
    const cur = staffMap.get(name) || { userName: name, sales: 0, transactions: 0, avgOrder: 0 }
    cur.sales += s.total
    cur.transactions++
    staffMap.set(name, cur)
  })

  const results = Array.from(staffMap.values())
  results.forEach((r) => {
    r.avgOrder = r.transactions > 0 ? r.sales / r.transactions : 0
  })
  return results.sort((a, b) => b.sales - a.sales)
}

export function getPaymentMethodBreakdown(range: DateRange): Array<{
  method: string
  count: number
  total: number
  percentage: number
}> {
  const summary = getSalesSummary(range)
  const total = summary.transactionCount || 1
  return Object.entries(summary.paymentBreakdown)
    .map(([method, data]) => ({
      method,
      count: data.count,
      total: data.total,
      percentage: (data.count / total) * 100,
    }))
    .sort((a, b) => b.total - a.total)
}

export function getSuspiciousActivity(range: DateRange): SuspiciousActivity[] {
  const sales = filterSalesByRange(store.getSales(), range)
  const activities: SuspiciousActivity[] = []

  sales.forEach((s) => {
    if (s.discount > 0 && s.discount / s.subtotal > 0.5) {
      activities.push({
        type: 'Large discount',
        description: `Sale ${s.id} had a discount of ${((s.discount / s.subtotal) * 100).toFixed(1)}% which is unusually high`,
        severity: 'high',
      })
    }
  })

  const now = new Date()
  sales.forEach((s) => {
    const hour = new Date(s.timestamp).getHours()
    if (hour < 6 || hour >= 22) {
      activities.push({
        type: 'After-hours sale',
        description: `Sale ${s.id} was processed at ${new Date(s.timestamp).toLocaleTimeString()} which is outside normal business hours`,
        severity: 'low',
      })
    }
  })

  const refundCounts = new Map<string, number>()
  sales.forEach((s) => {
    const key = s.userName || 'Unknown'
    refundCounts.set(key, (refundCounts.get(key) || 0) + 1)
  })

  return activities
}

export function getBusinessHealthSummary(range: DateRange): BusinessHealthSummary {
  const salesSummary = getSalesSummary(range)
  const profitSummary = getProfitSummary(range)
  const inventory = getInventoryHealth()
  const topProducts = getBestSellingProducts(range, 1)
  const topCustomers = getTopCustomers(range, 1)
  const storePerf = getStorePerformance(range)

  const recommendedActions: string[] = []
  if (inventory.lowStock.length > 0) recommendedActions.push(`Restock ${inventory.lowStock.length} low-stock products`)
  if (inventory.outOfStock.length > 0) recommendedActions.push(`Restock ${inventory.outOfStock.length} out-of-stock products immediately`)
  if (inventory.expiring.length > 0) recommendedActions.push(`Review ${inventory.expiring.length} products expiring soon`)
  if (inventory.expired.length > 0) recommendedActions.push(`Remove ${inventory.expired.length} expired products from inventory`)

  return {
    netSales: salesSummary.netSales,
    grossProfit: profitSummary.grossProfit,
    transactions: salesSummary.transactionCount,
    averageOrderValue: salesSummary.averageOrderValue,
    discounts: salesSummary.discountTotal,
    topProduct: topProducts[0]?.name ?? null,
    topCustomer: topCustomers[0]?.name ?? null,
    bestBranch: storePerf[0]?.branchName ?? null,
    lowStockCount: inventory.lowStock.length,
    outOfStockCount: inventory.outOfStock.length,
    expiringCount: inventory.expiring.length,
    recommendedActions,
  }
}

export function getHourlySales(range: DateRange): Array<{ hour: number; count: number; total: number }> {
  const sales = filterSalesByRange(store.getSales(), range)
  const hours: Array<{ hour: number; count: number; total: number }> = []
  for (let h = 0; h < 24; h++) hours.push({ hour: h, count: 0, total: 0 })
  sales.forEach((s) => {
    const h = new Date(s.timestamp).getHours()
    hours[h].count++
    hours[h].total += s.total
  })
  return hours
}

export function getAverageOrderValue(range: DateRange): number {
  return getSalesSummary(range).averageOrderValue
}
