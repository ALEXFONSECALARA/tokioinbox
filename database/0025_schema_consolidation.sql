-- TokioInbox v26 — consolidação de schema e segurança.
-- A migration 0001 criou print_jobs com um schema antigo; 0019 tentou
-- recriá-la com outro schema usando IF NOT EXISTS, então os bancos antigos
-- podiam ficar com colunas incompatíveis com o backend atual.

create extension if not exists "pgcrypto";

alter table if exists print_jobs
  add column if not exists order_number text,
  add column if not exists variant text not null default 'customer',
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists worker_id text,
  add column if not exists lease_until timestamptz;

-- Converte estados legados para o contrato único usado pela API atual.
update print_jobs set status = case upper(status)
  when 'PENDING' then 'pendente'
  when 'CLAIMED' then 'imprimindo'
  when 'PRINTING' then 'imprimindo'
  when 'PRINTED' then 'impresso'
  when 'FAILED' then 'erro'
  when 'CANCELLED' then 'cancelado'
  else status end
where status is not null;

-- Aproveita o tipo legado como variant quando houver essa informação.
update print_jobs set variant = case upper(coalesce(type,''))
  when 'MANUAL_REPRINT' then 'reprint'
  when 'TEST' then 'test'
  else coalesce(nullif(variant,''),'customer') end
where type is not null;

create index if not exists print_jobs_restaurant_status_created_idx
  on print_jobs(restaurant_id,status,created_at desc);
create index if not exists print_jobs_claim_idx
  on print_jobs(restaurant_id,status,created_at);

-- A service_role já ignora RLS. Estas policies USING(true) eram permissivas
-- demais para qualquer role que recebesse acesso à tabela.
drop policy if exists "service role full access print jobs" on print_jobs;
drop policy if exists "service role full access realtime events" on realtime_events;
drop policy if exists "service role full access restaurant backups" on restaurant_backups;
drop policy if exists "service role full access delivery drivers" on delivery_drivers;
drop policy if exists "service role full access admin login logs" on admin_login_logs;
drop policy if exists "service role full access error logs" on error_logs;

-- Backend usa service_role; clientes públicos não devem consultar estas tabelas.
alter table if exists print_jobs enable row level security;
alter table if exists realtime_events enable row level security;
alter table if exists restaurant_backups enable row level security;
alter table if exists delivery_drivers enable row level security;
alter table if exists admin_login_logs enable row level security;
alter table if exists error_logs enable row level security;

notify pgrst, 'reload schema';
