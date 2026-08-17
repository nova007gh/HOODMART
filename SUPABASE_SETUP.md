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

## 5. Import HOODMART's existing POS data

HOODMART is migrating from an OSPOS (Open Source Point of Sale) MySQL database.
The import script `scripts/import-ospos.ts` parses the MySQL dump and loads
everything into Supabase, tagged with the HOODMART store_id for tenant isolation.

### Prerequisites

- Migrations 001–007 already run (step 3 above)
- `.env.local` has `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
- The HOODMART owner has registered an account via the app (this creates the
  store row via the signup trigger). If you haven't registered yet, do it now:
  - `npm run dev`, open http://localhost:3000, click **Get Started**, register
  - Confirm the user in Supabase → Authentication → Users (or disable email
    confirmation in Auth settings for testing)

### Find the store_id

In Supabase **SQL Editor** run:

```sql
SELECT id, name, owner_email FROM stores;
```

Copy the `id` (a UUID like `a1b2c3d4-...`).

### Dry run (recommended first)

```bash
npx tsx scripts/import-ospos.ts /path/to/hoodmart.sql <store-id> --dry-run
```

This parses the dump, transforms every table, and prints row counts + a sample
product and sale — without inserting anything. Verify the counts match
expectations.

### Live import

```bash
npx tsx scripts/import-ospos.ts /path/to/hoodmart.sql <store-id>
```

The script inserts in this order (dependencies first):
1. `app_config` (store settings: currency, company name, etc.)
2. `branches` (stock locations)
3. `suppliers`
4. `customers`
5. `employees`
6. `products` (with stock from item_quantities)
7. `activities` (inventory history)
8. `gift_cards`
9. `sales` (with items + payments embedded as JSONB)

All rows are upserted (`onConflict: 'id'`), so re-running is safe and will
update rather than duplicate.

### What gets imported

| OSPOS MySQL table | HOODMART Supabase table | Notes |
|---|---|---|
| ospos_items + ospos_item_quantities | products | stock summed across locations |
| ospos_sales + ospos_sales_items + ospos_sales_payments | sales | items embedded as JSONB array |
| ospos_customers + ospos_people | customers | name joined from people |
| ospos_employees + ospos_people | employees | admin gets full permissions |
| ospos_suppliers + ospos_people | suppliers | |
| ospos_inventory | activities | stock movement history |
| ospos_stock_locations | branches | |
| ospos_giftcards | gift_cards | |
| ospos_app_config | app_config | currency, company, tax settings |

### Verify after import

- Log in as the HOODMART owner → Dashboard should show sales totals
- Products page → 551 products with stock levels
- Sales page → 994 historical sales
- Reports → revenue charts populated from June 2026 onward

## 6. Verify

- `npm run dev` and try logging in
- Check Supabase Table Editor — data should be present
- Create the first platform-owner account per `007_platform_admins.sql`

## 7. Eganow billing (optional, for subscriptions)

Get credentials from https://docs.sandbox.egacoreapi.com/ (sandbox first):

- `EGANOW_SECRET_USERNAME`
- `EGANOW_SECRET_PASSWORD`
- `EGANOW_X_AUTH`

Paste into `.env.local`. Switch `EGANOW_BASE_URL` to production when going live.
