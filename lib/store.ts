import * as sync from './sync'

export interface Product {
  id: string
  name: string
  price: number
  barcode?: string
  stock?: number
  minStock?: number
  category?: string
  image?: string
  cost?: number
  supplier?: string
  unit?: string
  description?: string
  expiryDate?: string
  itemNumber?: string
  costPrice?: string
  unitPrice?: string
  receivingQuantity?: number
  reorderLevel?: number
  isSerialized?: boolean
  deleted?: boolean
  discountPercent?: number
}

export interface Activity {
  id: string
  itemId: string
  user: string
  date: string
  comment: string
  location: number
  quantity: number
}

export interface Discount {
  id: string
  name: string
  type: 'percent' | 'fixed'
  value: number
}

export interface CartItem extends Product {
  qty: number
}

export interface Sale {
  id: string
  items: CartItem[]
  discount: number
  subtotal: number
  total: number
  timestamp: string
  customer?: string
  paymentMethod?: 'cash' | 'card' | 'mobile'
  branchId?: string
  userEmail?: string
  userName?: string
  saleTime?: string
  saleId?: string | number
  customerId?: string
  employeeId?: string
  comment?: string
  invoiceNumber?: string
  paymentType?: string
}

export interface SuspendedSale {
  id: string
  name: string
  items: CartItem[]
  discountId: string
  totals: { subtotal: number; discount: number; total: number }
  timestamp: string
}

export interface Customer {
  id: string
  name: string
  phone: string
  purchases: number
  total: number
  personId?: string | number
  firstName?: string
  lastName?: string
  email?: string
  address?: string
  companyName?: string
  accountNumber?: string
  taxable?: number
  deleted?: boolean
}

export interface Employee {
  id: string
  personId?: string | number
  username?: string
  name: string
  firstName?: string
  lastName?: string
  phone?: string
  email?: string
  role?: string
  permissions?: string[]
  /** Square JPEG data URL used as the profile picture */
  avatar?: string
  deleted?: boolean
}

export interface Supplier {
  id: string
  personId?: string | number
  name: string
  companyName?: string
  agencyName?: string
  accountNumber?: string
  phone?: string
  email?: string
  address?: string
  deleted?: boolean
}

export interface Branch {
  id: string
  name: string
  location: string
  status: 'active' | 'inactive'
}

export interface GiftCard {
  id: string
  code: string
  balance: number
  initialBalance: number
  status: 'active' | 'used' | 'expired' | 'disabled'
  customerName?: string
  customerEmail?: string
  expiryDate?: string
  notes?: string
  createdAt: string
  transactions: GiftCardTransaction[]
}

export interface GiftCardTransaction {
  id: string
  type: 'issue' | 'topup' | 'redeem' | 'refund'
  amount: number
  balanceAfter: number
  date: string
  note?: string
}

export interface Expense {
  id: string
  description: string
  amount: number
  category: string
  date: string
  paymentMethod?: 'cash' | 'card' | 'mobile'
  vendor?: string
  notes?: string
}

export interface Quotation {
  id: string
  quoteNumber: string
  customerName: string
  customerEmail?: string
  customerPhone?: string
  items: CartItem[]
  subtotal: number
  discount: number
  total: number
  status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired'
  validUntil: string
  notes?: string
  createdAt: string
}

export const KEYS = {
  PRODUCTS: 'hoodmart_v2_products',
  DISCOUNTS: 'hoodmart_v2_discounts',
  SALES: 'hoodmart_v2_sales',
  CUSTOMERS: 'hoodmart_v2_customers',
  SUSPENDED: 'hoodmart_v2_suspended',
  BRANCHES: 'hoodmart_v2_branches',
  ACTIVITIES: 'hoodmart_v2_activities',
  EMPLOYEES: 'hoodmart_v2_employees',
  SUPPLIERS: 'hoodmart_v2_suppliers',
  GIFT_CARDS: 'hoodmart_v2_gift_cards',
  EXPENSES: 'hoodmart_v2_expenses',
  QUOTATIONS: 'hoodmart_v2_quotations',
}

