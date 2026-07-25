import jsPDF from 'jspdf'
import { formatDate, formatDateTime } from '@/lib/utils'
import { money, type Sale } from '@/lib/store'

export interface SalesReportData {
  label: string
  startDate: string
  endDate: string
  sales: number
  revenue: number
  itemsSold: number
  avgOrderValue: number
  discounts: number
  refunds: number
  byPayment: Record<string, number>
  byDay: Record<string, number>
  topProducts: Array<{ name: string; qty: number; total: number }>
  transactions: Sale[]
}

export interface InventoryReportData {
  label: string
  generatedAt: string
  totalSkus: number
  totalStock: number
  inventoryValue: number
  lowStock: Array<{ name: string; stock: number; minStock: number }>
  outOfStock: Array<{ name: string }>
  expiring: Array<{ name: string; expiryDate: string }>
  expired: Array<{ name: string; expiryDate: string }>
}

export type ReportType = 'sales' | 'inventory'

function getStoreName(): string {
  if (typeof window === 'undefined') return 'EMDPOS Store'
  return localStorage.getItem('emdpos_store_name') || 'EMDPOS Store'
}

function addHeader(doc: jsPDF, title: string, period: string, shopName: string = 'EMDPOS Store') {
  // Logo mark
  doc.setFillColor(250, 204, 21)
  doc.roundedRect(14, 10, 18, 18, 4, 4, 'F')
  doc.setDrawColor(24, 24, 27)
  doc.setLineWidth(1.5)
  doc.line(18, 17, 30, 17)
  doc.line(18, 22, 28, 22)
  doc.line(18, 27, 26, 27)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(250, 204, 21)
  doc.text(shopName, 36, 18)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(161, 161, 170)
  doc.text('Powered by EMDPOS Retail OS', 36, 25)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.setTextColor(250, 204, 21)
  doc.text(title.toUpperCase(), 14, 40)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(161, 161, 170)
  doc.text(`Period: ${period}`, 14, 48)

  doc.setDrawColor(250, 204, 21)
  doc.setLineWidth(0.6)
  doc.line(14, 52, 196, 52)
}

function fillPage(doc: jsPDF) {
  doc.setFillColor(24, 24, 27)
  doc.rect(0, 0, 210, 297, 'F')
}

interface TableOptions {
  headerFontSize?: number
  rowFontSize?: number
  headerBold?: boolean
  rowBold?: boolean
  headerBg?: [number, number, number]
  rowBg?: [number, number, number]
  altRowBg?: [number, number, number]
  borderColor?: [number, number, number]
  headerTextColor?: [number, number, number]
  textColor?: [number, number, number]
  minRowHeight?: number
  cellPadding?: number
}

function addTable(
  doc: jsPDF,
  x: number,
  y: number,
  headers: string[],
  rows: (string | string[])[][],
  colWidths: number[],
  options: TableOptions = {}
): number {
  const {
    headerFontSize = 9,
    rowFontSize = 9,
    headerBold = true,
    rowBold = false,
    headerBg = [39, 39, 42],
    rowBg = [24, 24, 27],
    altRowBg = [24, 24, 27],
    borderColor = [63, 63, 70],
    textColor = [255, 255, 255],
    minRowHeight = 10,
    cellPadding = 3,
  } = options

  const headerHeight = headerFontSize + cellPadding * 2 + 2
  const lineHeight = rowFontSize * 1.15

  const wrappedRows = rows.map((row) =>
    row.map((cell, i) => {
      const width = colWidths[i] - cellPadding * 2
      if (Array.isArray(cell)) {
        return (cell as string[]).flatMap((line) => doc.splitTextToSize(line, width))
      }
      return doc.splitTextToSize(cell as string, width)
    })
  )

  const rowHeights = wrappedRows.map((row) => {
    const maxLines = row.reduce((max, lines) => Math.max(max, lines.length), 1)
    return Math.max(maxLines * lineHeight + cellPadding * 2, minRowHeight)
  })

  const totalWidth = colWidths.reduce((a, b) => a + b, 0)
  const totalHeight = headerHeight + rowHeights.reduce((a, b) => a + b, 0)
  const headerText = options.headerTextColor || textColor

  // Header background
  doc.setFillColor(...headerBg)
  doc.rect(x, y, totalWidth, headerHeight, 'F')

  // Header text
  doc.setFont('helvetica', headerBold ? 'bold' : 'normal')
  doc.setFontSize(headerFontSize)
  doc.setTextColor(...headerText)
  let cursorX = x
  headers.forEach((h, i) => {
    doc.text(h, cursorX + cellPadding, y + headerHeight / 2 + headerFontSize / 3)
    cursorX += colWidths[i]
  })

  // Rows
  let cursorY = y + headerHeight
  wrappedRows.forEach((row, ri) => {
    const bg = ri % 2 === 0 ? rowBg : altRowBg
    doc.setFillColor(...bg)
    doc.rect(x, cursorY, totalWidth, rowHeights[ri], 'F')

    doc.setFont('helvetica', rowBold ? 'bold' : 'normal')
    doc.setFontSize(rowFontSize)
    doc.setTextColor(...textColor)

    cursorX = x
    row.forEach((lines, i) => {
      doc.text(lines as string[], cursorX + cellPadding, cursorY + cellPadding + rowFontSize * 0.8)
      cursorX += colWidths[i]
    })

    cursorY += rowHeights[ri]
  })

  // Borders
  doc.setDrawColor(...borderColor)
  doc.setLineWidth(0.25)

  // Outer border
  doc.rect(x, y, totalWidth, totalHeight)

  // Vertical lines
  let vx = x
  colWidths.slice(0, -1).forEach((w) => {
    vx += w
    doc.line(vx, y, vx, y + totalHeight)
  })

  // Horizontal lines
  let hy = y + headerHeight
  doc.line(x, hy, x + totalWidth, hy)
  rowHeights.forEach((h) => {
    hy += h
    doc.line(x, hy, x + totalWidth, hy)
  })

  return y + totalHeight
}

