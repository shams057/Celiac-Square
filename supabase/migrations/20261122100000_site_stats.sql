-- Back-office statistics (November 2026)
--   * site_visits: one row per visit (a visit ends after 30 minutes without activity). `visitor` is a random id
--     the browser keeps (the same one the forum uses to count reads), hashed by the API: it says nothing about
--     the person, and no IP address, page or account is stored with it.
--   * stats_daily(): per Tunisian day, how many visits, visitors, new accounts, forum questions and answers,
--     marketplace orders and items bought (cancelled orders left out), and new marketplace products; and the
--     visitors of the period and of the one before it (a visitor seen on three days is one visitor, so these
--     cannot be added up from the days).
--   * stats_product_sales(): the marketplace products that sold the most and the least over a period.
-- Both functions are read-only and called by the API only (secret key); counting happens here, so the figures
-- stay right however many rows there are (the API returns at most 1,000 rows per request).

create table if not exists public.site_visits (
  id bigint generated always as identity primary key,
  visitor text not null check (char_length(visitor) between 8 and 80),
  signed_in boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists site_visits_created_at_idx on public.site_visits (created_at);

alter table public.site_visits enable row level security;

-- From p_from (the start of the period before) to now; p_split is where the period itself starts.
-- metric: visits | visitors | accounts | questions | answers | orders | items | products, per day;
-- visitors_before | visitors_period, with no day.
create or replace function public.stats_daily(p_from timestamptz, p_split timestamptz)
returns table (metric text, day date, n bigint)
language sql
stable
set search_path = ''
as $$
  select 'visits', (v.created_at at time zone 'Africa/Tunis')::date, count(*) from public.site_visits v where v.created_at >= p_from group by 2
  union all
  select 'visitors', (v.created_at at time zone 'Africa/Tunis')::date, count(distinct v.visitor) from public.site_visits v where v.created_at >= p_from group by 2
  union all
  select 'accounts', (p.created_at at time zone 'Africa/Tunis')::date, count(*) from public.profiles p where p.created_at >= p_from group by 2
  union all
  select 'questions', (t.created_at at time zone 'Africa/Tunis')::date, count(*) from public.forum_threads t where t.created_at >= p_from group by 2
  union all
  select 'answers', (r.created_at at time zone 'Africa/Tunis')::date, count(*) from public.forum_replies r where r.created_at >= p_from group by 2
  union all
  select 'orders', (o.created_at at time zone 'Africa/Tunis')::date, count(*) from public.orders o where o.created_at >= p_from and o.status <> 'CANCELLED' group by 2
  union all
  select 'items', (o.created_at at time zone 'Africa/Tunis')::date, sum(i.quantity)::bigint
    from public.orders o join public.order_items i on i.order_id = o.id
    where o.created_at >= p_from and o.status <> 'CANCELLED' group by 2
  union all
  select 'products', (m.created_at at time zone 'Africa/Tunis')::date, count(*) from public.market_products m where m.created_at >= p_from group by 2
  union all
  select 'visitors_before', null::date, count(distinct v.visitor) from public.site_visits v where v.created_at >= p_from and v.created_at < p_split
  union all
  select 'visitors_period', null::date, count(distinct v.visitor) from public.site_visits v where v.created_at >= p_split
$$;

-- The `p_limit` best sellers ('top': most items bought, including products deleted since) and the `p_limit`
-- products on sale that sold the least ('bottom': visible shop, product available; none sold counts as 0).
-- Cancelled orders are left out.
create or replace function public.stats_product_sales(p_from timestamptz, p_limit integer default 10)
returns table (list text, product_id uuid, title text, store_name text, units bigint, orders bigint, revenue numeric, listed_at timestamptz)
language sql
stable
set search_path = ''
as $$
  with sold as (
    select i.product_id, min(i.title) as title, min(o.store_name) as store_name,
           sum(i.quantity)::bigint as units, count(distinct o.id)::bigint as orders,
           coalesce(sum(i.quantity * i.unit_price), 0) as revenue
    from public.orders o join public.order_items i on i.order_id = o.id
    where o.created_at >= p_from and o.status <> 'CANCELLED'
    group by i.product_id, case when i.product_id is null then o.store_name || ':' || i.title end
  ),
  top as (
    select 'top'::text, s.product_id, coalesce(m.title, s.title), coalesce(st.name, s.store_name), s.units, s.orders, s.revenue, m.created_at
    from sold s
    left join public.market_products m on m.id = s.product_id
    left join public.stores st on st.id = m.store_id
    order by s.units desc, s.orders desc, 3
    limit p_limit
  ),
  bottom as (
    select 'bottom'::text, m.id, m.title, st.name, coalesce(s.units, 0), coalesce(s.orders, 0), coalesce(s.revenue, 0), m.created_at
    from public.market_products m
    join public.stores st on st.id = m.store_id and st.is_active
    left join sold s on s.product_id = m.id
    where m.is_available
    order by coalesce(s.units, 0), m.created_at, m.title
    limit p_limit
  )
  select * from top
  union all
  select * from bottom
$$;

revoke execute on function public.stats_daily(timestamptz, timestamptz) from public, anon, authenticated;
revoke execute on function public.stats_product_sales(timestamptz, integer) from public, anon, authenticated;
grant execute on function public.stats_daily(timestamptz, timestamptz) to service_role;
grant execute on function public.stats_product_sales(timestamptz, integer) to service_role;
