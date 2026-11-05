-- Celiac Square: fixes from the November 2026 audit
--   * no invented ratings on map spots
--   * who verified a spot, and when
--   * length limits on free-text columns (same limits as the API, see backend/src/utils/http.js)
--   * admin audit log

-- Ratings ------------------------------------------------------------------
-- There is no review system: every rating so far was a default (4.8 from "1 review") or seed data.
alter table public.spots alter column rating drop not null;
alter table public.spots alter column rating drop default;
alter table public.spots alter column review_count set default 0;

-- Verification stamp -------------------------------------------------------
alter table public.spots add column if not exists verified_at timestamptz;
alter table public.spots add column if not exists verified_by uuid references public.profiles (id) on delete set null;
create index if not exists spots_verified_by_idx on public.spots (verified_by);

-- One update for both, because it fires the updated_at trigger: SET reads the row as it was,
-- so spots verified before this migration keep their last update date as verification date
update public.spots
set rating = null,
    review_count = 0,
    verified_at = case when is_verified and verified_at is null then updated_at else verified_at end;

-- Length limits --------------------------------------------------------------
-- NOT VALID: enforced for every new or updated row, without failing on older rows.
alter table public.spots
  add constraint spots_text_lengths check (
    char_length(name) <= 120 and char_length(city) <= 80 and char_length(address) <= 200 and char_length(phone) <= 30
    and char_length(speciality) <= 120 and char_length(hours) <= 120 and char_length(notes) <= 1000
    and char_length(submitted_by) <= 80
  ) not valid;

alter table public.spot_proposals
  add constraint spot_proposals_text_lengths check (
    char_length(name) <= 120 and char_length(city) <= 80 and char_length(address) <= 200 and char_length(phone) <= 30
    and char_length(speciality) <= 120 and char_length(hours) <= 120 and char_length(notes) <= 1000
    and char_length(submitted_by) <= 80
  ) not valid;

alter table public.stores
  add constraint stores_text_lengths check (
    char_length(name) <= 120 and char_length(city) <= 80 and char_length(address) <= 200 and char_length(phone) <= 30
    and char_length(description) <= 2000
  ) not valid;

alter table public.seller_applications
  add constraint seller_applications_text_lengths check (
    char_length(business_name) <= 120 and char_length(city) <= 80 and char_length(address) <= 200
    and char_length(phone) <= 30 and char_length(description) <= 2000
  ) not valid;

alter table public.market_products
  add constraint market_products_text_lengths check (char_length(title) <= 120 and char_length(description) <= 2000) not valid;

alter table public.profiles
  add constraint profiles_text_lengths check (char_length(full_name) <= 100) not valid;

-- Admin audit log ------------------------------------------------------------
create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles (id) on delete set null,
  actor_email text not null default '',
  action text not null,
  target_id text not null default '',
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists admin_audit_log_created_idx on public.admin_audit_log (created_at desc);
create index if not exists admin_audit_log_actor_idx on public.admin_audit_log (actor_id);

-- Written and read only by the API (secret key): no public policy
alter table public.admin_audit_log enable row level security;
