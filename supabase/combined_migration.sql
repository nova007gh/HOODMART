-- ============================================================
-- HOODMART Retail OS — Combined Migration (all 7 in one file)
-- Run this entire script in Supabase SQL Editor in one paste.
-- ============================================================


-- ============================================================
-- BEGIN: 001_create_schema.sql
-- ============================================================

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

-- END: 001_create_schema.sql


-- ============================================================
-- BEGIN: 002_seed_app_config.sql
-- ============================================================

-- EMDPOS Retail OS - App Config Seed Data
-- From ospos_app_config in the OSPOS MySQL dump

INSERT INTO app_config (key, value) VALUES
  ('address', 'MADINA ESTATE'),
  ('barcode_content', 'id'),
  ('barcode_first_row', 'category'),
  ('barcode_font', 'Arial'),
  ('barcode_font_size', '10'),
  ('barcode_generate_if_empty', '0'),
  ('barcode_height', '50'),
  ('barcode_num_in_row', '2'),
  ('barcode_page_cellspacing', '20'),
  ('barcode_page_width', '100'),
  ('barcode_quality', '100'),
  ('barcode_second_row', 'item_code'),
  ('barcode_third_row', 'unit_price'),
  ('barcode_type', 'Code39'),
  ('barcode_width', '250'),
  ('company', 'HOODMARD'),
  ('company_logo', ''),
  ('currency_side', '0'),
  ('currency_symbol', 'GHS'),
  ('dateformat', 'm/d/Y'),
  ('decimal_point', '.'),
  ('default_sales_discount', '0'),
  ('default_tax_1_name', 'Sales Tax'),
  ('default_tax_1_rate', ''),
  ('default_tax_2_name', 'Sales Tax 2'),
  ('default_tax_2_rate', ''),
  ('default_tax_rate', '8'),
  ('email', 'hoodmart@gmail.com'),
  ('fax', ''),
  ('invoice_default_comments', 'This is a default comment'),
  ('invoice_email_message', 'Dear $CU, In attachment the receipt for sale $INV'),
  ('language', 'en'),
  ('lines_per_page', '25'),
  ('phone', '0554092198'),
  ('print_bottom_margin', '0'),
  ('print_footer', '0'),
  ('print_header', '0'),
  ('print_top_margin', '0'),
  ('receipt_template', 'receipt_default'),
  ('recv_invoice_format', 'CO'),
  ('return_policy', 'Returns must be made within 30 days of purchase.'),
  ('tax_included', '0'),
  ('thousands_separator', ','),
  ('timezone', 'Africa/Accra')
ON CONFLICT (key) DO NOTHING;

-- END: 002_seed_app_config.sql


-- ============================================================
-- BEGIN: 003_multi_tenancy.sql
-- ============================================================

-- EMDPOS Retail OS - Multi-Tenancy Migration
-- Adds store_id to all tables for multi-tenant isolation
-- Run AFTER 001_create_schema.sql

-- ============================================
-- STORES TABLE (tenant registry)
-- ============================================
CREATE TABLE IF NOT EXISTS stores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  owner_email TEXT NOT NULL,
  plan TEXT DEFAULT 'free',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- STORE MEMBERS (links auth users to stores)
-- ============================================
CREATE TABLE IF NOT EXISTS store_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'admin',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(store_id, user_id)
);

-- ============================================
-- ADD store_id TO ALL DATA TABLES
-- ============================================
ALTER TABLE products ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id) ON DELETE CASCADE;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id) ON DELETE CASCADE;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id) ON DELETE CASCADE;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id) ON DELETE CASCADE;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id) ON DELETE CASCADE;
ALTER TABLE activities ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id) ON DELETE CASCADE;
ALTER TABLE discounts ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id) ON DELETE CASCADE;
ALTER TABLE branches ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id) ON DELETE CASCADE;
ALTER TABLE suspended ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id) ON DELETE CASCADE;

