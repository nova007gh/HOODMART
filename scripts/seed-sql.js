const fs = require('fs')
const path = require('path')

const root = path.join(__dirname, '..')
const sqlPath = path.join(root, '127_0_0_1 (4).sql')
const outPath = path.join(root, 'lib', 'seed-data.ts')

const sql = fs.readFileSync(sqlPath, 'utf8')

function parseValue(s) {
  const v = s.trim()
  if (v === 'NULL') return null
  if (v.startsWith("'") && v.endsWith("'")) {
    return v.slice(1, -1).replace(/''/g, "'")
  }
  if (/^-?\d+$/.test(v)) return parseInt(v, 10)
  if (/^-?\d+\.\d+$/.test(v)) return parseFloat(v)
  return v
}

function parseRow(text) {
  const values = []
  let current = ''
  let inQuote = false
  let i = 0
  while (i < text.length) {
    const c = text[i]
    if (inQuote) {
      if (c === "'") {
        if (i + 1 < text.length && text[i + 1] === "'") {
          current += "'"
          i += 2
          continue
        }
        inQuote = false
      } else {
        current += c
      }
    } else {
      if (c === "'") {
        inQuote = true
      } else if (c === ',') {
        values.push(parseValue(current))
        current = ''
      } else {
        current += c
      }
    }
    i++
  }
  values.push(parseValue(current))
  return values
}

function extractRows(sql, tableName) {
  const rows = []
  const re = new RegExp(`INSERT INTO\\s+\`${tableName}\`\\s*\\([^)]*\\)\\s*VALUES`, 'gi')
  let m
  while ((m = re.exec(sql)) !== null) {
    let i = m.index + m[0].length
    while (true) {
      while (i < sql.length && /\s/.test(sql[i])) i++
      if (sql[i] !== '(') break
      let depth = 0
      let start = i
      while (i < sql.length) {
        const c = sql[i]
        if (c === '(') depth++
        else if (c === ')') {
          depth--
          if (depth === 0) {
            rows.push(parseRow(sql.slice(start + 1, i)))
            i++
            break
          }
        }
        i++
      }
      while (i < sql.length && /[\s,]/.test(sql[i])) i++
      if (sql[i] === ';') break
    }
  }
  return rows
}

const itemRows = extractRows(sql, 'ospos_items')
const quantityRows = extractRows(sql, 'ospos_item_quantities')
const inventoryRows = extractRows(sql, 'ospos_inventory')
const peopleRows = extractRows(sql, 'ospos_people')
const customerRows = extractRows(sql, 'ospos_customers')
const employeeRows = extractRows(sql, 'ospos_employees')
const supplierRows = extractRows(sql, 'ospos_suppliers')
const salesRows = extractRows(sql, 'ospos_sales')
const salesItemsRows = extractRows(sql, 'ospos_sales_items')
const salesPaymentsRows = extractRows(sql, 'ospos_sales_payments')

const quantityMap = new Map()
for (const row of quantityRows) {
  const [item_id, location_id, quantity] = row
  if (Number(location_id) === 1 || !quantityMap.has(item_id)) {
    quantityMap.set(item_id, Number(quantity))
  }
}

const products = itemRows
  .filter((r) => Number(r[13]) !== 1)
  .map((r) => {
    const [
      name,
      category,
      supplier_id,
      item_number,
      description,
      cost_price,
      unit_price,
      reorder_level,
      receiving_quantity,
      item_id,
    ] = r
    return {
      id: String(item_id),
      name,
      price: parseFloat(unit_price) || 0,
      cost: parseFloat(cost_price) || 0,
      barcode: item_number || '',
      stock: quantityMap.get(item_id) ?? 0,
      minStock: parseFloat(reorder_level) || 0,
      category,
      supplier: supplier_id ? String(supplier_id) : '',
      description: description || '',
      image: '',
      unit: '',
      expiryDate: '',
      itemNumber: item_number || '',
      costPrice: cost_price ? String(cost_price) : '',
      unitPrice: unit_price ? String(unit_price) : '',
      receivingQuantity: Number(receiving_quantity) || 0,
      reorderLevel: parseFloat(reorder_level) || 0,
    }
  })

const productMap = new Map(products.map((p) => [p.id, p]))

const activities = inventoryRows.map((r) => {
  const [trans_id, trans_items, trans_user, trans_date, trans_comment, trans_location, trans_inventory] = r
  return {
    id: String(trans_id),
    itemId: String(trans_items),
    user: String(trans_user),
    date: String(trans_date),
    comment: String(trans_comment),
    location: Number(trans_location),
    quantity: Number(trans_inventory),
  }
})

function buildPeopleMap(rows) {
  const map = new Map()
  for (const row of rows) {
    const [
      first_name,
      last_name,
      gender,
      phone_number,
      email,
      address_1,
      address_2,
      city,
      state,
      zip,
      country,
      comments,
      person_id,
    ] = row
    const id = String(person_id)
    map.set(id, {
      firstName: first_name || '',
      lastName: last_name || '',
      name: `${first_name || ''} ${last_name || ''}`.trim(),
      phone: phone_number || '',
      email: email || '',
      address: address_1 || '',
      address2: address_2 || '',
      city: city || '',
      state: state || '',
      zip: zip || '',
      country: country || '',
      comments: comments || '',
    })
  }
  return map
}

const peopleMap = buildPeopleMap(peopleRows)

