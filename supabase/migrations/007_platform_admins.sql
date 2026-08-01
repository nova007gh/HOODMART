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
