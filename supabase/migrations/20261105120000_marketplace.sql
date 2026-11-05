-- Celiac Square: accounts (admin / seller / client) and the gluten-free marketplace

-- Profiles: one per Supabase Auth user, carries the role ------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text not null default '',
  role text not null default 'CLIENT' check (role in ('ADMIN', 'SELLER', 'CLIENT')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profiles_role_idx on public.profiles (role);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Every new account starts as a client
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, coalesce(new.email, ''), coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Stores: a seller's shop on the marketplace ------------------------------
create table public.stores (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references public.profiles (id) on delete cascade,
  name text not null,
  type text not null check (type in ('RESTAURANT', 'BAKERY', 'CAFE', 'ARTISAN')),
  city text not null default '',
  address text not null default '',
  phone text not null default '',
  description text not null default '',
  logo_url text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index stores_type_idx on public.stores (type, is_active);
create trigger stores_updated_at before update on public.stores
  for each row execute function public.set_updated_at();

-- Requests from clients who want to sell (admin inbox) --------------------
create table public.seller_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  business_name text not null,
  type text not null check (type in ('RESTAURANT', 'BAKERY', 'CAFE', 'ARTISAN')),
  city text not null,
  address text not null default '',
  phone text not null,
  description text not null default '',
  status text not null default 'PENDING' check (status in ('PENDING', 'APPROVED', 'REJECTED')),
  reviewed_at timestamptz,
  store_id uuid references public.stores (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index seller_applications_status_idx on public.seller_applications (status, created_at desc);
create index seller_applications_user_idx on public.seller_applications (user_id);
create index seller_applications_store_idx on public.seller_applications (store_id);
-- One open request per account
create unique index seller_applications_one_pending on public.seller_applications (user_id) where status = 'PENDING';
create trigger seller_applications_updated_at before update on public.seller_applications
  for each row execute function public.set_updated_at();

-- Products a store sells --------------------------------------------------
create table public.market_products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  title text not null,
  description text not null default '',
  price numeric(10, 3) check (price is null or price >= 0),
  images text[] not null default '{}',
  is_available boolean not null default true,
  search_text text generated always as (public.f_unaccent(lower(title || ' ' || description))) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index market_products_store_idx on public.market_products (store_id, created_at desc);
create trigger market_products_updated_at before update on public.market_products
  for each row execute function public.set_updated_at();

-- Row level security ------------------------------------------------------
-- As for the other tables, the Express API uses the secret key. Nothing here is
-- public: the marketplace is for signed-in users and goes through the API.
alter table public.profiles enable row level security;
alter table public.stores enable row level security;
alter table public.seller_applications enable row level security;
alter table public.market_products enable row level security;

-- Product photos: public bucket, written only by the API ------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('marketplace', 'marketplace', true, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
