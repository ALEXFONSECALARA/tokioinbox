-- V14-V18: production durability, shared realtime, backups and delivery ops
create table if not exists restaurant_backups (
  id uuid primary key default gen_random_uuid(), restaurant_id uuid not null references restaurants(id) on delete cascade,
  version text not null, payload jsonb not null, created_at timestamptz not null default now(), created_by text
);
create index if not exists restaurant_backups_restaurant_idx on restaurant_backups(restaurant_id, created_at desc);
alter table restaurant_backups enable row level security;
create policy "service role full access restaurant backups" on restaurant_backups for all using (true) with check (true);
create table if not exists realtime_events (
  id bigint generated always as identity primary key, restaurant_id uuid not null references restaurants(id) on delete cascade,
  event_type text not null, payload jsonb not null, created_at timestamptz not null default now()
);
create index if not exists realtime_events_poll_idx on realtime_events(id,restaurant_id);
alter table realtime_events enable row level security;
create policy "service role full access realtime events" on realtime_events for all using (true) with check (true);
create table if not exists delivery_drivers (
  id uuid primary key default gen_random_uuid(), restaurant_id uuid not null references restaurants(id) on delete cascade,
  name text not null, phone text not null, vehicle text not null default 'moto', plate text, photo text,
  status text not null default 'offline' check(status in ('available','busy','offline')), rating numeric(3,2), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists delivery_drivers_restaurant_idx on delivery_drivers(restaurant_id,status);
alter table delivery_drivers enable row level security;
create policy "service role full access delivery drivers" on delivery_drivers for all using (true) with check (true);
