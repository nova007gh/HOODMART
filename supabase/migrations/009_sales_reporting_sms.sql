-- Additive only: does not alter sales, checkout, existing accounts or policies.
-- Apply in staging first. SMS remains off until an admin explicitly enables it.
create table if not exists public.sms_report_settings (
  store_id uuid primary key references public.stores(id) on delete cascade,
  enabled boolean not null default false,
  daily_enabled boolean not null default true,
  monthly_enabled boolean not null default true,
  phone text not null default '',
  check (not enabled or phone ~ '^233[0-9]{9}$'),
  updated_at timestamptz not null default now()
);

create table if not exists public.cashier_day_closes (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  cashier_name text not null,
  business_date date not null,
  cutoff_at timestamptz not null,
  summary jsonb not null,
  created_at timestamptz not null default now(),
  unique (store_id, user_id, business_date)
);

create table if not exists public.sms_report_outbox (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  dedupe_key text not null,
  kind text not null check (kind in ('daily', 'monthly')),
  recipient text not null check (recipient ~ '^233[0-9]{9}$'),
  message text not null check (length(message) <= 160),
  status text not null default 'queued' check (status in ('queued', 'sending', 'accepted', 'unknown', 'rejected', 'canceled')),
  provider_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, dedupe_key)
);
create index if not exists sms_report_queue on public.sms_report_outbox(status, created_at);

-- All new data is accessed only by authenticated server endpoints that verify
-- the JWT and membership. Never expose service-role credentials to the browser.
alter table public.sms_report_settings enable row level security;
alter table public.cashier_day_closes enable row level security;
alter table public.sms_report_outbox enable row level security;
revoke all on public.sms_report_settings, public.cashier_day_closes, public.sms_report_outbox from public, anon, authenticated;
grant all on public.sms_report_settings, public.cashier_day_closes, public.sms_report_outbox to service_role;

-- Strip product photos and unrelated customer data inside PostgreSQL before
-- paging sales to the reporting server. Original sale rows are untouched.
create or replace view public.sales_report_source as
select s.id, s.store_id, s.timestamp, s.total, s.subtotal, s.discount,
  s."userEmail", s."userName", s."paymentMethod", s."branchId",
  coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', item->>'id', 'name', item->>'name',
      'qty', item->'qty', 'price', item->'price'
    ))
    from jsonb_array_elements(case when jsonb_typeof(s.items) = 'array' then s.items else '[]'::jsonb end) as item
  ), '[]'::jsonb) as items
from public.sales s;
revoke all on public.sales_report_source from public, anon, authenticated;
grant select on public.sales_report_source to service_role;
