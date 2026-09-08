create extension if not exists pgcrypto;

create table if not exists public.restaurants (
  slug text primary key,
  name text not null,
  config jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.menu_categories (
  id text primary key,
  restaurant_slug text not null references public.restaurants(slug) on delete cascade,
  name text not null,
  icon text,
  sort_order integer not null default 0,
  updated_at timestamptz not null default now()
);
create index if not exists menu_categories_restaurant_idx on public.menu_categories(restaurant_slug, sort_order);

create table if not exists public.menu_items (
  id text primary key,
  restaurant_slug text not null references public.restaurants(slug) on delete cascade,
  category_id text references public.menu_categories(id) on delete set null,
  name text not null,
  data jsonb not null default '{}'::jsonb,
  available boolean not null default true,
  updated_at timestamptz not null default now()
);
create index if not exists menu_items_restaurant_idx on public.menu_items(restaurant_slug, available);

create table if not exists public.customers (
  id text primary key,
  name text not null,
  phone text not null,
  email text,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists customers_phone_idx on public.customers(phone);

create table if not exists public.orders (
  id uuid primary key,
  restaurant_slug text not null references public.restaurants(slug) on delete restrict,
  restaurant_name text not null,
  short_code text not null,
  customer_name text not null,
  customer_phone text not null,
  order_type text not null,
  status text not null check (status in ('recebido','em_preparo','pronto','saiu_para_entrega','entregue','cancelado')),
  total numeric(12,2) not null default 0,
  data jsonb not null default '{}'::jsonb,
  status_history jsonb not null default '[]'::jsonb,
  print_status text not null default 'pendente' check (print_status in ('pendente','imprimindo','impresso')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists orders_restaurant_created_idx on public.orders(restaurant_slug, created_at desc);
create index if not exists orders_restaurant_status_idx on public.orders(restaurant_slug, status);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  restaurant_slug text not null references public.restaurants(slug) on delete restrict,
  data jsonb not null default '{}'::jsonb
);
create index if not exists order_items_order_idx on public.order_items(order_id);

create table if not exists public.error_logs (
  id uuid primary key default gen_random_uuid(),
  level text not null default 'error',
  context text,
  message text not null,
  stack text,
  restaurant_slug text,
  details jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.realtime_events (
  id bigserial primary key,
  restaurant_slug text,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists realtime_events_created_idx on public.realtime_events(created_at);
create index if not exists realtime_events_restaurant_idx on public.realtime_events(restaurant_slug, id);

create or replace function public.create_order_atomic(p_order jsonb, p_items jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid := coalesce((p_order->>'id')::uuid, gen_random_uuid());
  v_slug text := p_order->>'restaurantSlug';
  v_status_history jsonb := coalesce(p_order->'statusHistory','[]'::jsonb);
  v_item jsonb;
begin
  if v_slug is null or not exists(select 1 from public.restaurants where slug=v_slug) then
    raise exception 'RESTAURANT_NOT_FOUND' using errcode='P0001';
  end if;
  insert into public.orders(id,restaurant_slug,restaurant_name,short_code,customer_name,customer_phone,order_type,status,total,data,status_history,print_status,created_at,updated_at)
  values(v_id,v_slug,p_order->>'restaurantName',p_order->>'shortCode',p_order->>'customerName',p_order->>'customerPhone',coalesce(p_order->>'orderType','delivery'),coalesce(p_order->>'status','recebido'),coalesce((p_order->>'total')::numeric,0),p_order,v_status_history,coalesce(p_order->>'printStatus','pendente'),coalesce((p_order->>'createdAt')::timestamptz,now()),coalesce((p_order->>'updatedAt')::timestamptz,now()));
  for v_item in select * from jsonb_array_elements(coalesce(p_items,'[]'::jsonb)) loop
    insert into public.order_items(order_id,restaurant_slug,data) values(v_id,v_slug,v_item);
  end loop;
  insert into public.realtime_events(restaurant_slug,event_type,payload) values(v_slug,'order-created',jsonb_build_object('orderId',v_id));
  return v_id;
exception when others then
  raise;
end;
$$;

grant execute on function public.create_order_atomic(jsonb,jsonb) to service_role;

create or replace function public.purge_old_realtime_events(p_days integer default 7)
returns integer language plpgsql security definer set search_path=public as $$
declare v_count integer;
begin
  delete from public.realtime_events where created_at < now() - make_interval(days => greatest(1,p_days));
  get diagnostics v_count = row_count;
  return v_count;
end; $$;
grant execute on function public.purge_old_realtime_events(integer) to service_role;

alter table public.restaurants enable row level security;
alter table public.menu_categories enable row level security;
alter table public.menu_items enable row level security;
alter table public.customers enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.error_logs enable row level security;
alter table public.realtime_events enable row level security;

-- Backend uses service_role; policies below allow public read of the storefront only.
drop policy if exists public_restaurants_read on public.restaurants;
create policy public_restaurants_read on public.restaurants for select using (true);
drop policy if exists public_categories_read on public.menu_categories;
create policy public_categories_read on public.menu_categories for select using (true);
drop policy if exists public_menu_read on public.menu_items;
create policy public_menu_read on public.menu_items for select using (available = true);

notify pgrst, 'reload schema';
