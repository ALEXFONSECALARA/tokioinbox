create table if not exists admin_login_logs (id uuid primary key default gen_random_uuid(), admin_user_id uuid references admin_users(id) on delete set null, login text, success boolean not null default false, mode text not null default 'unknown', ip text, user_agent text, details jsonb not null default '{}', created_at timestamptz not null default now());
create index if not exists admin_login_logs_created_idx on admin_login_logs(created_at desc);
create table if not exists error_logs (id uuid primary key default gen_random_uuid(), level text not null default 'error', context text, message text not null, stack text, restaurant_slug text, details jsonb not null default '{}', created_at timestamptz not null default now());
create index if not exists error_logs_created_idx on error_logs(created_at desc);
create index if not exists error_logs_restaurant_idx on error_logs(restaurant_slug, created_at desc);
alter table admin_login_logs enable row level security;
alter table error_logs enable row level security;
