-- ═══════════════════════════════════════════════════════════════════════
-- TokioInbox — Fase 4: contas de cliente + endereços salvos (itens 20-22)
-- ═══════════════════════════════════════════════════════════════════════
-- Conta do CLIENTE (não confundir com admin_users, que é do painel). O
-- telefone é o identificador de login (padrão de apps de delivery no
-- Brasil); e-mail é opcional. Conta é global à plataforma — o mesmo
-- cliente pode pedir em vários restaurantes com a mesma conta (item 20).
--
-- Senha nunca em texto puro — mesmo esquema "salt:hash" (scrypt) usado em
-- admin_users, via server/lib/passwords.js.
-- ═══════════════════════════════════════════════════════════════════════

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
  -- 🏠 Casa / 🏢 Trabalho / 📍 Outro (item 21) — texto livre, o rótulo com
  -- emoji é decidido no frontend, aqui só guardamos o nome escolhido.
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

create index if not exists customer_addresses_customer_id_idx on customer_addresses (customer_id);

-- Vincula pedidos ao cliente que os fez (quando logado — pedido de convidado
-- continua funcionando normalmente, só fica com customer_id nulo). Aditivo:
-- não mexe em nenhum pedido existente.
alter table orders add column if not exists customer_id uuid references customers(id) on delete set null;
create index if not exists orders_customer_id_idx on orders (customer_id);

comment on table customers is
  'Conta permanente do cliente final (Fase 4, item 20) — global à plataforma, não por restaurante.';
comment on column customers.password_hash is
  'Formato "salt:hash" (scrypt) — nunca texto puro. Ver server/lib/passwords.js.';
comment on table customer_addresses is
  'Endereços salvos do cliente (Fase 4, item 21) — vários por cliente, com rótulo (Casa/Trabalho/Outro).';
