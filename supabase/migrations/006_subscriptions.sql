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
