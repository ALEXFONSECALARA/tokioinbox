-- ============================================================================
-- FASE 1 — Núcleo multi-restaurante, RBAC granular e RLS
-- ============================================================================
-- Este arquivo é idempotente onde possível (IF NOT EXISTS) para poder rodar
-- em ambientes novos. Rode isso no SQL Editor do Supabase, ou via
-- `supabase db push` / migrations CLI.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. RESTAURANTES
-- ----------------------------------------------------------------------------
create table if not exists public.restaurants (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  logo_url text,
  cover_image_url text,
  description text,
  address jsonb not null default '{}'::jsonb,
  settings jsonb not null default '{}'::jsonb,          -- horários, taxas, etc.
  delivery_settings jsonb not null default '{}'::jsonb,  -- áreas, taxa, tempo estimado
  printing_settings jsonb not null default '{}'::jsonb,  -- impressoras por destino
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_restaurants_slug on public.restaurants(slug);

-- ----------------------------------------------------------------------------
-- 2. PERFIS (staff E clientes vivem em auth.users; isso é o profile de cada um)
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  user_type text not null check (user_type in ('staff', 'customer')),
  full_name text not null,
  phone text,
  is_super_admin boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 3. PAPÉIS E PERMISSÕES GRANULARES (RBAC real, não fixo em código)
-- ----------------------------------------------------------------------------
create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,   -- 'super_admin','gerente','caixa','garcom','cozinha','sushibar','motoboy'
  name text not null,
  is_system boolean not null default false  -- papéis do sistema não podem ser apagados
);

create table if not exists public.permissions (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,   -- 'restaurant.view','order.create', etc (seção 4 do briefing)
  description text
);

create table if not exists public.role_permissions (
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  primary key (role_id, permission_id)
);

-- Vínculo de um usuário (staff) a um restaurante, com papel base.
create table if not exists public.restaurant_users (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role_id uuid not null references public.roles(id),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (restaurant_id, user_id)
);
create index if not exists idx_restaurant_users_user on public.restaurant_users(user_id);
create index if not exists idx_restaurant_users_restaurant on public.restaurant_users(restaurant_id);

