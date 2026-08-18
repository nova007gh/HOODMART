-- HOODMART Retail OS — Team activity notifications + profile pictures
-- Safe to run on a live database: everything is additive and idempotent.

-- ============================================
-- 1. PROFILE PICTURES
-- ============================================
ALTER TABLE employees ADD COLUMN IF NOT EXISTS avatar TEXT;

-- ============================================
-- 2. ACTIVITY NOTIFICATIONS
-- ============================================
CREATE TABLE IF NOT EXISTS notifications (
  id           TEXT PRIMARY KEY,
  store_id     UUID REFERENCES stores(id) ON DELETE CASCADE,
  type         TEXT NOT NULL,
  title        TEXT NOT NULL,
  message      TEXT,
  "actorName"  TEXT,
  "actorEmail" TEXT,
  amount       NUMERIC,
  href         TEXT,
  read         BOOLEAN DEFAULT FALSE,
  timestamp    TIMESTAMPTZ DEFAULT NOW(),
  device_id    TEXT,
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS notifications_store_id_idx  ON notifications (store_id);
CREATE INDEX IF NOT EXISTS notifications_timestamp_idx ON notifications (timestamp DESC);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Same pattern the other tenant tables use
DROP POLICY IF EXISTS "Users can CRUD own store notifications" ON notifications;
CREATE POLICY "Users can CRUD own store notifications" ON notifications
  FOR ALL TO authenticated
  USING (store_id = get_user_store_id())
  WITH CHECK (store_id = get_user_store_id());

SELECT 'Notifications table + avatar column ready' AS status;
