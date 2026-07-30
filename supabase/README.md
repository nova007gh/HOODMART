# EMDPOS Retail OS — Supabase Setup

## Overview

This project uses a **hybrid offline-first** architecture:

- **Local storage** (localStorage) — primary offline database, seeded from OSPOS MySQL dump
- **Supabase PostgreSQL** — remote sync target for multi-device online sync

## Schema

The PostgreSQL schema mirrors the app's TypeScript interfaces (`lib/store.ts`):

| Supabase Table | TS Interface | OSPOS Source |
|---|---|---|
| `products` | `Product` | `ospos_items` + `ospos_item_quantities` |
| `sales` | `Sale` | `ospos_sales` + `ospos_sales_items` + `ospos_sales_payments` |
| `customers` | `Customer` | `ospos_customers` + `ospos_people` |
| `employees` | `Employee` | `ospos_employees` + `ospos_people` |
| `suppliers` | `Supplier` | `ospos_suppliers` + `ospos_people` |
| `activities` | `Activity` | `ospos_inventory` |
| `discounts` | `Discount` | App-only |
| `branches` | `Branch` | `ospos_stock_locations` |
| `suspended` | `SuspendedSale` | `ospos_sales_suspended` |
| `app_config` | — | `ospos_app_config` |

## Setup Instructions

### 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Note your **Project URL** and **anon key** from Settings > API

### 2. Run Migrations

In the Supabase SQL Editor, run these files in order:

1. `supabase/migrations/001_create_schema.sql` — Creates all tables, indexes, RLS policies, and realtime publications
2. `supabase/migrations/002_seed_app_config.sql` — Seeds store configuration from OSPOS

### 3. Configure Environment Variables

Create or update `.env.local` in the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

### 4. How Sync Works

```
┌─────────────────────────────────────────────────┐
│  Client (Web / Desktop / Mobile)                 │
│                                                  │
│  localStorage ──→ Sync Engine ──→ Supabase       │
│  (offline-first)    (queue +      (PostgreSQL)   │
│                      push + pull)                 │
└─────────────────────────────────────────────────┘
```

- **Offline**: All reads/writes go to localStorage. Changes are queued in `emdpos_pending_sync`.
- **Online**: Queued changes are pushed to Supabase. Remote data is pulled to update localStorage.
- **Realtime**: Supabase realtime publications enable live updates across devices.

### 5. Sync Engine Details

The sync engine (`lib/sync.ts`) handles:

- `pushLocalChange(table, payload)` — Pushes a single record to Supabase (or queues if offline)
- `flushPending()` — Flushes all queued changes when back online
- `pullRemote()` — Pulls all remote data to localStorage
- `syncNow()` — Full sync: flush + pull
- `startSyncListeners()` — Listens for online/offline events

All synced records are stamped with `device_id` and `updated_at` for conflict resolution.
