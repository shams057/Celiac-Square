-- Orders from the marketplace, handled by the Celiac Square team:
--   NEW        placed by the customer, waiting for the confirmation call
--   CONFIRMED  the team called the customer; prices and delivery fee are agreed
--   PREPARING  passed to the artisan, who prepares it
--   READY      the artisan has it ready for pickup
--   SHIPPED    handed to the carrier (Aramex, Rapid-Poste, FedEx, own courier…)
--   DELIVERED  received by the customer
--   CANCELLED  at any step before delivery, with a reason
-- One order per store: a cart with products from two stores becomes two orders.
-- Payment is cash on delivery.
--
-- Confirmation: when every price is known, the customer gets a WhatsApp message and
-- confirms by replying the keyword (OUI). Without a confirmation after 3 days, or when the
-- customer asked for a call, a price is missing or WhatsApp failed, the team calls instead.

-- Back-office workers: they handle orders and see nothing else of the back-office
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check check (role in ('ADMIN', 'STAFF', 'SELLER', 'CLIENT'));

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  -- Short number read out on the phone (CS-1001…)
  number bigint generated always as identity (start with 1001) unique,
  customer_id uuid references public.profiles (id) on delete set null,
  store_id uuid references public.stores (id) on delete set null,
  store_name text not null,
  status text not null default 'NEW'
    check (status in ('NEW', 'CONFIRMED', 'PREPARING', 'READY', 'SHIPPED', 'DELIVERED', 'CANCELLED')),
  customer_name text not null,
  phone text not null,
  city text not null,
  address text not null,
  customer_note text not null default '',
  delivery_fee numeric(10, 3) check (delivery_fee is null or delivery_fee >= 0),
  carrier text not null default '',
  tracking_number text not null default '',
  staff_notes text not null default '',
  cancel_reason text not null default '',
  -- How the customer wants to confirm: WHATSAPP (reply to our message) or PHONE (we call)
  confirm_channel text not null default 'WHATSAPP' check (confirm_channel in ('WHATSAPP', 'PHONE')),
  -- NONE: not sent · SENT: waiting for the reply · REPLIED: answered something other than the
  -- keyword (the team reads it and calls) · FAILED: WhatsApp refused it · CONFIRMED: keyword received
  whatsapp_status text not null default 'NONE' check (whatsapp_status in ('NONE', 'SENT', 'REPLIED', 'FAILED', 'CONFIRMED')),
  whatsapp_sent_at timestamptz,
  whatsapp_message_id text not null default '',
  call_attempts integer not null default 0,
  last_call_at timestamptz,
  confirmed_at timestamptz,
  preparing_at timestamptz,
  ready_at timestamptz,
  shipped_at timestamptz,
  delivered_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orders_text_lengths check (
    char_length(store_name) <= 120 and char_length(customer_name) <= 100 and char_length(phone) <= 30
    and char_length(city) <= 80 and char_length(address) <= 200 and char_length(customer_note) <= 1000
    and char_length(carrier) <= 60 and char_length(tracking_number) <= 80 and char_length(staff_notes) <= 2000
    and char_length(cancel_reason) <= 300 and char_length(whatsapp_message_id) <= 200
  )
);
create index orders_status_idx on public.orders (status, created_at desc);
create index orders_customer_idx on public.orders (customer_id, created_at desc);
create index orders_store_idx on public.orders (store_id);
-- Incoming WhatsApp replies are matched on the customer's phone among orders waiting for one
create index orders_whatsapp_waiting_idx on public.orders (phone) where status = 'NEW' and whatsapp_status in ('SENT', 'REPLIED');
create trigger orders_updated_at before update on public.orders
  for each row execute function public.set_updated_at();

-- What was ordered. Title, photo and price are copied at order time, so the order
-- still reads the same if the seller edits or deletes the product.
create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid references public.market_products (id) on delete set null,
  title text not null,
  image text not null default '',
  -- null until the team agrees a price with the customer (many artisans list none)
  unit_price numeric(10, 3) check (unit_price is null or unit_price >= 0),
  quantity integer not null check (quantity between 1 and 50),
  created_at timestamptz not null default now(),
  constraint order_items_text_lengths check (char_length(title) <= 120 and char_length(image) <= 500)
);
create index order_items_order_idx on public.order_items (order_id);
create index order_items_product_idx on public.order_items (product_id);

-- Everything that happened to an order: status changes, calls, notes, edits
create table public.order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  actor_email text not null default '',
  kind text not null check (kind in ('CREATED', 'STATUS', 'CALL', 'EDIT', 'NOTE', 'WHATSAPP')),
  from_status text,
  to_status text,
  message text not null default '',
  created_at timestamptz not null default now(),
  constraint order_events_message_length check (char_length(message) <= 1000)
);
create index order_events_order_idx on public.order_events (order_id, created_at);
create index order_events_actor_idx on public.order_events (actor_id);

-- As for the other tables, only the Express API (secret key) reads and writes them
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_events enable row level security;
