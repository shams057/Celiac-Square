-- Celiac Square: initial schema (replaces the MongoDB collections)

create extension if not exists unaccent with schema extensions;

-- unaccent() is not immutable, which generated columns require; the dictionary is fixed, so this wrapper is safe
create or replace function public.f_unaccent(text)
returns text
language sql
immutable
parallel safe
strict
set search_path = ''
as $$ select extensions.unaccent('extensions.unaccent'::regdictionary, $1) $$;

-- array_to_string() is only stable; for text[] the result is fixed, so generated columns may use this
create or replace function public.f_join_text(text[])
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$ select coalesce(pg_catalog.array_to_string($1, ' '), '') $$;

-- Shared updated_at trigger
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ATMC 2023 guide ---------------------------------------------------------
create table public.atmc_products (
  id uuid primary key default gen_random_uuid(),
  category_fr text not null,
  category_ar text not null,
  category_slug text not null,
  status text not null check (status in ('ALLOWED', 'TO_CHECK', 'NOT_ALLOWED')),
  status_label_fr text not null,
  status_label_ar text not null,
  name text not null,
  name_fr text not null default '',
  brand text not null default '',
  items text[] not null default '{}',
  raw_text text not null,
  source text not null default 'Association Tunisienne de la Maladie Cœliaque (ATMC) - Guide 2023',
  search_text text generated always as (
    public.f_unaccent(lower(name || ' ' || name_fr || ' ' || brand || ' ' || category_fr || ' ' || category_ar))
  ) stored,
  created_at timestamptz not null default now()
);
create index atmc_products_category_status_idx on public.atmc_products (category_slug, status);

-- Association products (local staples) ----------------------------------
create table public.association_products (
  id uuid primary key default gen_random_uuid(),
  product_name_fr text not null,
  product_name_ar text not null,
  category text not null check (category in ('MEAT', 'OILS', 'FRUITS_VEG', 'DAIRY', 'GRAINS', 'SPICES', 'PASTRY', 'PROCESSED')),
  is_gluten_free boolean not null,
  status text not null default 'SAFE' check (status in ('SAFE', 'WARNING', 'UNSAFE', 'CROSS_CONTAMINATION_RISK', 'UNKNOWN')),
  brand text not null default 'Staple / Local Produce',
  barcode text not null default '',
  notes text not null,
  notes_ar text not null default '',
  official_doc_reference text not null default 'Guide Officiel de l''Association Tunisienne de la Cœliaque (ATC)',
  keywords text[] not null default '{}',
  search_text text generated always as (
    public.f_unaccent(lower(product_name_fr || ' ' || product_name_ar || ' ' || brand || ' ' || notes || ' ' || public.f_join_text(keywords)))
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index association_products_barcode_idx on public.association_products (barcode) where barcode <> '';
create trigger association_products_updated_at before update on public.association_products
  for each row execute function public.set_updated_at();

-- Map spots ---------------------------------------------------------------
create table public.spots (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null check (category in ('DOCTOR', 'CAFE', 'RESTAURANT', 'ARTISAN', 'SUPERMARKET')),
  lng double precision not null check (lng between -180 and 180),
  lat double precision not null check (lat between -90 and 90),
  city text not null,
  address text not null,
  phone text not null default '',
  is_verified boolean not null default false,
  speciality text not null default '',
  hours text not null default '',
  rating numeric(2, 1) not null default 4.8 check (rating between 1 and 5),
  review_count integer not null default 1 check (review_count >= 0),
  notes text not null default '',
  submitted_by text not null default 'Community / Admin',
  search_text text generated always as (
    public.f_unaccent(lower(name || ' ' || address || ' ' || speciality || ' ' || notes))
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index spots_city_category_idx on public.spots (city, category, is_verified);
create trigger spots_updated_at before update on public.spots
  for each row execute function public.set_updated_at();

-- Community proposals (admin inbox) ---------------------------------------
create table public.spot_proposals (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null check (category in ('DOCTOR', 'CAFE', 'RESTAURANT', 'ARTISAN', 'SUPERMARKET')),
  city text not null,
  address text not null,
  lng double precision check (lng between -180 and 180),
  lat double precision check (lat between -90 and 90),
  phone text not null default '',
  speciality text not null default '',
  hours text not null default '',
  notes text not null default '',
  submitted_by text not null default '',
  status text not null default 'PENDING' check (status in ('PENDING', 'APPROVED', 'REJECTED')),
  reviewed_at timestamptz,
  spot_id uuid references public.spots (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index spot_proposals_status_idx on public.spot_proposals (status, created_at desc);
create index spot_proposals_spot_id_idx on public.spot_proposals (spot_id);
create trigger spot_proposals_updated_at before update on public.spot_proposals
  for each row execute function public.set_updated_at();

-- Row level security ------------------------------------------------------
-- The Express API uses the secret key (bypasses RLS). These policies are what
-- the public publishable key may do, ready for direct client access later.
alter table public.atmc_products enable row level security;
alter table public.association_products enable row level security;
alter table public.spots enable row level security;
alter table public.spot_proposals enable row level security;

create policy "Guide is public" on public.atmc_products for select to anon, authenticated using (true);
create policy "Association products are public" on public.association_products for select to anon, authenticated using (true);
create policy "Spots are public" on public.spots for select to anon, authenticated using (true);
-- spot_proposals: no public policy; only the server (secret key) reads or writes them