-- ============================================
-- INDEXES FOR store_id
-- ============================================
CREATE INDEX IF NOT EXISTS idx_products_store ON products(store_id);
CREATE INDEX IF NOT EXISTS idx_sales_store ON sales(store_id);
CREATE INDEX IF NOT EXISTS idx_customers_store ON customers(store_id);
CREATE INDEX IF NOT EXISTS idx_employees_store ON employees(store_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_store ON suppliers(store_id);
CREATE INDEX IF NOT EXISTS idx_activities_store ON activities(store_id);
CREATE INDEX IF NOT EXISTS idx_discounts_store ON discounts(store_id);
CREATE INDEX IF NOT EXISTS idx_branches_store ON branches(store_id);
CREATE INDEX IF NOT EXISTS idx_suspended_store ON suspended(store_id);
CREATE INDEX IF NOT EXISTS idx_store_members_store ON store_members(store_id);
CREATE INDEX IF NOT EXISTS idx_store_members_user ON store_members(user_id);

-- ============================================
-- DROP OLD RLS POLICIES (broad access)
-- ============================================
DROP POLICY IF EXISTS "Authenticated users can manage products" ON products;
DROP POLICY IF EXISTS "Authenticated users can manage sales" ON sales;
DROP POLICY IF EXISTS "Authenticated users can manage customers" ON customers;
DROP POLICY IF EXISTS "Authenticated users can manage employees" ON employees;
DROP POLICY IF EXISTS "Authenticated users can manage suppliers" ON suppliers;
DROP POLICY IF EXISTS "Authenticated users can manage activities" ON activities;
DROP POLICY IF EXISTS "Authenticated users can manage discounts" ON discounts;
DROP POLICY IF EXISTS "Authenticated users can manage branches" ON branches;
DROP POLICY IF EXISTS "Authenticated users can manage suspended" ON suspended;
DROP POLICY IF EXISTS "Authenticated users can read app_config" ON app_config;

-- ============================================
-- NEW RLS POLICIES (tenant-isolated)
-- Users can only access data for stores they belong to
-- ============================================

-- Helper function: get the user's store_id
CREATE OR REPLACE FUNCTION get_user_store_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT store_id FROM store_members WHERE user_id = auth.uid() LIMIT 1
$$;

-- Products: tenant-isolated
CREATE POLICY "Users can CRUD own store products" ON products
  FOR ALL TO authenticated
  USING (store_id = get_user_store_id())
  WITH CHECK (store_id = get_user_store_id());

-- Sales: tenant-isolated
CREATE POLICY "Users can CRUD own store sales" ON sales
  FOR ALL TO authenticated
  USING (store_id = get_user_store_id())
  WITH CHECK (store_id = get_user_store_id());

-- Customers: tenant-isolated
CREATE POLICY "Users can CRUD own store customers" ON customers
  FOR ALL TO authenticated
  USING (store_id = get_user_store_id())
  WITH CHECK (store_id = get_user_store_id());

-- Employees: tenant-isolated
CREATE POLICY "Users can CRUD own store employees" ON employees
  FOR ALL TO authenticated
  USING (store_id = get_user_store_id())
  WITH CHECK (store_id = get_user_store_id());

-- Suppliers: tenant-isolated
CREATE POLICY "Users can CRUD own store suppliers" ON suppliers
  FOR ALL TO authenticated
  USING (store_id = get_user_store_id())
  WITH CHECK (store_id = get_user_store_id());

-- Activities: tenant-isolated
CREATE POLICY "Users can CRUD own store activities" ON activities
  FOR ALL TO authenticated
  USING (store_id = get_user_store_id())
  WITH CHECK (store_id = get_user_store_id());

-- Discounts: tenant-isolated
CREATE POLICY "Users can CRUD own store discounts" ON discounts
  FOR ALL TO authenticated
  USING (store_id = get_user_store_id())
  WITH CHECK (store_id = get_user_store_id());

-- Branches: tenant-isolated
CREATE POLICY "Users can CRUD own store branches" ON branches
  FOR ALL TO authenticated
  USING (store_id = get_user_store_id())
  WITH CHECK (store_id = get_user_store_id());

-- Suspended: tenant-isolated
CREATE POLICY "Users can CRUD own store suspended" ON suspended
  FOR ALL TO authenticated
  USING (store_id = get_user_store_id())
  WITH CHECK (store_id = get_user_store_id());

-- Stores: users can read their own store
CREATE POLICY "Users can read own store" ON stores
  FOR SELECT TO authenticated
  USING (id = get_user_store_id());

-- Store members: users can read members of their store
CREATE POLICY "Users can read own store members" ON store_members
  FOR SELECT TO authenticated
  USING (store_id = get_user_store_id());

-- App config: readable by all authenticated users (shared settings)
CREATE POLICY "Authenticated users can read app_config" ON app_config
  FOR SELECT TO authenticated
  USING (true);

-- ============================================
-- ENABLE RLS ON NEW TABLES
-- ============================================
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_members ENABLE ROW LEVEL SECURITY;

-- ============================================
-- TRIGGER: Auto-create store + membership on signup
-- ============================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_store_id UUID;
BEGIN
  -- Create a new store for this user
  INSERT INTO stores (name, owner_email)
  VALUES (COALESCE(NEW.raw_user_meta_data->>'store_name', NEW.email), NEW.email)
  RETURNING id INTO new_store_id;

  -- Link the user to the store as admin
  INSERT INTO store_members (store_id, user_id, role)
  VALUES (new_store_id, NEW.id, 'admin');

  RETURN NEW;
END;
$$;

-- Drop existing trigger if any, then create
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- END: 003_multi_tenancy.sql


-- ============================================================
-- BEGIN: 004_gift_cards_expenses_quotations.sql
-- ============================================================

-- EMDPOS Retail OS - Additional Features: Gift Cards, Expenses, Quotations

-- ============================================
-- GIFT CARDS
-- ============================================
CREATE TABLE IF NOT EXISTS gift_cards (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  balance NUMERIC(15,2) DEFAULT 0,
  "initialBalance" NUMERIC(15,2) DEFAULT 0,
  status TEXT DEFAULT 'active',
  "customerName" TEXT,
  "customerEmail" TEXT,
  "expiryDate" TEXT,
  notes TEXT,
  "createdAt" TEXT,
  transactions JSONB DEFAULT '[]',
  store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
  device_id TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- EXPENSES
-- ============================================
CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY,
  description TEXT NOT NULL,
  amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  category TEXT DEFAULT 'Other',
  date TEXT,
  "paymentMethod" TEXT,
  vendor TEXT,
  notes TEXT,
  store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
  device_id TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- QUOTATIONS
-- ============================================
CREATE TABLE IF NOT EXISTS quotations (
  id TEXT PRIMARY KEY,
  "quoteNumber" TEXT NOT NULL,
  "customerName" TEXT NOT NULL,
  "customerEmail" TEXT,
  "customerPhone" TEXT,
  items JSONB NOT NULL DEFAULT '[]',
  subtotal NUMERIC(15,2) DEFAULT 0,
  discount NUMERIC(15,2) DEFAULT 0,
  total NUMERIC(15,2) DEFAULT 0,
  status TEXT DEFAULT 'draft',
  "validUntil" TEXT,
  notes TEXT,
  "createdAt" TEXT,
  store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
  device_id TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_gift_cards_code ON gift_cards(code);
CREATE INDEX IF NOT EXISTS idx_gift_cards_store ON gift_cards(store_id);
CREATE INDEX IF NOT EXISTS idx_expenses_store ON expenses(store_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);
CREATE INDEX IF NOT EXISTS idx_quotations_store ON quotations(store_id);
CREATE INDEX IF NOT EXISTS idx_quotations_status ON quotations(status);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE gift_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own store gift_cards" ON gift_cards
  FOR ALL TO authenticated
  USING (store_id = get_user_store_id())
  WITH CHECK (store_id = get_user_store_id());

CREATE POLICY "Users can CRUD own store expenses" ON expenses
  FOR ALL TO authenticated
  USING (store_id = get_user_store_id())
  WITH CHECK (store_id = get_user_store_id());

CREATE POLICY "Users can CRUD own store quotations" ON quotations
  FOR ALL TO authenticated
  USING (store_id = get_user_store_id())
  WITH CHECK (store_id = get_user_store_id());

-- ============================================
-- REALTIME PUBLICATION
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE gift_cards;
ALTER PUBLICATION supabase_realtime ADD TABLE expenses;
ALTER PUBLICATION supabase_realtime ADD TABLE quotations;

-- END: 004_gift_cards_expenses_quotations.sql


-- ============================================================
-- BEGIN: 005_employee_auth.sql
-- ============================================================

-- EMDPOS Retail OS - Employee Auth Support
-- Updates the signup trigger to handle employee accounts
-- Employees are added to an existing store instead of creating a new one

-- ============================================
-- ADD permissions COLUMN TO store_members
-- ============================================
ALTER TABLE store_members ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '[]';

-- ============================================
-- UPDATE TRIGGER: Handle employee vs admin signups
-- ============================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_store_id UUID;
  is_employee BOOLEAN;
  existing_store_id UUID;
  emp_role TEXT;
  emp_permissions JSONB;
BEGIN
  -- Check if this is an employee being added to an existing store
  is_employee := COALESCE((NEW.raw_user_meta_data->>'is_employee')::BOOLEAN, FALSE);
  
  IF is_employee THEN
    -- Get the store_id from user_metadata
    existing_store_id := (NEW.raw_user_meta_data->>'store_id')::UUID;
    emp_role := COALESCE(NEW.raw_user_meta_data->>'role', 'cashier');
    emp_permissions := COALESCE(NEW.raw_user_meta_data->'permissions', '[]'::jsonb);
    
    -- Add the employee to the existing store
    INSERT INTO store_members (store_id, user_id, role, permissions)
    VALUES (existing_store_id, NEW.id, emp_role, emp_permissions)
    ON CONFLICT (store_id, user_id) DO UPDATE SET role = EXCLUDED.role, permissions = EXCLUDED.permissions;
    
    RETURN NEW;
  END IF;
  
  -- Default: Create a new store for this user (admin/owner signup)
  INSERT INTO stores (name, owner_email)
  VALUES (COALESCE(NEW.raw_user_meta_data->>'store_name', NEW.email), NEW.email)
  RETURNING id INTO new_store_id;

  -- Link the user to the store as admin
  INSERT INTO store_members (store_id, user_id, role, permissions)
  VALUES (new_store_id, NEW.id, 'admin', '["*"]'::jsonb);

  RETURN NEW;
END;
$$;

-- END: 005_employee_auth.sql


-- ============================================================
-- BEGIN: 006_subscriptions.sql
-- ============================================================

-- EMDPOS Retail OS - Subscription Billing Migration
-- Adds subscription/trial tracking to stores + a payments ledger.
-- Run AFTER 005_employee_auth.sql

-- ============================================
-- SUBSCRIPTION FIELDS ON stores
-- ============================================
ALTER TABLE stores ADD COLUMN IF NOT EXISTS subscription_status TEXT NOT NULL DEFAULT 'trialing';
-- One of: 'trialing' | 'active' | 'past_due' | 'expired' | 'canceled'

ALTER TABLE stores ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '14 days');

ALTER TABLE stores ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ;
-- NULL until the first successful payment; set to the paid-through date after each renewal.

ALTER TABLE stores ADD COLUMN IF NOT EXISTS subscription_provider TEXT;
-- e.g. 'eganow', 'paystack', 'manual'

-- ============================================
-- PAYMENTS LEDGER
-- ============================================
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'eganow',
  provider_reference TEXT,
  transaction_id TEXT NOT NULL UNIQUE,
  amount NUMERIC(12,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'GHS',
  plan TEXT NOT NULL DEFAULT 'pro',
  status TEXT NOT NULL DEFAULT 'pending',
  -- One of: 'pending' | 'successful' | 'failed'
  raw_payload JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_store ON payments(store_id);
CREATE INDEX IF NOT EXISTS idx_payments_transaction_id ON payments(transaction_id);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own store payments" ON payments;
CREATE POLICY "Users can read own store payments" ON payments
  FOR SELECT TO authenticated
  USING (store_id = get_user_store_id());

-- Payments are written exclusively by server-side code using the service role key
-- (webhook + payment-initiation API routes), so no INSERT/UPDATE policy is granted
-- to the 'authenticated' role here.

-- END: 006_subscriptions.sql


-- ============================================================
-- BEGIN: 007_platform_admins.sql
-- ============================================================

-- EMDPOS Retail OS - Platform Admin (Software Owner Console) Migration
-- Adds a whitelist table identifying which Supabase Auth users are allowed
-- to access the internal /owner console (separate from tenant store accounts).
-- Run AFTER 006_subscriptions.sql

CREATE TABLE IF NOT EXISTS platform_admins (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS enabled with NO policies defined: this table is only ever read/written
-- via the Supabase service-role key from trusted server-side API routes
-- (see lib/owner-auth.ts). No client role (anon/authenticated) can query it.
ALTER TABLE platform_admins ENABLE ROW LEVEL SECURITY;

-- ============================================
-- HOW TO ADD YOURSELF AS A SOFTWARE OWNER
-- ============================================
-- 1. Sign up for a normal account at /register (or /owner/login won't work
--    until you exist as an auth user — sign up once via the regular app,
--    or create the user directly in the Supabase Dashboard > Authentication).
-- 2. Find your user id:
--      SELECT id, email FROM auth.users WHERE email = 'you@example.com';
-- 3. Whitelist yourself as a platform admin:
--      INSERT INTO platform_admins (user_id, email)
--      VALUES ('<your-user-id>', 'you@example.com');
-- 4. Log in at /owner/login using that same email/password.

-- END: 007_platform_admins.sql

