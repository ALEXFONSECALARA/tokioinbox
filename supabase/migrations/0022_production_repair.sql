-- TokioInbox V22 — reparo de produção / idempotência / pedido atômico.
-- Execute este arquivo no SQL Editor do MESMO projeto Supabase usado pelo Render.
-- É aditivo e tolera tabelas/colunas já existentes.

create extension if not exists "pgcrypto";

-- Dependências de autenticação usadas pelos logs/clientes.
create table if not exists admin_users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  login text not null unique,
  password_hash text not null,
  restaurant_slug text references restaurants(slug) on delete set null,
  role text not null default 'operador',
  active boolean not null default true,
  permissions jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null unique,
  email text,
  password_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists customer_addresses (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  label text not null default 'Casa',
  cep text,
  street text not null,
  number text not null,
  neighborhood text not null,
  city text,
  state text,
  unit text,
  complement text,
  reference text,
  lat double precision,
  lng double precision,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists customer_addresses_customer_id_idx on customer_addresses(customer_id);

-- Colunas exigidas pelo checkout, histórico e conciliação.
alter table orders
  add column if not exists customer_id uuid references customers(id) on delete set null,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists payment_status text not null default 'pendente',
  add column if not exists payment_confirmed_at timestamptz;

create index if not exists orders_customer_id_idx on orders(customer_id);
create index if not exists orders_restaurant_updated_idx on orders(restaurant_id, updated_at desc);
update orders set updated_at = coalesce(created_at, now()) where updated_at is null;

create or replace function set_orders_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
drop trigger if exists trg_orders_updated_at on orders;
create trigger trg_orders_updated_at before update on orders for each row execute function set_orders_updated_at();

-- Observabilidade usada pelo backend.
create table if not exists admin_login_logs (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid references admin_users(id) on delete set null,
  login text,
  success boolean not null default false,
  mode text not null default 'unknown',
  ip text,
  user_agent text,
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists admin_login_logs_created_idx on admin_login_logs(created_at desc);
alter table admin_login_logs enable row level security;
drop policy if exists "service role full access admin login logs" on admin_login_logs;
create policy "service role full access admin login logs" on admin_login_logs for all using (true) with check (true);

create table if not exists error_logs (
  id uuid primary key default gen_random_uuid(),
  level text not null default 'error',
  context text,
  message text not null,
  stack text,
  restaurant_slug text,
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists error_logs_created_idx on error_logs(created_at desc);
create index if not exists error_logs_restaurant_idx on error_logs(restaurant_slug, created_at desc);
alter table error_logs enable row level security;
drop policy if exists "service role full access error logs" on error_logs;
create policy "service role full access error logs" on error_logs for all using (true) with check (true);

-- Relay compartilhado entre instâncias Render.
create table if not exists realtime_events (
  id bigint generated always as identity primary key,
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  event_type text not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists realtime_events_poll_idx on realtime_events(id, restaurant_id);
create index if not exists realtime_events_created_at_idx on realtime_events(created_at desc);
alter table realtime_events enable row level security;
drop policy if exists "service role full access realtime events" on realtime_events;
create policy "service role full access realtime events" on realtime_events for all using (true) with check (true);

-- Pedido + itens numa única transação. Se qualquer item falhar, o pedido inteiro
-- é revertido. Isso elimina pedidos "fantasmas" criados parcialmente.
create or replace function create_order_atomic(p_order jsonb, p_items jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into orders (
    id, restaurant_id, order_number, order_type, status, customer, customer_id,
    subtotal, delivery_fee, discount, coupon_code, total, payment_method,
    payment_status, payment_confirmed_at, card_brand, cash_change_for, driver,
    estimated_minutes, cancel_reason, notes, status_history, created_at
  ) values (
    p_order->>'id',
    (p_order->>'restaurant_id')::uuid,
    coalesce((p_order->>'order_number')::integer, 0),
    coalesce(p_order->>'order_type', 'delivery'),
    coalesce(p_order->>'status', 'recebido'),
    coalesce(p_order->'customer', '{}'::jsonb),
    nullif(p_order->>'customer_id','')::uuid,
    coalesce((p_order->>'subtotal')::numeric, 0),
    coalesce((p_order->>'delivery_fee')::numeric, 0),
    coalesce((p_order->>'discount')::numeric, 0),
    nullif(p_order->>'coupon_code',''),
    coalesce((p_order->>'total')::numeric, 0),
    nullif(p_order->>'payment_method',''),
    coalesce(p_order->>'payment_status', 'pendente'),
    nullif(p_order->>'payment_confirmed_at','')::timestamptz,
    nullif(p_order->>'card_brand',''),
    nullif(p_order->>'cash_change_for','')::numeric,
    p_order->'driver',
    nullif(p_order->>'estimated_minutes','')::integer,
    nullif(p_order->>'cancel_reason',''),
    nullif(p_order->>'notes',''),
    coalesce(p_order->'status_history', '[]'::jsonb),
    coalesce(nullif(p_order->>'created_at','')::timestamptz, now())
  );

  insert into order_items (
    order_id, id, restaurant_id, menu_item_id, name, category_id, sector,
    quantity, unit_price, total_price, selected_choices, selected_extras,
    special_notes, menu_item_snapshot, sort_order
  )
  select
    p_order->>'id',
    coalesce(x->>'id', p_order->>'id' || '-item-' || (row_number() over () - 1)::text),
    (p_order->>'restaurant_id')::uuid,
    nullif(x->'menuItem'->>'id',''),
    coalesce(x->'menuItem'->>'name',''),
    nullif(x->'menuItem'->>'categoryId',''),
    nullif(x->'menuItem'->>'sector',''),
    greatest(coalesce((x->>'quantity')::integer,1),1),
    coalesce((x->>'unitPrice')::numeric,0),
    coalesce((x->>'totalPrice')::numeric,0),
    coalesce(x->'selectedChoices','[]'::jsonb),
    coalesce(x->'selectedExtras','[]'::jsonb),
    nullif(x->>'specialNotes',''),
    coalesce(x->'menuItem','{}'::jsonb),
    (row_number() over () - 1)::integer
  from jsonb_array_elements(coalesce(p_items,'[]'::jsonb)) as x;
end;
$$;
revoke all on function create_order_atomic(jsonb, jsonb) from public;
grant execute on function create_order_atomic(jsonb, jsonb) to service_role;

create or replace function purge_old_realtime_events(p_days integer default 90)
returns integer language plpgsql security definer set search_path = public as $$
declare deleted_count integer;
begin
  delete from realtime_events where created_at < now() - make_interval(days => greatest(1,p_days));
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;
revoke all on function purge_old_realtime_events(integer) from public;
grant execute on function purge_old_realtime_events(integer) to service_role;

-- IMPORTANTE: a migration 0022 corrige estrutura; ela não apaga pedidos nem dados.
