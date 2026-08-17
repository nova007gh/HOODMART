# HOODMART Retail OS — Supabase Setup Checklist

This client gets a **fresh Supabase project** for clean tenant isolation.

## 1. Create the Supabase project

1. Go to https://supabase.com → New Project
2. Name: `hoodmart-retail-os` (or similar)
3. Set a strong DB password (save it somewhere safe)
4. Region: pick the one closest to the client's users
5. Wait for provisioning to finish

## 2. Grab credentials

In the new project: **Settings → API**

- `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
- `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (keep secret!)

Paste these into `.env.local`.

## 3. Run migrations in order

Open **SQL Editor** in Supabase and run these files from `supabase/migrations/` in order:

1. `001_create_schema.sql` — core tables, indexes, RLS, realtime
2. `002_seed_app_config.sql` — store config seed
3. `003_multi_tenancy.sql` — store_id isolation + Supabase Auth
4. `004_gift_cards_expenses_quotations.sql` — extra modules
5. `005_employee_auth.sql` — employee login
6. `006_subscriptions.sql` — subscription/trial gating
7. `007_platform_admins.sql` — platform-owner console

Run each file's contents as a single query. Check the output for `Success`.

## 4. Configure Auth

In Supabase Dashboard → **Authentication → Providers**:

- Enable **Email** provider
- Set the site URL to your Vercel domain (after deploy): `https://hoodmart.vercel.app`
- Add `http://localhost:3000` to redirect URLs for local dev

## 5. Verify

- `npm run dev` and try logging in
- Check Supabase Table Editor — you should see all tables empty
- Create the first platform-owner account per `007_platform_admins.sql`

## 6. Eganow billing (optional, for subscriptions)

Get credentials from https://docs.sandbox.egacoreapi.com/ (sandbox first):

- `EGANOW_SECRET_USERNAME`
- `EGANOW_SECRET_PASSWORD`
- `EGANOW_X_AUTH`

Paste into `.env.local`. Switch `EGANOW_BASE_URL` to production when going live.
