-- Stores imported by the team (artisans found in the ATMC community group) before
-- the seller has an account. They have no owner until the seller claims the shop:
-- an admin then sets owner_id to the seller's profile.

alter table public.stores alter column owner_id drop not null;

-- Where an imported store's listing came from ('' for shops created by their seller)
alter table public.stores add column if not exists source text not null default '';
alter table public.stores
  add constraint stores_source_length check (char_length(source) <= 300) not valid;

-- Lets the import script recognise its own rows and update them instead of duplicating
alter table public.stores add column if not exists import_key text;
create unique index if not exists stores_import_key_idx on public.stores (import_key) where import_key is not null;