function addTransactionList(doc: jsPDF, transactions: Sale[], startY: number): number {
  let y = startY

  doc.setFont('helvetica', 'bold')
  doc.setTextColor(250, 204, 21)
  doc.setFontSize(16)
  doc.text('Transactions', 14, y)
  y += 12

  if (transactions.length === 0) {
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(161, 161, 170)
    doc.setFontSize(11)
    doc.text('No transactions recorded for this period.', 14, y)
    return y + 12
  }

  if (y > 230) {
    doc.addPage()
    fillPage(doc)
    y = 20
  }

  const headers = ['Date & Time', 'Items', 'Subtotal', 'Discount', 'Total']
  const colWidths = [48, 84, 26, 26, 26]
  const rows: (string | string[])[][] = transactions.map((t) => {
    const itemLines = t.items.map((i) => `${i.qty} x ${i.name} @ ${money(i.price)} = ${money(i.qty * i.price)}`)
    return [formatDateTime(t.timestamp), itemLines, money(t.subtotal), money(t.discount), money(t.total)]
  })

  y = addTable(doc, 14, y, headers, rows, colWidths, {
    headerFontSize: 9,
    rowFontSize: 8,
    rowBold: false,
    minRowHeight: 14,
    cellPadding: 3,
    headerBg: [250, 204, 21],
    headerTextColor: [24, 24, 27],
    textColor: [255, 255, 255],
    borderColor: [255, 255, 255],
  })

  return y + 6
}

function addSummaryFooter(doc: jsPDF, startY: number, totalTransactions: number, totalSales: number): number {
  let y = startY
  if (y > 230) {
    doc.addPage()
    fillPage(doc)
    y = 20
  }
  return addTable(doc, 14, y, ['Total Transactions', 'Total Sales'], [[totalTransactions.toString(), money(totalSales)]], [90, 92], {
    headerFontSize: 10,
    rowFontSize: 14,
    rowBold: true,
    headerBg: [250, 204, 21],
    headerTextColor: [24, 24, 27],
    textColor: [255, 255, 255],
    borderColor: [250, 204, 21],
    minRowHeight: 24,
    cellPadding: 4,
  })
}

function addFooter(doc: jsPDF) {
  const phone = '0244-6475-10'
  const website = 'www.emdulab.com'
  const email = 'admin@emdulab.com'
  const copyright = 'EMD POS 2026, All rights reserved. MDLab Enterprise.'

  const pageCount = doc.getNumberOfPages()
  const pageWidth = doc.internal.pageSize.getWidth()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setDrawColor(250, 204, 21)
    doc.setLineWidth(0.3)
    doc.line(14, 276, 196, 276)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(160, 160, 170)

    const contact = `Tel: ${phone} | ${website} | ${email}`
    const contactWidth = doc.getTextWidth(contact)
    const copyrightWidth = doc.getTextWidth(copyright)
    doc.text(contact, (pageWidth - contactWidth) / 2, 283)
    doc.text(copyright, (pageWidth - copyrightWidth) / 2, 289)
  }
}

