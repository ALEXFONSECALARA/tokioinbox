-- TokioInbox V25 — consolidação de produção
-- Execute UMA vez no SQL Editor do mesmo Supabase usado pelo Render.
-- Não apaga pedidos. Corrige/garante estruturas usadas pelo painel,
-- isolamento de pedidos, histórico, realtime, backups e fotos.

create extension if not exists "pgcrypto";

create table if not exists admin_users (
  id uuid primary key default gen_random_uuid(), name text not null, login text not null unique,
  password_hash text not null, restaurant_slug text references restaurants(slug) on delete set null,
  role text not null default 'operador', active boolean not null default true,
  permissions jsonb not null default '{}', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists customers (
  id uuid primary key default gen_random_uuid(), name text not null, phone text not null unique,
  email text, password_hash text not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Estruturas operacionais que versões anteriores criavam separadamente.
-- ------------------------------------------------------------
create table if not exists restaurant_backups (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  version text not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  created_by text
);
create index if not exists restaurant_backups_restaurant_idx on restaurant_backups(restaurant_id, created_at desc);
alter table restaurant_backups enable row level security;
drop policy if exists "service role full access restaurant backups" on restaurant_backups;
create policy "service role full access restaurant backups" on restaurant_backups for all using (true) with check (true);

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

-- ------------------------------------------------------------
-- Pedidos: colunas obrigatórias e versão otimista.
-- ------------------------------------------------------------
alter table orders
  add column if not exists customer_id uuid references customers(id) on delete set null,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists payment_status text not null default 'pendente',
  add column if not exists payment_confirmed_at timestamptz;
update orders set updated_at = coalesce(created_at, now()) where updated_at is null;
create index if not exists orders_customer_id_idx on orders(customer_id);
create index if not exists orders_restaurant_updated_idx on orders(restaurant_id, updated_at desc);

create or replace function set_orders_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;
drop trigger if exists trg_orders_updated_at on orders;
create trigger trg_orders_updated_at before update on orders for each row execute function set_orders_updated_at();

-- ------------------------------------------------------------
-- Isolamento estrutural dos itens: order_items.restaurant_id precisa
-- ser exatamente o mesmo restaurante do pedido.
-- ------------------------------------------------------------
update order_items oi
set restaurant_id = o.restaurant_id
from orders o
where oi.order_id = o.id
  and oi.restaurant_id is distinct from o.restaurant_id;

create unique index if not exists orders_id_restaurant_unique on orders(id, restaurant_id);
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'order_items_order_restaurant_fk'
      and conrelid = 'public.order_items'::regclass
  ) then
    alter table public.order_items
      add constraint order_items_order_restaurant_fk
      foreign key (order_id, restaurant_id)
      references public.orders(id, restaurant_id)
      on delete cascade;
  end if;
end $$;
create index if not exists order_items_restaurant_order_idx on order_items(restaurant_id, order_id);

-- ------------------------------------------------------------
-- Print jobs: uma única estrutura oficial, com lease para impedir
-- dois bridges imprimirem o mesmo pedido.
-- ------------------------------------------------------------
create table if not exists print_jobs (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  order_id text not null,
  order_number text,
  variant text not null default 'customer',
  status text not null default 'pendente',
  attempts integer not null default 0,
  error text,
  worker_id text,
  lease_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table print_jobs add column if not exists worker_id text;
alter table print_jobs add column if not exists lease_until timestamptz;

do $$
declare c record;
begin
  for c in select conname from pg_constraint where conrelid='public.print_jobs'::regclass and contype='c' loop
    execute format('alter table public.print_jobs drop constraint %I', c.conname);
  end loop;
end $$;
update print_jobs set status = case upper(status)
  when 'PENDING' then 'pendente'
  when 'CLAIMED' then 'imprimindo'
  when 'PRINTING' then 'imprimindo'
  when 'PRINTED' then 'impresso'
  when 'FAILED' then 'erro'
  when 'CANCELLED' then 'cancelado'
  else lower(status)
end;
alter table print_jobs add constraint print_jobs_status_check check (status in ('pendente','imprimindo','impresso','erro','cancelado'));
create index if not exists print_jobs_restaurant_status_idx on print_jobs(restaurant_id,status,created_at desc);
create index if not exists print_jobs_order_idx on print_jobs(restaurant_id,order_id);
alter table print_jobs enable row level security;
drop policy if exists "service role full access print jobs" on print_jobs;
create policy "service role full access print jobs" on print_jobs for all using (true) with check (true);
create or replace function set_print_jobs_updated_at()
returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end; $$;
drop trigger if exists trg_print_jobs_updated_at on print_jobs;
create trigger trg_print_jobs_updated_at before update on print_jobs for each row execute function set_print_jobs_updated_at();

-- Claim atômico da fila de impressão.
create or replace function claim_next_print_job(p_restaurant_id uuid, p_worker_id text, p_lease_seconds integer default 30)
returns setof print_jobs
language plpgsql security definer set search_path=public
as $$
declare r print_jobs;
begin
  select * into r from print_jobs
  where restaurant_id=p_restaurant_id
    and (status='pendente' or (status='imprimindo' and lease_until is not null and lease_until < now()))
  order by created_at asc
  for update skip locked limit 1;
  if not found then return; end if;
  update print_jobs set status='imprimindo', attempts=coalesce(attempts,0)+1,
    worker_id=p_worker_id, lease_until=now()+make_interval(secs=>greatest(5,p_lease_seconds)), updated_at=now()
  where id=r.id returning * into r;
  return next r;
end;
$$;
revoke all on function claim_next_print_job(uuid,text,integer) from public;
grant execute on function claim_next_print_job(uuid,text,integer) to service_role;

-- ------------------------------------------------------------
-- Fotos: bucket público para que URLs getPublicUrl realmente abram
-- no cardápio/admin. O backend continua sendo o único escritor.
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('restaurant-media','restaurant-media',true)
on conflict (id) do update set public=true;

-- Retenção manual segura: mantém 90 dias de eventos.
create or replace function purge_old_realtime_events(p_days integer default 90)
returns integer language plpgsql security definer set search_path=public
as $$
declare deleted_count integer;
begin
  delete from realtime_events where created_at < now() - make_interval(days=>greatest(1,p_days));
  get diagnostics deleted_count=row_count;
  return deleted_count;
end;
$$;
revoke all on function purge_old_realtime_events(integer) from public;
grant execute on function purge_old_realtime_events(integer) to service_role;