-- Permissões individuais: Super Admin pode liberar/bloquear permissão específica
-- para um vínculo usuário+restaurante, sobrescrevendo o padrão do papel.
create table if not exists public.user_permissions (
  restaurant_user_id uuid not null references public.restaurant_users(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  allowed boolean not null,
  primary key (restaurant_user_id, permission_id)
);

-- ----------------------------------------------------------------------------
-- 4. CLIENTES (perfil estendido; a conta em si é profiles + auth.users)
-- ----------------------------------------------------------------------------
create table if not exists public.customer_addresses (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete cascade,
  label text,
  street text not null,
  number text,
  neighborhood text,
  city text,
  state text,
  zip_code text,
  complement text,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_customer_addresses_customer on public.customer_addresses(customer_id);

-- ----------------------------------------------------------------------------
-- 5. CARDÁPIO
-- ----------------------------------------------------------------------------
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists idx_categories_restaurant on public.categories(restaurant_id);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  name text not null,
  description text,
  price numeric(10,2) not null default 0,
  image_url text,
  is_active boolean not null default true,
  sort_order int not null default 0,
  destination text not null default 'cozinha', -- 'cozinha' | 'sushibar' | 'bar' | 'outro'
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_products_restaurant on public.products(restaurant_id);
create index if not exists idx_products_category on public.products(category_id);

create table if not exists public.product_option_groups (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  title text not null,
  min_select int not null default 0,
  max_select int not null default 1,
  is_required boolean not null default false,
  sort_order int not null default 0
);

create table if not exists public.product_options (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.product_option_groups(id) on delete cascade,
  name text not null,
  price_delta numeric(10,2) not null default 0,
  is_active boolean not null default true
);

-- ----------------------------------------------------------------------------
-- 6. MESAS
-- ----------------------------------------------------------------------------
create table if not exists public.tables (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  number int not null,
  label text,
  status text not null default 'livre' check (status in ('livre','ocupada','aguardando_conta','fechando')),
  created_at timestamptz not null default now(),
  unique (restaurant_id, number)
);
create index if not exists idx_tables_restaurant on public.tables(restaurant_id);

-- ----------------------------------------------------------------------------
-- 7. MOTORISTAS / ENTREGA
-- ----------------------------------------------------------------------------
create table if not exists public.drivers (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  name text not null,
  phone text,
  vehicle text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists idx_drivers_restaurant on public.drivers(restaurant_id);

-- ----------------------------------------------------------------------------
-- 8. PEDIDOS (núcleo do Kanban central — seção 8/9/11 do briefing)
-- ----------------------------------------------------------------------------
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete restrict,
  order_number bigint generated always as identity,
  short_code text not null,
  customer_id uuid references public.profiles(id) on delete set null,
  source text not null check (source in ('mesa','balcao','delivery','online')),
  table_id uuid references public.tables(id) on delete set null,
  status text not null default 'novo' check (
    status in ('novo','confirmado','preparando','pronto','em_entrega','finalizado','cancelado')
  ),
  order_type text not null check (order_type in ('delivery','retirada','mesa','balcao')),
  customer_name text,
  customer_phone text,
  delivery_address jsonb,
  subtotal numeric(10,2) not null default 0,
  delivery_fee numeric(10,2) not null default 0,
  discount numeric(10,2) not null default 0,
  total numeric(10,2) not null default 0,
  payment_method text,
  payment_status text not null default 'pendente' check (payment_status in ('pendente','pago','falhou','estornado')),
  created_by uuid references public.profiles(id),   -- funcionário ou cliente que criou
  idempotency_key text unique,                       -- evita pedido duplicado (seção 10)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_orders_restaurant on public.orders(restaurant_id);
create index if not exists idx_orders_status on public.orders(restaurant_id, status);
create index if not exists idx_orders_customer on public.orders(customer_id);
create index if not exists idx_orders_table on public.orders(table_id);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  name_snapshot text not null,
  destination text not null default 'cozinha',
  quantity int not null default 1,
  unit_price numeric(10,2) not null default 0,
  total_price numeric(10,2) not null default 0,
  notes text
);
create index if not exists idx_order_items_order on public.order_items(order_id);

create table if not exists public.order_item_options (
  id uuid primary key default gen_random_uuid(),
  order_item_id uuid not null references public.order_items(id) on delete cascade,
  name_snapshot text not null,
  price_delta numeric(10,2) not null default 0
);

create table if not exists public.order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  status text not null,
  changed_by uuid references public.profiles(id),
  note text,
  created_at timestamptz not null default now()
);
create index if not exists idx_order_status_history_order on public.order_status_history(order_id);

create table if not exists public.deliveries (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  driver_id uuid references public.drivers(id) on delete set null,
  status text not null default 'aguardando' check (status in ('aguardando','atribuido','a_caminho','entregue','cancelado')),
  assigned_at timestamptz,
  picked_up_at timestamptz,
  delivered_at timestamptz
);
create index if not exists idx_deliveries_order on public.deliveries(order_id);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  method text not null,
  amount numeric(10,2) not null,
  status text not null default 'pendente' check (status in ('pendente','pago','falhou','estornado')),
  transaction_ref text,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_payments_order on public.payments(order_id);

-- ----------------------------------------------------------------------------
-- 9. IMPRESSÃO (idempotente — seção 19 do briefing)
-- ----------------------------------------------------------------------------
create table if not exists public.printers (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name text not null,
  destination text not null, -- 'cozinha' | 'sushibar' | 'caixa' | 'motoboy'
  connection_info jsonb not null default '{}'::jsonb,
  is_active boolean not null default true
);

create table if not exists public.print_jobs (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  destination text not null,
  idempotency_key text not null,      -- ex: order_id + destination + status -> nunca duplica
  status text not null default 'pendente' check (status in ('pendente','impresso','falhou')),
  payload jsonb not null default '{}'::jsonb,
  printer_id uuid references public.printers(id),
  created_at timestamptz not null default now(),
  printed_at timestamptz,
  unique (restaurant_id, idempotency_key)
);
create index if not exists idx_print_jobs_order on public.print_jobs(order_id);

-- ----------------------------------------------------------------------------
-- 10. AUDITORIA (seção 18)
-- ----------------------------------------------------------------------------
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid references public.restaurants(id) on delete set null,
  actor_type text not null check (actor_type in ('user','customer','system')),
  actor_id uuid,
  action text not null,
  category text not null,
  details jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_audit_logs_restaurant on public.audit_logs(restaurant_id, created_at desc);

-- ============================================================================
-- SEED: papéis e permissões padrão do sistema (seção 3 e 4 do briefing)
-- ============================================================================
insert into public.roles (key, name, is_system) values
  ('super_admin', 'Super Administrador', true),
  ('gerente', 'Gerente', true),
  ('caixa', 'Caixa / Balcão', true),
  ('garcom', 'Garçom', true),
  ('cozinha', 'Cozinha', true),
  ('sushibar', 'Sushibar', true),
  ('motoboy', 'Motoboy / Entrega', true)
on conflict (key) do nothing;

insert into public.permissions (key, description) values
  ('restaurant.view', 'Visualizar dados do restaurante'),
  ('restaurant.edit', 'Editar configurações do restaurante'),
  ('menu.view', 'Visualizar cardápio'),
  ('menu.edit', 'Editar cardápio'),
  ('product.view', 'Visualizar produtos'),
  ('product.create', 'Criar produtos'),
  ('product.edit', 'Editar produtos'),
  ('product.delete', 'Excluir produtos'),
  ('table.view', 'Visualizar mesas'),
  ('table.manage', 'Gerenciar mesas'),
  ('order.view', 'Visualizar pedidos'),
  ('order.create', 'Criar pedidos'),
  ('order.edit', 'Editar pedidos'),
  ('order.cancel', 'Cancelar pedidos'),
  ('order.close', 'Fechar/finalizar pedidos'),
  ('delivery.view', 'Visualizar entregas'),
  ('delivery.manage', 'Gerenciar entregas'),
  ('users.view', 'Visualizar usuários'),
  ('users.create', 'Criar usuários'),
  ('users.edit', 'Editar usuários'),
  ('users.delete', 'Excluir/bloquear usuários'),
  ('reports.view', 'Visualizar relatórios'),
  ('printing.view', 'Visualizar impressão'),
  ('printing.manage', 'Gerenciar impressão'),
  ('settings.view', 'Visualizar configurações'),
  ('settings.edit', 'Editar configurações')
on conflict (key) do nothing;

-- Mapeamento papel -> permissões padrão (pode ser sobrescrito por usuário via user_permissions)
do $$
declare
  r_super uuid; r_gerente uuid; r_caixa uuid; r_garcom uuid; r_cozinha uuid; r_sushibar uuid; r_motoboy uuid;
begin
  select id into r_super from public.roles where key = 'super_admin';
  select id into r_gerente from public.roles where key = 'gerente';
  select id into r_caixa from public.roles where key = 'caixa';
  select id into r_garcom from public.roles where key = 'garcom';
  select id into r_cozinha from public.roles where key = 'cozinha';
  select id into r_sushibar from public.roles where key = 'sushibar';
  select id into r_motoboy from public.roles where key = 'motoboy';

  -- super_admin: todas as permissões
  insert into public.role_permissions (role_id, permission_id)
  select r_super, id from public.permissions
  on conflict do nothing;

  -- gerente: tudo exceto exclusão de usuários e gestão de permissões individuais
  insert into public.role_permissions (role_id, permission_id)
  select r_gerente, id from public.permissions
  where key not in ('users.delete')
  on conflict do nothing;

  -- caixa
  insert into public.role_permissions (role_id, permission_id)
  select r_caixa, id from public.permissions
  where key in ('restaurant.view','menu.view','product.view','table.view','table.manage',
                'order.view','order.create','order.edit','order.close',
                'delivery.view','printing.view')
  on conflict do nothing;

  -- garçom
  insert into public.role_permissions (role_id, permission_id)
  select r_garcom, id from public.permissions
  where key in ('menu.view','product.view','table.view',
                'order.view','order.create','order.edit')
  on conflict do nothing;

  -- cozinha
  insert into public.role_permissions (role_id, permission_id)
  select r_cozinha, id from public.permissions
  where key in ('order.view','printing.view')
  on conflict do nothing;

  -- sushibar
  insert into public.role_permissions (role_id, permission_id)
  select r_sushibar, id from public.permissions
  where key in ('order.view','printing.view')
  on conflict do nothing;

  -- motoboy
  insert into public.role_permissions (role_id, permission_id)
  select r_motoboy, id from public.permissions
  where key in ('delivery.view','order.view')
  on conflict do nothing;
end $$;

-- ============================================================================
-- FUNÇÕES AUXILIARES DE AUTORIZAÇÃO (usadas pelas policies de RLS abaixo)
-- ============================================================================
create or replace function public.is_super_admin()
returns boolean language sql stable security definer as $$
  select coalesce((select is_super_admin from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.user_restaurant_ids()
returns setof uuid language sql stable security definer as $$
  select restaurant_id from public.restaurant_users
  where user_id = auth.uid() and is_active = true;
$$;

create or replace function public.has_permission(p_key text, p_restaurant_id uuid)
returns boolean language sql stable security definer as $$
  select
    public.is_super_admin()
    or exists (
      select 1
      from public.restaurant_users ru
      join public.role_permissions rp on rp.role_id = ru.role_id
      join public.permissions p on p.id = rp.permission_id
      left join public.user_permissions up
        on up.restaurant_user_id = ru.id and up.permission_id = p.id
      where ru.user_id = auth.uid()
        and ru.restaurant_id = p_restaurant_id
        and ru.is_active = true
        and p.key = p_key
        and coalesce(up.allowed, true) = true   -- override individual pode bloquear
    );
$$;

-- Variante usada pelo BACKEND (Express + service role): a identidade já foi
-- verificada via supabase.auth.getUser(token) na camada de middleware, então
-- aqui recebemos o user_id explicitamente em vez de depender de auth.uid().
create or replace function public.is_super_admin_for(p_user_id uuid)
returns boolean language sql stable security definer as $$
  select coalesce((select is_super_admin from public.profiles where id = p_user_id), false);
$$;

create or replace function public.has_permission_for(p_user_id uuid, p_key text, p_restaurant_id uuid)
returns boolean language sql stable security definer as $$
  select
    public.is_super_admin_for(p_user_id)
    or exists (
      select 1
      from public.restaurant_users ru
      join public.role_permissions rp on rp.role_id = ru.role_id
      join public.permissions p on p.id = rp.permission_id
      left join public.user_permissions up
        on up.restaurant_user_id = ru.id and up.permission_id = p.id
      where ru.user_id = p_user_id
        and ru.restaurant_id = p_restaurant_id
        and ru.is_active = true
        and p.key = p_key
        and coalesce(up.allowed, true) = true
    );
$$;

create or replace function public.user_restaurant_ids_for(p_user_id uuid)
returns setof uuid language sql stable security definer as $$
  select restaurant_id from public.restaurant_users
  where user_id = p_user_id and is_active = true;
$$;

-- ============================================================================
-- RLS — isolamento real de dados por restaurante (seção 15/17 do briefing)
-- ============================================================================
alter table public.restaurants enable row level security;
alter table public.profiles enable row level security;
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.restaurant_users enable row level security;
alter table public.user_permissions enable row level security;
alter table public.customer_addresses enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_option_groups enable row level security;
alter table public.product_options enable row level security;
alter table public.tables enable row level security;
alter table public.drivers enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_item_options enable row level security;
alter table public.order_status_history enable row level security;
alter table public.deliveries enable row level security;
alter table public.payments enable row level security;
alter table public.printers enable row level security;
alter table public.print_jobs enable row level security;
alter table public.audit_logs enable row level security;

-- Restaurantes: qualquer pessoa autenticada ou anônima pode VER restaurantes ativos
-- (vitrine pública do cliente), mas só staff vinculado ou super admin edita.
create policy restaurants_public_read on public.restaurants
  for select using (is_active = true or public.is_super_admin());
create policy restaurants_staff_write on public.restaurants
  for all using (public.is_super_admin())
  with check (public.is_super_admin());

-- Perfis: usuário vê o próprio; super admin vê todos; staff vê colegas do mesmo restaurante.
create policy profiles_self on public.profiles
  for select using (
    id = auth.uid()
    or public.is_super_admin()
    or exists (
      select 1 from public.restaurant_users ru1
      join public.restaurant_users ru2 on ru2.restaurant_id = ru1.restaurant_id
      where ru1.user_id = auth.uid() and ru2.user_id = public.profiles.id
    )
  );
create policy profiles_self_update on public.profiles
  for update using (id = auth.uid() or public.is_super_admin());

-- Papéis/permissões: leitura geral para autenticados (necessário para montar UI),
-- escrita só super admin.
create policy roles_read on public.roles for select using (auth.role() = 'authenticated' or public.is_super_admin());
create policy roles_write on public.roles for all using (public.is_super_admin()) with check (public.is_super_admin());
create policy permissions_read on public.permissions for select using (auth.role() = 'authenticated' or public.is_super_admin());
create policy permissions_write on public.permissions for all using (public.is_super_admin()) with check (public.is_super_admin());
create policy role_permissions_read on public.role_permissions for select using (auth.role() = 'authenticated' or public.is_super_admin());
create policy role_permissions_write on public.role_permissions for all using (public.is_super_admin()) with check (public.is_super_admin());

-- Vínculo staff-restaurante: só super admin ou o próprio gerente do restaurante (com permissão users.*) gerencia.
create policy restaurant_users_read on public.restaurant_users
  for select using (public.is_super_admin() or restaurant_id in (select public.user_restaurant_ids()));
create policy restaurant_users_write on public.restaurant_users
  for all using (public.is_super_admin() or public.has_permission('users.edit', restaurant_id))
  with check (public.is_super_admin() or public.has_permission('users.edit', restaurant_id));

create policy user_permissions_all on public.user_permissions
  for all using (public.is_super_admin()) with check (public.is_super_admin());

create policy customer_addresses_owner on public.customer_addresses
  for all using (customer_id = auth.uid() or public.is_super_admin())
  with check (customer_id = auth.uid() or public.is_super_admin());

-- Cardápio: leitura pública (cliente vê o cardápio sem login), escrita restrita.
create policy categories_public_read on public.categories for select using (true);
create policy categories_write on public.categories for all
  using (public.has_permission('menu.edit', restaurant_id))
  with check (public.has_permission('menu.edit', restaurant_id));

create policy products_public_read on public.products for select using (true);
create policy products_write on public.products for all
  using (public.has_permission('product.edit', restaurant_id))
  with check (public.has_permission('product.edit', restaurant_id));

create policy product_option_groups_public_read on public.product_option_groups for select using (true);
create policy product_option_groups_write on public.product_option_groups for all
  using (exists (select 1 from public.products p where p.id = product_id and public.has_permission('product.edit', p.restaurant_id)))
  with check (exists (select 1 from public.products p where p.id = product_id and public.has_permission('product.edit', p.restaurant_id)));

create policy product_options_public_read on public.product_options for select using (true);
create policy product_options_write on public.product_options for all
  using (exists (
    select 1 from public.product_option_groups g join public.products p on p.id = g.product_id
    where g.id = group_id and public.has_permission('product.edit', p.restaurant_id)
  ))
  with check (exists (
    select 1 from public.product_option_groups g join public.products p on p.id = g.product_id
    where g.id = group_id and public.has_permission('product.edit', p.restaurant_id)
  ));

-- Mesas: só staff do restaurante.
create policy tables_staff on public.tables
  for all using (public.has_permission('table.view', restaurant_id))
  with check (public.has_permission('table.manage', restaurant_id));

create policy drivers_staff on public.drivers
  for all using (public.has_permission('delivery.view', restaurant_id))
  with check (public.has_permission('delivery.manage', restaurant_id));

-- Pedidos: staff do restaurante vê tudo do seu restaurante; cliente vê só os próprios.
create policy orders_read on public.orders
  for select using (
    public.has_permission('order.view', restaurant_id)
    or customer_id = auth.uid()
  );
create policy orders_insert on public.orders
  for insert with check (
    public.has_permission('order.create', restaurant_id)
    or customer_id = auth.uid()   -- cliente autenticado cria pedido para si mesmo
  );
create policy orders_update on public.orders
  for update using (public.has_permission('order.edit', restaurant_id));

create policy order_items_read on public.order_items
  for select using (exists (
    select 1 from public.orders o where o.id = order_id
    and (public.has_permission('order.view', o.restaurant_id) or o.customer_id = auth.uid())
  ));
create policy order_items_write on public.order_items
  for all using (exists (
    select 1 from public.orders o where o.id = order_id and public.has_permission('order.edit', o.restaurant_id)
  ))
  with check (exists (
    select 1 from public.orders o where o.id = order_id
    and (public.has_permission('order.create', o.restaurant_id) or o.customer_id = auth.uid())
  ));

create policy order_item_options_rw on public.order_item_options
  for all using (exists (
    select 1 from public.order_items oi join public.orders o on o.id = oi.order_id
    where oi.id = order_item_id and (public.has_permission('order.view', o.restaurant_id) or o.customer_id = auth.uid())
  ));

create policy order_status_history_rw on public.order_status_history
  for all using (exists (
    select 1 from public.orders o where o.id = order_id and public.has_permission('order.view', o.restaurant_id)
  ));

create policy deliveries_rw on public.deliveries
  for all using (exists (
    select 1 from public.orders o where o.id = order_id and public.has_permission('delivery.view', o.restaurant_id)
  ))
  with check (exists (
    select 1 from public.orders o where o.id = order_id and public.has_permission('delivery.manage', o.restaurant_id)
  ));

create policy payments_rw on public.payments
  for all using (exists (
    select 1 from public.orders o where o.id = order_id and public.has_permission('order.view', o.restaurant_id)
  ));

create policy printers_rw on public.printers
  for all using (public.has_permission('printing.view', restaurant_id))
  with check (public.has_permission('printing.manage', restaurant_id));

create policy print_jobs_rw on public.print_jobs
  for all using (public.has_permission('printing.view', restaurant_id))
  with check (public.has_permission('printing.manage', restaurant_id));

create policy audit_logs_read on public.audit_logs
  for select using (
    public.is_super_admin()
    or (restaurant_id is not null and public.has_permission('reports.view', restaurant_id))
  );

-- ============================================================================
-- REALTIME — habilita publicação para o Kanban central ouvir mudanças ao vivo
-- ============================================================================
alter publication supabase_realtime add table public.orders;
alter publication supabase_realtime add table public.order_items;
alter publication supabase_realtime add table public.order_status_history;
alter publication supabase_realtime add table public.tables;
