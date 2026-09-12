-- TokioInbox V27.4 — REPARO ÚNICO DO SCHEMA DE PRODUÇÃO
-- Execute este arquivo UMA vez no Supabase SQL Editor.
-- Ele é idempotente: pode ser executado novamente sem apagar dados.
-- Corrige as tabelas/colunas que o backend atual utiliza e recarrega o PostgREST.

create extension if not exists "pgcrypto";

-- Conta do cliente
create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  email text,
  password_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table customers add column if not exists email text;
alter table customers add column if not exists password_hash text;
alter table customers add column if not exists created_at timestamptz not null default now();
alter table customers add column if not exists updated_at timestamptz not null default now();

-- Endereços do cliente
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

-- Pedidos: compatibilidade com bancos criados antes da V27
alter table orders add column if not exists customer_id uuid references customers(id) on delete set null;
alter table orders add column if not exists updated_at timestamptz not null default now();
alter table orders add column if not exists payment_status text not null default 'pendente';
alter table orders add column if not exists payment_confirmed_at timestamptz;
update orders set updated_at = coalesce(created_at, now()) where updated_at is null;
create index if not exists orders_customer_id_idx on orders(customer_id);
create index if not exists orders_restaurant_updated_idx on orders(restaurant_id, updated_at desc);

-- Backup do restaurante: era a causa dos PGRST205 ao abrir a tela de backups.
create table if not exists restaurant_backups (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  version text not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  created_by text
);
create index if not exists restaurant_backups_restaurant_idx
  on restaurant_backups(restaurant_id, created_at desc);

-- Garante que o schema usado pelo realtime/backend exista em instalações antigas.
create table if not exists realtime_events (
  id bigint generated always as identity primary key,
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  event_type text not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists realtime_events_poll_idx on realtime_events(id, restaurant_id);

-- Trigger de updated_at dos pedidos
create or replace function set_orders_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
drop trigger if exists trg_orders_updated_at on orders;
create trigger trg_orders_updated_at
before update on orders
for each row execute function set_orders_updated_at();

-- Normaliza telefone para impedir duplicidade lógica de contas.
update customers
set phone = regexp_replace(phone, '\D', '', 'g')
where phone is not null;

-- Segurança: backend usa service_role; não liberar leitura pública.
alter table customers enable row level security;
alter table customer_addresses enable row level security;
alter table restaurant_backups enable row level security;
alter table realtime_events enable row level security;

-- Recarrega imediatamente o cache do PostgREST.
notify pgrst, 'reload schema';
