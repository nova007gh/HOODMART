import * as sync from './sync'
import {
  sqlProducts,
  sqlActivities,
  sqlCustomers,
  sqlEmployees,
  sqlSuppliers,
  sqlSales,
} from './seed-data'

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

export const KEYS = {
  PRODUCTS: 'emdpos_v2_products',
  DISCOUNTS: 'emdpos_v2_discounts',
  SALES: 'emdpos_v2_sales',
  CUSTOMERS: 'emdpos_v2_customers',
  SUSPENDED: 'emdpos_v2_suspended',
  BRANCHES: 'emdpos_v2_branches',
  ACTIVITIES: 'emdpos_v2_activities',
  EMPLOYEES: 'emdpos_v2_employees',
  SUPPLIERS: 'emdpos_v2_suppliers',
}

const SEED_KEY = 'emdpos_v2_seeded'

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
  localStorage.setItem(k, JSON.stringify(v))
}

function uuid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

function seedIfNeeded() {
  if (typeof window === 'undefined') return
  if (get(SEED_KEY, false)) return
  set(SEED_KEY, true)
  set(KEYS.PRODUCTS, sqlProducts)
  set(KEYS.ACTIVITIES, sqlActivities)
  set(KEYS.CUSTOMERS, sqlCustomers)
  set(KEYS.EMPLOYEES, sqlEmployees)
  set(KEYS.SUPPLIERS, sqlSuppliers)
  set(KEYS.SALES, sqlSales)
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
