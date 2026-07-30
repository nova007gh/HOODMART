-- EMDPOS Retail OS - Supabase PostgreSQL Schema
-- Converted from OSPOS MySQL dump (127_0_0_1 (4).sql)
-- This schema mirrors the app's TypeScript data models for online/offline sync.

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- PRODUCTS (from ospos_items + ospos_item_quantities)
-- ============================================
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  price NUMERIC(15,2) NOT NULL DEFAULT 0,
  cost NUMERIC(15,2) DEFAULT 0,
  barcode TEXT,
  stock INTEGER DEFAULT 0,
  "minStock" INTEGER DEFAULT 0,
  category TEXT,
  image TEXT,
  supplier TEXT,
  unit TEXT,
  description TEXT,
  "expiryDate" TEXT,
  "itemNumber" TEXT,
  "costPrice" TEXT,
  "unitPrice" TEXT,
  "receivingQuantity" INTEGER DEFAULT 1,
  "reorderLevel" INTEGER DEFAULT 0,
  "isSerialized" BOOLEAN DEFAULT FALSE,
  deleted BOOLEAN DEFAULT FALSE,
  "discountPercent" NUMERIC(15,2) DEFAULT 0,
  device_id TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- SALES (from ospos_sales + ospos_sales_items + ospos_sales_payments)
-- ============================================
CREATE TABLE IF NOT EXISTS sales (
  id TEXT PRIMARY KEY,
  items JSONB NOT NULL DEFAULT '[]',
  discount NUMERIC(15,2) DEFAULT 0,
  subtotal NUMERIC(15,2) DEFAULT 0,
  total NUMERIC(15,2) DEFAULT 0,
  timestamp TEXT,
  customer TEXT,
  "paymentMethod" TEXT,
  "branchId" TEXT,
  "userEmail" TEXT,
  "userName" TEXT,
  "saleTime" TEXT,
  "saleId" TEXT,
  "customerId" TEXT,
  "employeeId" TEXT,
  comment TEXT,
  "invoiceNumber" TEXT,
  "paymentType" TEXT,
  device_id TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- CUSTOMERS (from ospos_customers + ospos_people)
-- ============================================
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT DEFAULT '',
  purchases INTEGER DEFAULT 0,
  total NUMERIC(15,2) DEFAULT 0,
  "personId" TEXT,
  "firstName" TEXT,
  "lastName" TEXT,
  email TEXT,
  address TEXT,
  "companyName" TEXT,
  "accountNumber" TEXT,
  taxable INTEGER DEFAULT 1,
  deleted BOOLEAN DEFAULT FALSE,
  device_id TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- EMPLOYEES (from ospos_employees + ospos_people)
-- ============================================
CREATE TABLE IF NOT EXISTS employees (
  id TEXT PRIMARY KEY,
  "personId" TEXT,
  username TEXT,
  name TEXT NOT NULL,
  "firstName" TEXT,
  "lastName" TEXT,
  phone TEXT,
  email TEXT,
  role TEXT,
  permissions JSONB DEFAULT '[]',
  deleted BOOLEAN DEFAULT FALSE,
  device_id TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- SUPPLIERS (from ospos_suppliers + ospos_people)
-- ============================================
CREATE TABLE IF NOT EXISTS suppliers (
  id TEXT PRIMARY KEY,
  "personId" TEXT,
  name TEXT NOT NULL,
  "companyName" TEXT,
  "agencyName" TEXT,
  "accountNumber" TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  deleted BOOLEAN DEFAULT FALSE,
  device_id TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ACTIVITIES (from ospos_inventory)
-- ============================================
CREATE TABLE IF NOT EXISTS activities (
  id TEXT PRIMARY KEY,
  "itemId" TEXT,
  "user" TEXT,
  date TEXT,
  comment TEXT,
  location INTEGER DEFAULT 1,
  quantity INTEGER DEFAULT 0,
  device_id TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- DISCOUNTS
-- ============================================
CREATE TABLE IF NOT EXISTS discounts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'percent',
  value NUMERIC(15,2) DEFAULT 0,
  device_id TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- BRANCHES (from ospos_stock_locations)
-- ============================================
CREATE TABLE IF NOT EXISTS branches (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  location TEXT,
  status TEXT DEFAULT 'active',
  device_id TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- SUSPENDED SALES (from ospos_sales_suspended)
-- ============================================
CREATE TABLE IF NOT EXISTS suspended (
  id TEXT PRIMARY KEY,
  name TEXT,
  items JSONB NOT NULL DEFAULT '[]',
  "discountId" TEXT,
  totals JSONB DEFAULT '{"subtotal":0,"discount":0,"total":0}',
  timestamp TEXT,
  device_id TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- APP CONFIG (from ospos_app_config)
-- ============================================
CREATE TABLE IF NOT EXISTS app_config (
  key TEXT PRIMARY KEY,
  value TEXT
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_deleted ON products(deleted);
CREATE INDEX IF NOT EXISTS idx_sales_timestamp ON sales(timestamp);
CREATE INDEX IF NOT EXISTS idx_sales_employee ON sales("employeeId");
CREATE INDEX IF NOT EXISTS idx_sales_customer ON sales("customerId");
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
CREATE INDEX IF NOT EXISTS idx_employees_username ON employees(username);
CREATE INDEX IF NOT EXISTS idx_activities_item ON activities("itemId");
CREATE INDEX IF NOT EXISTS idx_activities_date ON activities(date);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE discounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE suspended ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users full access to all tables
CREATE POLICY "Authenticated users can manage products" ON products FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage sales" ON sales FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage customers" ON customers FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage employees" ON employees FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage suppliers" ON suppliers FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage activities" ON activities FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage discounts" ON discounts FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage branches" ON branches FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage suspended" ON suspended FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can read app_config" ON app_config FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================
-- REALTIME PUBLICATION (for live sync)
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE products;
ALTER PUBLICATION supabase_realtime ADD TABLE sales;
ALTER PUBLICATION supabase_realtime ADD TABLE customers;
ALTER PUBLICATION supabase_realtime ADD TABLE employees;
ALTER PUBLICATION supabase_realtime ADD TABLE suppliers;
ALTER PUBLICATION supabase_realtime ADD TABLE activities;
ALTER PUBLICATION supabase_realtime ADD TABLE discounts;
ALTER PUBLICATION supabase_realtime ADD TABLE branches;
ALTER PUBLICATION supabase_realtime ADD TABLE suspended;
