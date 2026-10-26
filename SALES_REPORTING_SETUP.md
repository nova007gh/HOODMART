# Kofi AI and sales SMS reporting

## Release safety

This feature is **not activated by installing source code alone**. Test on a
separate staging deployment/database before releasing. No historical sales,
authentication records, or checkout calculations are changed by migration 009.

1. Back up the target database, then apply
   `supabase/migrations/009_sales_reporting_sms.sql` in staging. It adds three
   server-only tables with RLS and a server-only, photo-free sales reporting
   view. Neither the tables nor the view grant browser access. Do not run a database reset.
2. Configure server-only environment variables in the deployment:
   - existing `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`;
   - `BMS_SMS_API_KEY`: the BMS Afrika/mNotify API key;
   - `BMS_SMS_SENDER`: an **approved** alphanumeric sender ID, at most 11 characters;
   - `CRON_SECRET`: a random private secret used by Vercel Cron.
   None of the last three variables may use a `NEXT_PUBLIC_` prefix.
3. Sign in as an administrator. In Settings → Admin SMS reports, enter the
   recipient's Ghana phone number and explicitly enable the desired reports.
   SMS is disabled by default. Do not use real recipients for automated tests.
4. Verify provider credit, sender approval, and one consented test SMS before
   enabling reports for normal operation. BMS charges apply.

## Reporting semantics

- Ghana timezone: Africa/Accra (UTC year-round).
- Daily close is **one snapshot per cashier, per store, per calendar day**.
  It is not a clock-in/clock-out attendance system or an overnight shift tracker.
- Staff must sync every device used for their sales before closing. A close
  does not delete sales, sign the cashier out, clear their cart, or disable POS.
  The original saved snapshot remains unchanged if sales are later added/synced.
- Preview and final totals are computed server-side from the verified user's
  email and store membership, not amounts or identities supplied by the browser.
- Monthly reports cover the **previous complete calendar month** and are queued
  at 8 AM on the 1st. Daily runs catch up a missed previous-month report after
  outages or late opt-in, and also drain never-attempted SMS jobs.
  Vercel's scheduler must be enabled; a browser tab need not remain open.
- All matching sales are paginated, not capped at the dashboard's 1,000 rows.
  Query failures or safety limits fail explicitly; they are never reported as 0.
- Revenue is the sum of recorded sale totals, not profit or a returns/void
  reconciliation. Best item is ranked by recorded quantity, ties by name.
- Kofi's sales/staff answers are deterministic analytics over synced records.
  They are not a new generative model. Inventory activity logs are not proof
  of attendance or misconduct. Existing local inventory tools remain separate.

## SMS safety and delivery status

Provider: `POST https://api.mnotify.com/api/sms/quick?key=...`, documented at
https://developer.bms.africa/. Only the regular SMS payload is used, **not OTP**.

Each daily/monthly report is ASCII within 160 GSM-basic characters. Store sales
amount/counts are preserved; the optional top-item text is shortened or omitted
if necessary. No concatenated SMS is requested. Separate daily and monthly
toggles plus a master switch are admin-only and checked again before sending.

Persistent unique report keys and compare-and-set queue claims protect against
double clicks, concurrent close requests, and repeated cron invocations.

`accepted` means BMS accepted a campaign, **not confirmed handset delivery**.
Timeouts, malformed responses, or interrupted sends become `unknown` (or stale
`sending` until the next cron). They are never automatically retried because
this API has no documented idempotency key. An admin must reconcile the stored
campaign ID/status with BMS before any manual resend. Disabling notifications
cannot recall a request already submitted to the provider.

## Local checks

```sh
npm run type-check
npm test
PUPPETEER_EXECUTABLE_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' node tests/mobile-bottom-nav.browser.cjs
```

Browser and reporting unit tests use fixtures; no real SMS or store records are
written. Do not include `.env.local`, `.env.restore`, backups, or production
data exports in deployment source uploads.
