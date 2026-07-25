import { User } from '@/lib/auth'

export type AIPermission =
  | 'ai.use'
  | 'ai.view_sales'
  | 'ai.view_profit'
  | 'ai.view_products'
  | 'ai.view_inventory'
  | 'ai.view_customers'
  | 'ai.view_customer_contact_details'
  | 'ai.view_staff'
  | 'ai.view_suppliers'
  | 'ai.view_expenses'
  | 'ai.view_audit_data'
  | 'ai.export_results'
  | 'ai.execute_actions'

const ROLE_PERMISSIONS: Record<string, AIPermission[]> = {
  admin: [
    'ai.use',
    'ai.view_sales',
    'ai.view_profit',
    'ai.view_products',
    'ai.view_inventory',
    'ai.view_customers',
    'ai.view_customer_contact_details',
    'ai.view_staff',
    'ai.view_suppliers',
    'ai.view_expenses',
    'ai.view_audit_data',
    'ai.export_results',
    'ai.execute_actions',
  ],
  manager: [
    'ai.use',
    'ai.view_sales',
    'ai.view_profit',
    'ai.view_products',
    'ai.view_inventory',
    'ai.view_customers',
    'ai.view_customer_contact_details',
    'ai.view_staff',
  ],
  cashier: [
    'ai.use',
    'ai.view_sales',
  ],
  salesgirl: [
    'ai.use',
    'ai.view_sales',
  ],
  inventory: [],
}

export function getPermissions(role: User['role']): AIPermission[] {
  return ROLE_PERMISSIONS[role] || []
}

export function hasPermission(role: User['role'], permission: AIPermission): boolean {
  return getPermissions(role).includes(permission)
}

export function canAccessAI(role: User['role']): boolean {
  return hasPermission(role, 'ai.use')
}

export const PERMISSION_LABELS: Record<AIPermission, string> = {
  'ai.use': 'Use AI Assistant',
  'ai.view_sales': 'View Sales Data',
  'ai.view_profit': 'View Profit Data',
  'ai.view_products': 'View Product Data',
  'ai.view_inventory': 'View Inventory Data',
  'ai.view_customers': 'View Customer Data',
  'ai.view_customer_contact_details': 'View Customer Contact Details',
  'ai.view_staff': 'View Staff Performance',
  'ai.view_suppliers': 'View Supplier Data',
  'ai.view_expenses': 'View Expense Data',
  'ai.view_audit_data': 'View Audit Logs',
  'ai.export_results': 'Export AI Results',
  'ai.execute_actions': 'Execute AI Actions',
}
