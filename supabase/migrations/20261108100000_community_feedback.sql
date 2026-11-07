-- Community feedback (November 2026)
--   * reports: "this product's label changed", "this place closed"… sent to the admin inbox
--   * saved_products: products a signed-in user keeps ("my safe products")
--   * spot_feedback: yes/no questions answered by signed-in users about a place
--     (did you react? dedicated kitchen? did the staff know about celiac disease?)
--   * atmc_products.edition: the guide edition each row comes from, shown next to every verdict

-- Guide edition -----------------------------------------------------------------
alter table public.atmc_products add column if not exists edition date not null default date '2023-12-01';

-- Reports -----------------------------------------------------------------------
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('ATMC_PRODUCT', 'ASSOCIATION_PRODUCT', 'OFF_PRODUCT', 'SPOT', 'SCAN')),
  -- Row id for guide products and spots, barcode for Open Food Facts, empty for a scan
  target_id text not null default '' check (char_length(target_id) <= 80),
  -- What the reporter saw (product name, place name, verdict), kept even if the row changes later
  target_label text not null default '' check (char_length(target_label) <= 300),
  reason text not null check (reason in ('LABEL_CHANGED', 'WRONG_STATUS', 'CLOSED', 'NO_LONGER_GLUTEN_FREE', 'WRONG_INFO', 'REACTION', 'OTHER')),
  message text not null default '' check (char_length(message) <= 1000),
  reporter_id uuid references public.profiles (id) on delete set null,
  status text not null default 'OPEN' check (status in ('OPEN', 'RESOLVED', 'DISMISSED')),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists reports_status_idx on public.reports (status, created_at desc);
create index if not exists reports_target_idx on public.reports (target_type, target_id);
create index if not exists reports_reporter_idx on public.reports (reporter_id);
create index if not exists reports_resolved_by_idx on public.reports (resolved_by);

-- Written and read only by the API (secret key)
alter table public.reports enable row level security;

-- Saved products ----------------------------------------------------------------
create table if not exists public.saved_products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- "atmc:<uuid>", "assoc:<uuid>" or "off:<barcode or id>"
  product_key text not null check (char_length(product_key) <= 100),
  -- Name, brand, status and source when saved; the API refreshes the status of guide products
  snapshot jsonb not null default '{}'::jsonb check (jsonb_typeof(snapshot) = 'object' and pg_column_size(snapshot) <= 4000),
  created_at timestamptz not null default now(),
  unique (user_id, product_key)
);

alter table public.saved_products enable row level security;
create policy "Users read their saved products" on public.saved_products
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users delete their saved products" on public.saved_products
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Spot feedback -----------------------------------------------------------------
-- One answer per user and place (updated when they answer again). null = "don't know".
create table if not exists public.spot_feedback (
  id uuid primary key default gen_random_uuid(),
  spot_id uuid not null references public.spots (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  reacted boolean,
  dedicated_kitchen boolean,
  staff_aware boolean,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (spot_id, user_id)
);
create index if not exists spot_feedback_user_idx on public.spot_feedback (user_id);
create trigger spot_feedback_updated_at before update on public.spot_feedback
  for each row execute function public.set_updated_at();

-- Individual answers stay private; the API publishes only the totals per place
alter table public.spot_feedback enable row level security;
