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