function addBusinessAdvice(doc: jsPDF, data: SalesReportData, startY: number): number {
  let y = startY
  if (y > 230) {
    doc.addPage()
    fillPage(doc)
    y = 20
  }

  const tips: { text: string; color: 'green' | 'yellow' | 'red' | 'white' }[] = []

  if (data.revenue === 0) {
    tips.push({ text: 'No sales recorded for this period. Run promotions or social media ads to boost traffic.', color: 'red' })
  } else {
    if (data.topProducts.length > 0) {
      const top = data.topProducts[0]
      tips.push({ text: `Top seller is ${top.name} (${top.qty} sold, ${money(top.total)}). Increase stock and promote it.`, color: 'green' })
    }
    if (data.avgOrderValue < 20) {
      tips.push({ text: 'Average order value is low. Bundle products or upsell higher-margin items at checkout.', color: 'yellow' })
    }
    if (data.discounts > data.revenue * 0.2) {
      tips.push({ text: 'Discounts exceed 20% of revenue. Review your pricing and discount strategy.', color: 'red' })
    } else if (data.discounts > 0) {
      tips.push({ text: 'Discounts are helping sales. Track which offers drive the most profit.', color: 'green' })
    }
    const paymentMethods = Object.keys(data.byPayment)
    if (paymentMethods.length === 1 && data.byPayment['cash']) {
      tips.push({ text: 'Cash dominates payments. Add mobile/card options to reduce queues and increase convenience.', color: 'yellow' })
    }
  }

  if (tips.length === 0) {
    tips.push({ text: 'Sales are steady. Keep monitoring top products and customer buying patterns.', color: 'white' })
  }

  doc.setFont('helvetica', 'bold')
  doc.setTextColor(250, 204, 21)
  doc.setFontSize(16)
  doc.text('Business Insights & Future Advice', 14, y)
  y += 12

  const colorMap: Record<string, [number, number, number]> = {
    green: [34, 197, 94],
    yellow: [250, 204, 21],
    red: [239, 68, 68],
    white: [255, 255, 255],
  }

  tips.forEach((tip) => {
    const [r, g, b] = colorMap[tip.color]
    doc.setDrawColor(r, g, b)
    doc.setLineWidth(1.2)
    doc.line(14, y - 3, 14, y + 3)

    doc.setFont('helvetica', 'normal')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(10)
    const lines = doc.splitTextToSize(tip.text, 174)
    doc.text(lines, 20, y)
    y += 5.5 * (lines.length || 1) + 6
  })

  return y
}

function addInventoryAdvice(doc: jsPDF, data: InventoryReportData, startY: number): number {
  let y = startY
  if (y > 230) {
    doc.addPage()
    fillPage(doc)
    y = 20
  }

  const tips: { text: string; color: 'green' | 'yellow' | 'red' | 'white' }[] = []

  if (data.totalSkus === 0) {
    tips.push({ text: 'No inventory recorded. Add products to start tracking stock and sales.', color: 'white' })
  } else {
    tips.push({ text: `You carry ${data.totalSkus} SKUs with ${data.totalStock} items in stock valued at ${money(data.inventoryValue)}.`, color: 'green' })
    if (data.lowStock.length > 0) {
      tips.push({ text: `${data.lowStock.length} products are below minimum stock. Reorder soon to avoid stockouts.`, color: 'yellow' })
    }
    if (data.outOfStock.length > 0) {
      tips.push({ text: `${data.outOfStock.length} products are out of stock. Urgent reorder recommended.`, color: 'red' })
    }
    if (data.expiring.length > 0) {
      tips.push({ text: `${data.expiring.length} products expire within 7 days. Run a clearance sale.`, color: 'yellow' })
    }
    if (data.expired.length > 0) {
      tips.push({ text: `${data.expired.length} products have expired. Remove them from shelves immediately.`, color: 'red' })
    }
    if (tips.length === 1) {
      tips.push({ text: 'Inventory is healthy. Maintain reorder cycles and monitor expiry dates.', color: 'white' })
    }
  }

  doc.setFont('helvetica', 'bold')
  doc.setTextColor(250, 204, 21)
  doc.setFontSize(16)
  doc.text('Inventory Statistics & Business Advice', 14, y)
  y += 12

  const colorMap: Record<string, [number, number, number]> = {
    green: [34, 197, 94],
    yellow: [250, 204, 21],
    red: [239, 68, 68],
    white: [255, 255, 255],
  }

  tips.forEach((tip) => {
    const [r, g, b] = colorMap[tip.color]
    doc.setDrawColor(r, g, b)
    doc.setLineWidth(1.2)
    doc.line(14, y - 3, 14, y + 3)

    doc.setFont('helvetica', 'normal')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(10)
    const lines = doc.splitTextToSize(tip.text, 174)
    doc.text(lines, 20, y)
    y += 5.5 * (lines.length || 1) + 6
  })

  return y
}