const customers = customerRows.map((r) => {
  const [person_id, company_name, account_number, taxable, deleted] = r
  const person = peopleMap.get(String(person_id)) || {}
  return {
    id: String(person_id),
    personId: person_id,
    name: person.name || company_name || String(person_id),
    phone: person.phone || '',
    email: person.email || '',
    address: person.address || '',
    companyName: company_name || '',
    accountNumber: account_number || '',
    taxable: Number(taxable),
    deleted: Number(deleted) === 1,
    purchases: 0,
    total: 0,
  }
})

const employees = employeeRows.map((r) => {
  const [username, password, person_id, deleted] = r
  const person = peopleMap.get(String(person_id)) || {}
  return {
    id: String(person_id),
    personId: person_id,
    username,
    name: person.name || username,
    firstName: person.firstName || '',
    lastName: person.lastName || '',
    phone: person.phone || '',
    email: person.email || '',
    deleted: Number(deleted) === 1,
  }
})

const suppliers = supplierRows.map((r) => {
  const [person_id, company_name, agency_name, account_number, deleted] = r
  const person = peopleMap.get(String(person_id)) || {}
  return {
    id: String(person_id),
    personId: person_id,
    name: person.name || company_name || String(person_id),
    companyName: company_name || '',
    agencyName: agency_name || '',
    accountNumber: account_number || '',
    phone: person.phone || '',
    email: person.email || '',
    address: person.address || '',
    deleted: Number(deleted) === 1,
  }
})

const salesByItem = new Map()
for (const item of salesItemsRows) {
  const [sale_id, item_id, description, serialnumber, line, quantity_purchased, item_cost_price, item_unit_price, discount_percent, item_location] = item
  const saleId = String(sale_id)
  const list = salesByItem.get(saleId) || []
  list.push({
    id: String(item_id),
    saleItemId: `${sale_id}-${line}`,
    name: productMap.get(String(item_id))?.name || description || 'Unknown item',
    price: parseFloat(item_unit_price) || 0,
    cost: parseFloat(item_cost_price) || 0,
    qty: parseFloat(quantity_purchased) || 0,
    discountPercent: parseFloat(discount_percent) || 0,
    serialNumber: serialnumber || '',
    location: Number(item_location),
  })
  salesByItem.set(saleId, list)
}

const paymentsBySale = new Map()
for (const payment of salesPaymentsRows) {
  const [sale_id, payment_type, payment_amount] = payment
  const saleId = String(sale_id)
  if (!paymentsBySale.has(saleId)) {
    paymentsBySale.set(saleId, {
      paymentType: payment_type,
      amount: parseFloat(payment_amount) || 0,
    })
  }
}

const paymentMethodMap = { Cash: 'cash', Card: 'card', Mobile: 'mobile' }
const customerPurchaseStats = new Map()
const customerTotalStats = new Map()

const sales = salesRows.map((r) => {
  const [sale_time, customer_id, employee_id, comment, invoice_number, sale_id] = r
  const saleId = String(sale_id)
  const items = salesByItem.get(saleId) || []
  const subtotal = items.reduce((s, x) => s + x.price * x.qty, 0)
  const discount = items.reduce((s, x) => s + x.price * x.qty * (x.discountPercent / 100), 0)
  const payment = paymentsBySale.get(saleId)
  const total = payment ? payment.amount : Math.max(0, subtotal - discount)
  const employee = employees.find((e) => String(e.personId) === String(employee_id))

  if (customer_id) {
    customerPurchaseStats.set(String(customer_id), (customerPurchaseStats.get(String(customer_id)) || 0) + 1)
    customerTotalStats.set(String(customer_id), (customerTotalStats.get(String(customer_id)) || 0) + total)
  }

  return {
    id: saleId,
    timestamp: sale_time,
    saleTime: sale_time,
    saleId: sale_id,
    customer: customer_id ? String(customer_id) : undefined,
    customerId: customer_id ? String(customer_id) : undefined,
    employeeId: String(employee_id),
    userName: employee?.name || String(employee_id),
    userEmail: employee?.email,
    comment: comment || '',
    invoiceNumber: invoice_number || '',
    items,
    subtotal,
    discount,
    total,
    paymentMethod: payment ? (paymentMethodMap[payment.paymentType] || 'cash') : 'cash',
    paymentType: payment ? payment.paymentType : 'Cash',
    branchId: '1',
  }
})

for (const c of customers) {
  c.purchases = customerPurchaseStats.get(String(c.personId)) || 0
  c.total = customerTotalStats.get(String(c.personId)) || 0
}

const header = `// Auto-generated from 127_0_0_1 (4).sql by scripts/seed-sql.js\n\n`
const body = `export const sqlProducts = ${JSON.stringify(products)}\n\n` +
  `export const sqlActivities = ${JSON.stringify(activities)}\n\n` +
  `export const sqlCustomers = ${JSON.stringify(customers)}\n\n` +
  `export const sqlEmployees = ${JSON.stringify(employees)}\n\n` +
  `export const sqlSuppliers = ${JSON.stringify(suppliers)}\n\n` +
  `export const sqlSales = ${JSON.stringify(sales)}\n`

fs.writeFileSync(outPath, header + body, 'utf8')

console.log(`Generated ${outPath}`)
console.log(`  products: ${products.length}`)
console.log(`  activities: ${activities.length}`)
console.log(`  customers: ${customers.length}`)
console.log(`  employees: ${employees.length}`)
console.log(`  suppliers: ${suppliers.length}`)
console.log(`  sales: ${sales.length}`)
