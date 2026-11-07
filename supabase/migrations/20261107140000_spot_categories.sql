-- A spot can belong to several categories (e.g. a café that is also a bakery).
-- categories[1] is the main category: it sets the marker icon and is mirrored in `category`,
-- so code that only knows `category` keeps working.

alter table public.spots add column if not exists categories text[] not null default '{}';

update public.spots set categories = array[category] where cardinality(categories) = 0;

-- Keep both columns in step whichever one a client writes
create or replace function public.sync_spot_categories() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.category is distinct from old.category and new.categories is not distinct from old.categories then
    -- Only `category` changed (older clients): make it the main one, keep the others
    new.categories := array_prepend(new.category, array_remove(new.categories, new.category));
  elsif cardinality(new.categories) = 0 then
    new.categories := array[new.category];
  end if;
  new.category := new.categories[1];
  return new;
end;
$$;

drop trigger if exists spots_sync_categories on public.spots;
create trigger spots_sync_categories before insert or update on public.spots
  for each row execute function public.sync_spot_categories();

alter table public.spots
  add constraint spots_categories_valid check (
    cardinality(categories) between 1 and 5
    and categories <@ array['DOCTOR', 'CAFE', 'RESTAURANT', 'ARTISAN', 'SUPERMARKET']
    and category = categories[1]
  );

create index if not exists spots_categories_idx on public.spots using gin (categories);

-- Coffee shops that are also bakeries
update public.spots set categories = array['CAFE', 'ARTISAN']
where name in ('La Seine — La Marsa', 'La Seine — El Menzah 6', 'Lily Delights');