const SEED_KEY = 'hoodmart_v2_seeded'

function get<T>(k: string, def: T): T {
  if (typeof window === 'undefined') return def
  try {
    const v = localStorage.getItem(k)
    return v ? JSON.parse(v) : def
  } catch {
    return def
  }
}

function set<T>(k: string, v: T) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(k, JSON.stringify(v))
  } catch (err) {
    console.warn('localStorage set failed:', k, err)
  }
}

function uuid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

function seedIfNeeded() {
  if (typeof window === 'undefined') return
  if (get(SEED_KEY, false)) return
  set(SEED_KEY, true)
}

export const store = {
  getProducts: (): Product[] => { seedIfNeeded(); return get(KEYS.PRODUCTS, []) },
  setProducts: (v: Product[]) => set(KEYS.PRODUCTS, v),
  addProduct: (p: Omit<Product, 'id'>) => {
    const products = store.getProducts()
    const product = { ...p, id: uuid() } as Product
    products.push(product)
    store.setProducts(products)
    sync.pushLocalChange('products', product)
  },
  updateProduct: (id: string, p: Partial<Product>) => {
    const products = store.getProducts()
    const idx = products.findIndex((x) => x.id === id)
    if (idx >= 0) {
      products[idx] = { ...products[idx], ...p }
      store.setProducts(products)
      sync.pushLocalChange('products', products[idx])
    }
  },
  deleteProduct: (id: string) => {
    store.setProducts(store.getProducts().filter((x) => x.id !== id))
    sync.pushLocalChange('products', { id }, 'delete')
  },

  getDiscounts: (): Discount[] => get(KEYS.DISCOUNTS, []),
  setDiscounts: (v: Discount[]) => set(KEYS.DISCOUNTS, v),
  addDiscount: (d: Omit<Discount, 'id'>) => {
    const discounts = store.getDiscounts()
    const discount = { ...d, id: uuid() } as Discount
    discounts.push(discount)
    store.setDiscounts(discounts)
    sync.pushLocalChange('discounts', discount)
  },
  updateDiscount: (id: string, d: Partial<Discount>) => {
    const discounts = store.getDiscounts()
    const idx = discounts.findIndex((x) => x.id === id)
    if (idx >= 0) {
      discounts[idx] = { ...discounts[idx], ...d }
      store.setDiscounts(discounts)
      sync.pushLocalChange('discounts', discounts[idx])
    }
  },
  deleteDiscount: (id: string) => {
    store.setDiscounts(store.getDiscounts().filter((x) => x.id !== id))
    sync.pushLocalChange('discounts', { id }, 'delete')
  },

  getSales: (): Sale[] => { seedIfNeeded(); return get(KEYS.SALES, []) },
  setSales: (v: Sale[]) => set(KEYS.SALES, v),
  addSale: (sale: Sale | Omit<Sale, 'id'>) => {
    const products = store.getProducts()
    const finalized = { ...sale, id: (sale as any).id || uuid() } as Sale

    finalized.items.forEach((item) => {
      const p = products.find((x) => x.id === item.id)
      if (p) p.stock = Math.max(0, (p.stock ?? 0) - item.qty)
    })
    store.setProducts(products)

    const sales = store.getSales()
    sales.unshift(finalized)
    store.setSales(sales)

    // Update customer purchase stats if linked
    if (finalized.customerId) {
      const customers = store.getCustomers()
      const c = customers.find((x) => x.id === finalized.customerId)
      if (c) {
        c.purchases = (c.purchases || 0) + 1
        c.total = (c.total || 0) + finalized.total
        store.setCustomers(customers)
        sync.pushLocalChange('customers', c)
      }
    } else if (finalized.customer) {
      // Match by email if no customerId
      const customers = store.getCustomers()
      const c = customers.find((x) => x.email?.toLowerCase() === finalized.customer?.toLowerCase())
      if (c) {
        c.purchases = (c.purchases || 0) + 1
        c.total = (c.total || 0) + finalized.total
        finalized.customerId = c.id
        store.setCustomers(customers)
        store.setSales(sales)
        sync.pushLocalChange('customers', c)
      }
    }

    sync.pushLocalChange('sales', finalized)
    finalized.items.forEach((item) => {
      const p = products.find((x) => x.id === item.id)
      if (p) sync.pushLocalChange('products', p)
    })
  },

  getCustomers: (): Customer[] => { seedIfNeeded(); return get(KEYS.CUSTOMERS, []) },
  setCustomers: (v: Customer[]) => set(KEYS.CUSTOMERS, v),
  addCustomer: (c: Omit<Customer, 'id'>) => {
    const customers = store.getCustomers()
    const customer = { ...c, id: uuid() } as Customer
    customers.unshift(customer)
    store.setCustomers(customers)
    sync.pushLocalChange('customers', customer)
  },
  deleteCustomer: (id: string) => {
    store.setCustomers(store.getCustomers().filter((c) => c.id !== id))
    sync.pushLocalChange('customers', { id }, 'delete')
  },
  updateCustomer: (id: string, c: Partial<Customer>) => {
    const customers = store.getCustomers()
    const idx = customers.findIndex((x) => x.id === id)
    if (idx >= 0) {
      customers[idx] = { ...customers[idx], ...c }
      store.setCustomers(customers)
      sync.pushLocalChange('customers', customers[idx])
    }
  },

  getEmployees: (): Employee[] => { seedIfNeeded(); return get(KEYS.EMPLOYEES, []) },
  setEmployees: (v: Employee[]) => set(KEYS.EMPLOYEES, v),
  addEmployee: (e: Omit<Employee, 'id'>) => {
    const employees = store.getEmployees()
    const employee = { ...e, id: uuid() } as Employee
    employees.unshift(employee)
    store.setEmployees(employees)
    sync.pushLocalChange('employees', employee)
  },
  updateEmployee: (id: string, e: Partial<Employee>) => {
    const employees = store.getEmployees()
    const idx = employees.findIndex((x) => x.id === id)
    if (idx >= 0) {
      employees[idx] = { ...employees[idx], ...e }
      store.setEmployees(employees)
      sync.pushLocalChange('employees', employees[idx])
    }
  },
  deleteEmployee: (id: string) => {
    store.setEmployees(store.getEmployees().filter((e) => e.id !== id))
    sync.pushLocalChange('employees', { id }, 'delete')
  },

  getSuppliers: (): Supplier[] => { seedIfNeeded(); return get(KEYS.SUPPLIERS, []) },
  setSuppliers: (v: Supplier[]) => set(KEYS.SUPPLIERS, v),
  addSupplier: (s: Omit<Supplier, 'id'>) => {
    const suppliers = store.getSuppliers()
    const supplier = { ...s, id: uuid() } as Supplier
    suppliers.unshift(supplier)
    store.setSuppliers(suppliers)
    sync.pushLocalChange('suppliers', supplier)
  },

  getActivities: (): Activity[] => { seedIfNeeded(); return get(KEYS.ACTIVITIES, []) },
  setActivities: (v: Activity[]) => set(KEYS.ACTIVITIES, v),
  addActivity: (a: Omit<Activity, 'id'>) => {
    const activities = store.getActivities()
    const activity = { ...a, id: uuid() } as Activity
    activities.unshift(activity)
    store.setActivities(activities)
    sync.pushLocalChange('activities', activity)
  },

  getSuspended: (): SuspendedSale[] => get(KEYS.SUSPENDED, []),
  setSuspended: (v: SuspendedSale[]) => set(KEYS.SUSPENDED, v),
  addSuspended: (s: Omit<SuspendedSale, 'id'>) => {
    const list = store.getSuspended()
    const suspended = { ...s, id: uuid() } as SuspendedSale
    list.unshift(suspended)
    store.setSuspended(list)
    sync.pushLocalChange('suspended', suspended)
  },
  deleteSuspended: (id: string) => {
    store.setSuspended(store.getSuspended().filter((s) => s.id !== id))
    sync.pushLocalChange('suspended', { id }, 'delete')
  },

  getBranches: (): Branch[] => get(KEYS.BRANCHES, []),
  setBranches: (v: Branch[]) => set(KEYS.BRANCHES, v),
  addBranch: (b: Omit<Branch, 'id'>) => {
    const branches = store.getBranches()
    const branch = { ...b, id: uuid() } as Branch
    branches.push(branch)
    store.setBranches(branches)
    sync.pushLocalChange('branches', branch)
  },
  updateBranch: (id: string, b: Partial<Branch>) => {
    const branches = store.getBranches()
    const idx = branches.findIndex((x) => x.id === id)
    if (idx >= 0) {
      branches[idx] = { ...branches[idx], ...b }
      store.setBranches(branches)
      sync.pushLocalChange('branches', branches[idx])
    }
  },
  getBranch: (id: string) => store.getBranches().find((b) => b.id === id),

  getGiftCards: (): GiftCard[] => get(KEYS.GIFT_CARDS, []),
  setGiftCards: (v: GiftCard[]) => set(KEYS.GIFT_CARDS, v),
  addGiftCard: (g: Omit<GiftCard, 'id' | 'code' | 'createdAt' | 'transactions'>) => {
    const giftCards = store.getGiftCards()
    const code = 'GC-' + Date.now().toString(36).toUpperCase().slice(-6) + Math.random().toString(36).toUpperCase().slice(-2)
    const now = new Date().toISOString()
    const giftCard: GiftCard = {
      ...g,
      id: uuid(),
      code,
      createdAt: now,
      transactions: [{
        id: uuid(),
        type: 'issue',
        amount: g.initialBalance,
        balanceAfter: g.initialBalance,
        date: now,
      }],
    }
    giftCards.unshift(giftCard)
    store.setGiftCards(giftCards)
    sync.pushLocalChange('gift_cards', giftCard)
    return giftCard
  },
  updateGiftCard: (id: string, g: Partial<GiftCard>) => {
    const giftCards = store.getGiftCards()
    const idx = giftCards.findIndex((x) => x.id === id)
    if (idx >= 0) {
      giftCards[idx] = { ...giftCards[idx], ...g }
      store.setGiftCards(giftCards)
      sync.pushLocalChange('gift_cards', giftCards[idx])
    }
  },
  deleteGiftCard: (id: string) => {
    store.setGiftCards(store.getGiftCards().filter((x) => x.id !== id))
    sync.pushLocalChange('gift_cards', { id }, 'delete')
  },
  topUpGiftCard: (id: string, amount: number) => {
    const giftCards = store.getGiftCards()
    const idx = giftCards.findIndex((x) => x.id === id)
    if (idx >= 0) {
      const gc = giftCards[idx]
      gc.balance += amount
      gc.transactions.push({
        id: uuid(),
        type: 'topup',
        amount,
        balanceAfter: gc.balance,
        date: new Date().toISOString(),
      })
      store.setGiftCards(giftCards)
      sync.pushLocalChange('gift_cards', gc)
    }
  },
  redeemGiftCard: (id: string, amount: number): boolean => {
    const giftCards = store.getGiftCards()
    const idx = giftCards.findIndex((x) => x.id === id)
    if (idx < 0) return false
    const gc = giftCards[idx]
    if (gc.balance < amount || gc.status !== 'active') return false
    gc.balance -= amount
    if (gc.balance <= 0) gc.status = 'used'
    gc.transactions.push({
      id: uuid(),
      type: 'redeem',
      amount,
      balanceAfter: gc.balance,
      date: new Date().toISOString(),
    })
    store.setGiftCards(giftCards)
    sync.pushLocalChange('gift_cards', gc)
    return true
  },
  findGiftCardByCode: (code: string): GiftCard | undefined => {
    return store.getGiftCards().find((x) => x.code.toUpperCase() === code.toUpperCase())
  },

  getExpenses: (): Expense[] => get(KEYS.EXPENSES, []),
  setExpenses: (v: Expense[]) => set(KEYS.EXPENSES, v),
  addExpense: (e: Omit<Expense, 'id'>) => {
    const expenses = store.getExpenses()
    const expense = { ...e, id: uuid() } as Expense
    expenses.unshift(expense)
    store.setExpenses(expenses)
    sync.pushLocalChange('expenses', expense)
  },
  updateExpense: (id: string, e: Partial<Expense>) => {
    const expenses = store.getExpenses()
    const idx = expenses.findIndex((x) => x.id === id)
    if (idx >= 0) {
      expenses[idx] = { ...expenses[idx], ...e }
      store.setExpenses(expenses)
      sync.pushLocalChange('expenses', expenses[idx])
    }
  },
  deleteExpense: (id: string) => {
    store.setExpenses(store.getExpenses().filter((x) => x.id !== id))
    sync.pushLocalChange('expenses', { id }, 'delete')
  },

  getQuotations: (): Quotation[] => get(KEYS.QUOTATIONS, []),
  setQuotations: (v: Quotation[]) => set(KEYS.QUOTATIONS, v),
  addQuotation: (q: Omit<Quotation, 'id' | 'quoteNumber' | 'createdAt'>) => {
    const quotations = store.getQuotations()
    const num = quotations.length + 1
    const quoteNumber = 'Q-' + String(num).padStart(4, '0')
    const quotation: Quotation = {
      ...q,
      id: uuid(),
      quoteNumber,
      createdAt: new Date().toISOString(),
    }
    quotations.unshift(quotation)
    store.setQuotations(quotations)
    sync.pushLocalChange('quotations', quotation)
    return quotation
  },
  updateQuotation: (id: string, q: Partial<Quotation>) => {
    const quotations = store.getQuotations()
    const idx = quotations.findIndex((x) => x.id === id)
    if (idx >= 0) {
      quotations[idx] = { ...quotations[idx], ...q }
      store.setQuotations(quotations)
      sync.pushLocalChange('quotations', quotations[idx])
    }
  },
  deleteQuotation: (id: string) => {
    store.setQuotations(store.getQuotations().filter((x) => x.id !== id))
    sync.pushLocalChange('quotations', { id }, 'delete')
  },
  convertQuotationToSale: (id: string): Sale | null => {
    const quotation = store.getQuotations().find((x) => x.id === id)
    if (!quotation) return null
    const sale: Sale = {
      id: uuid(),
      items: quotation.items,
      discount: quotation.discount,
      subtotal: quotation.subtotal,
      total: quotation.total,
      timestamp: new Date().toISOString(),
      customer: quotation.customerName,
      paymentMethod: 'cash',
      comment: `Converted from quotation ${quotation.quoteNumber}`,
    }
    store.addSale(sale)
    store.updateQuotation(id, { status: 'accepted' })
    return sale
  },
}

export function money(n: number) {
  return 'GH₵' + Number(n).toFixed(2)
}

export { formatDate, formatDateTime } from '@/lib/utils'

export function computeTotals(items: CartItem[], discountId?: string) {
  const subtotal = items.reduce((sum, i) => sum + i.price * i.qty, 0)
  const discounts = store.getDiscounts()
  const d = discountId ? discounts.find((x) => x.id === discountId) : undefined
  let discount = 0
  if (d) {
    discount = d.type === 'percent' ? subtotal * (d.value / 100) : Math.min(d.value, subtotal)
  }
  return { subtotal, discount, total: Math.max(0, subtotal - discount) }
}