export function generateSalesPDF(data: SalesReportData) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  fillPage(doc)
  const periodText = data.startDate === data.endDate ? data.startDate : `${data.startDate} – ${data.endDate}`
  const shopName = getStoreName()

  addHeader(doc, `${data.label} Sales Report`, periodText, shopName)

  let y = 60
  y = addTable(doc, 14, y, ['Transactions', 'Revenue', 'Items Sold', 'Avg Order'], [[data.sales.toString(), money(data.revenue), data.itemsSold.toString(), money(data.avgOrderValue)]], [45, 45, 45, 45], {
    headerFontSize: 10,
    rowFontSize: 14,
    rowBold: true,
    headerBg: [250, 204, 21],
    headerTextColor: [24, 24, 27],
    textColor: [255, 255, 255],
    borderColor: [250, 204, 21],
    minRowHeight: 24,
    cellPadding: 4,
  })
  y += 10

  // Payment method breakdown
  if (Object.keys(data.byPayment).length > 0) {
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(250, 204, 21)
    doc.setFontSize(13)
    doc.text('Payment Methods', 14, y)
    y += 8
    const rows = Object.entries(data.byPayment).map(([method, amount]) => [method.toUpperCase(), money(amount)])
    y = addTable(doc, 14, y, ['Method', 'Amount'], rows, [90, 92])
    y += 10
  }

  // Sales by day
  if (Object.keys(data.byDay).length > 0) {
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(250, 204, 21)
    doc.setFontSize(13)
    doc.text('Sales by Day', 14, y)
    y += 8
    const rows = Object.entries(data.byDay)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([d, t]) => [d, money(t)])
    y = addTable(doc, 14, y, ['Date', 'Total'], rows, [90, 92])
    y += 10
  }

  // Top products
  if (data.topProducts.length > 0) {
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(250, 204, 21)
    doc.setFontSize(13)
    doc.text('Top Selling Products', 14, y)
    y += 8
    const rows = data.topProducts.map((p) => [p.name, p.qty.toString(), money(p.total)])
    y = addTable(doc, 14, y, ['Product', 'Qty', 'Revenue'], rows, [95, 40, 47])
    y += 10
  }

  // Product statistics and future business advice
  y = addBusinessAdvice(doc, data, y)
  y += 6

  // Transaction list
  y = addTransactionList(doc, data.transactions, y)
  y += 6

  // Bottom summary
  y = addSummaryFooter(doc, y, data.transactions.length, data.revenue)

  addFooter(doc)
  return doc
}

export function generateInventoryPDF(data: InventoryReportData) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  fillPage(doc)
  const shopName = getStoreName()
  addHeader(doc, 'Inventory Report', `Generated: ${data.generatedAt}`, shopName)

  let y = 60
  y = addTable(doc, 14, y, ['Total SKUs', 'Total Stock', 'Inventory Value'], [[data.totalSkus.toString(), data.totalStock.toString(), money(data.inventoryValue)]], [60, 60, 60], {
    headerFontSize: 10,
    rowFontSize: 14,
    rowBold: true,
    headerBg: [250, 204, 21],
    headerTextColor: [24, 24, 27],
    textColor: [255, 255, 255],
    borderColor: [250, 204, 21],
    minRowHeight: 24,
    cellPadding: 4,
  })
  y += 10

  const hasAlerts = data.lowStock.length || data.outOfStock.length || data.expiring.length || data.expired.length

  if (hasAlerts) {
    if (data.lowStock.length > 0) {
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(250, 204, 21)
      doc.setFontSize(13)
      doc.text('Low Stock Items', 14, y)
      y += 8
      const rows = data.lowStock.map((p) => [p.name, p.stock.toString(), (p.minStock ?? 0).toString()])
      y = addTable(doc, 14, y, ['Product', 'Stock', 'Min Stock'], rows, [105, 38, 39])
      y += 10
    }

    if (data.outOfStock.length > 0) {
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(250, 204, 21)
      doc.setFontSize(13)
      doc.text('Out of Stock Items', 14, y)
      y += 8
      const rows = data.outOfStock.map((p) => [p.name])
      y = addTable(doc, 14, y, ['Product'], rows, [182])
      y += 10
    }

    if (data.expiring.length > 0 || data.expired.length > 0) {
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(250, 204, 21)
      doc.setFontSize(13)
      doc.text('Expiry Alerts', 14, y)
      y += 8
      const rows = [
        ...data.expiring.map((p) => [p.name, p.expiryDate, 'Expiring soon']),
        ...data.expired.map((p) => [p.name, p.expiryDate, 'Expired']),
      ]
      y = addTable(doc, 14, y, ['Product', 'Expiry Date', 'Status'], rows, [95, 45, 42])
      y += 10
    }
  } else {
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(161, 161, 170)
    doc.setFontSize(11)
    doc.text('No inventory data to display.', 14, y)
    y += 10
  }

  // Inventory statistics and future business advice
  y = addInventoryAdvice(doc, data, y)
  y += 6

  addFooter(doc)
  return doc
}

export function downloadPDF(doc: jsPDF, filename: string) {
  doc.save(filename)
}
