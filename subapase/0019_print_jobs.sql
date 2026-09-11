create table if not exists print_jobs (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  order_id text not null,
  order_number text,
  variant text not null default 'customer',
  status text not null default 'pendente' check (status in ('pendente','imprimindo','impresso','erro','cancelado')),
  attempts integer not null default 0,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists print_jobs_restaurant_status_idx on print_jobs(restaurant_id,status,created_at desc);
create index if not exists print_jobs_order_idx on print_jobs(restaurant_id,order_id);
alter table print_jobs enable row level security;
create policy "service role full access print jobs" on print_jobs for all using (true) with check (true);
create or replace function set_print_jobs_updated_at() returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end; $$;
drop trigger if exists trg_print_jobs_updated_at on print_jobs;
create trigger trg_print_jobs_updated_at before update on print_jobs for each row execute function set_print_jobs_updated_at();
