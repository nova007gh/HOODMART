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
