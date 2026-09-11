-- ═══════════════════════════════════════════════════════════════════════
-- TokioInbox — Fase 2: Schema multi-restaurante no Supabase
-- Projeto: ojztmcnghgsrvstmasnc (usar o projeto já existente — não criar outro)
-- ═══════════════════════════════════════════════════════════════════════
-- Como aplicar:
--   1. Supabase Dashboard → SQL Editor → cole este arquivo → Run
--      (ou via CLI: supabase db push, se o projeto estiver linkado)
--   2. Depois rode 0002_rls_policies.sql
--   3. Depois rode o script scripts/migrate-to-supabase.mjs pra importar os
--      dados que já existem em server/data/restaurants/*.json
--
-- Este arquivo só CRIA estrutura. Não apaga nada. Pode ser rodado num
-- projeto Supabase vazio com segurança.
-- ═══════════════════════════════════════════════════════════════════════

create extension if not exists "pgcrypto";

-- Função utilitária pra manter updated_at sempre em dia
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ---------------------------------------------------------------------
-- restaurants — identidade básica (equivalente a server/data/restaurants.json)
-- ---------------------------------------------------------------------
create table if not exists restaurants (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  emoji text,
  color text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger restaurants_set_updated_at
  before update on restaurants
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- restaurant_configs — 1:1 com restaurants (equivalente a config.json)
-- ---------------------------------------------------------------------
create table if not exists restaurant_configs (
  restaurant_id uuid primary key references restaurants(id) on delete cascade,
  tagline text,
  logo text,
  banner_image text,
  phone text,
  whatsapp text,
  address text,
  is_open boolean not null default true,
  opening_hours text,
  delivery_fee numeric(10,2) not null default 0,
  free_delivery_threshold numeric(10,2),
  minimum_order numeric(10,2) not null default 0,
  estimated_delivery_time text,
  delivery_zones jsonb not null default '[]',
  drivers jsonb not null default '[]',
  pix_key text,
  pix_key_type text,
  instagram text,
  allow_table_orders boolean not null default false,
  total_tables integer not null default 0,
  splash_enabled boolean not null default false,
  splash_images jsonb not null default '[]',
  splash_duration_seconds integer,
  -- Preferências de impressão (a automação de fato é implementada na Fase 3
  -- com print_jobs/printers/agents abaixo — aqui só a preferência do restaurante)
  print_paper_width text default '80mm',
  print_auto_new_orders boolean not null default false,
  updated_at timestamptz not null default now()
);
create trigger restaurant_configs_set_updated_at
  before update on restaurant_configs
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- menu_categories / menu_items (equivalente a menu.json)
-- Mantemos os IDs de texto originais (ex: "sushi", "j1") pra não quebrar
-- pedidos/cardápios já existentes durante a migração.
-- ---------------------------------------------------------------------
create table if not exists menu_categories (
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  id text not null,
  name text not null,
  icon text,
  description text,
  sort_order integer not null default 0,
  primary key (restaurant_id, id)
);

create table if not exists menu_items (
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  id text not null,
  category_id text not null,
  name text not null,
  description text,
  price numeric(10,2) not null default 0,
  original_price numeric(10,2),
  image text,
  available boolean not null default true,
  tags jsonb not null default '[]',
  preparation_time_minutes integer,
  serves_count integer,
  calories integer,
  choices jsonb not null default '[]',
  extras jsonb not null default '[]',
  allow_special_notes boolean not null default false,
  -- Setor de preparo/impressão (Sushi Bar, Cozinha, Bar, Caixa...). Coluna já
  -- criada agora para a Fase 3 (impressão por setor) não exigir nova migração.
  sector text not null default 'cozinha',
  sort_order integer not null default 0,
  primary key (restaurant_id, id),
  foreign key (restaurant_id, category_id)
    references menu_categories(restaurant_id, id) on delete restrict
);
create index if not exists menu_items_restaurant_category_idx
  on menu_items(restaurant_id, category_id);

-- ---------------------------------------------------------------------
-- orders / order_items (equivalente a orders.json)
-- id é o mesmo texto gerado hoje pelo cliente (ex: "ord-1735599999999") —
-- preservado de propósito pra não quebrar links/QR codes de pedidos já enviados.
-- ---------------------------------------------------------------------
create table if not exists orders (
  id text primary key,
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  order_number integer not null,
  order_type text not null,
  status text not null default 'recebido',
  customer jsonb not null default '{}',
  subtotal numeric(10,2) not null default 0,
  delivery_fee numeric(10,2) not null default 0,
  discount numeric(10,2) not null default 0,
  coupon_code text,
  total numeric(10,2) not null default 0,
  payment_method text,
  card_brand text,
  cash_change_for numeric(10,2),
  driver jsonb,
  estimated_minutes integer,
  cancel_reason text,
  notes text,
  status_history jsonb not null default '[]',
  created_at timestamptz not null default now()
);
create index if not exists orders_restaurant_created_idx
  on orders(restaurant_id, created_at desc);
create index if not exists orders_restaurant_status_idx
  on orders(restaurant_id, status);

create table if not exists order_items (
  order_id text not null references orders(id) on delete cascade,
  id text not null,
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  menu_item_id text,
  name text not null,
  category_id text,
  sector text,
  quantity integer not null default 1,
  unit_price numeric(10,2) not null default 0,
  total_price numeric(10,2) not null default 0,
  selected_choices jsonb not null default '[]',
  selected_extras jsonb not null default '[]',
  special_notes text,
  -- Snapshot completo do MenuItem no momento do pedido (imagem, tags, grupos
  -- de escolha etc.). Guardado por inteiro de propósito: o cardápio pode
  -- mudar ou o item pode ser removido depois, mas o pedido histórico e o
  -- cupom impresso precisam continuar mostrando exatamente o que o cliente
  -- pediu naquele momento — igual ao comportamento atual em orders.json,
  -- que grava o objeto do pedido como o cliente enviou, sem normalizar.
  menu_item_snapshot jsonb not null default '{}',
  primary key (order_id, id)
);
create index if not exists order_items_restaurant_idx on order_items(restaurant_id);

-- ---------------------------------------------------------------------
-- Fase 3 (impressão automática real) — tabelas criadas agora para não exigir
-- outra migração depois. Nenhuma rota do backend usa estas tabelas ainda.
-- ---------------------------------------------------------------------
create table if not exists printers (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  label text not null,
  station text not null,          -- caixa | cozinha | sushibar | bar | expedicao
  interface text not null,        -- ex: "printer:NOME_WINDOWS" ou "tcp://192.168.1.51:9100"
  width integer not null default 48,
  paper_size text not null default '80mm',
  font_size text not null default 'normal',
  copies integer not null default 1,
  active boolean not null default true,
  auto_print boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists printers_restaurant_idx on printers(restaurant_id);
create trigger printers_set_updated_at
  before update on printers
  for each row execute function set_updated_at();

create table if not exists agents (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  agent_key text unique not null,     -- credencial que o Print Agent usa pra autenticar
  name text,
  station_id text,
  status text not null default 'offline', -- online | offline
  last_seen_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists agents_restaurant_idx on agents(restaurant_id);

create table if not exists print_jobs (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  order_id text references orders(id) on delete cascade,
  station text not null,
  printer_id uuid references printers(id),
  type text not null default 'AUTO',       -- AUTO | MANUAL_REPRINT | TEST
  status text not null default 'PENDING',  -- PENDING|CLAIMED|PRINTING|PRINTED|FAILED|CANCELLED
  attempts integer not null default 0,
  agent_id uuid references agents(id),
  claimed_at timestamptz,
  printed_at timestamptz,
  failed_at timestamptz,
  error text,
  created_at timestamptz not null default now()
);
create index if not exists print_jobs_restaurant_status_idx on print_jobs(restaurant_id, status);
create index if not exists print_jobs_order_idx on print_jobs(order_id);

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  type text not null,
  payload jsonb not null default '{}',
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists notifications_restaurant_idx on notifications(restaurant_id);
