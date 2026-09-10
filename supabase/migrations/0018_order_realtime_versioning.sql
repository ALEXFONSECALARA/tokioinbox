alter table if exists orders add column if not exists updated_at timestamptz not null default now();
update orders set updated_at = coalesce(created_at, now()) where updated_at is null;
create or replace function set_orders_updated_at() returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;
drop trigger if exists trg_orders_updated_at on orders;
create trigger trg_orders_updated_at before update on orders for each row execute function set_orders_updated_at();
create index if not exists orders_restaurant_updated_idx on orders(restaurant_id, updated_at desc);
