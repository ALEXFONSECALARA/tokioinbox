-- ═══════════════════════════════════════════════════════════════════════
-- TokioInbox — Fase 4: usuários do painel + permissões granulares (17-19)
-- ═══════════════════════════════════════════════════════════════════════
-- Tabela nova, não mexe em nada existente. O login único por senha
-- (ADMIN_PASSWORD) continua funcionando exatamente como antes — esta
-- tabela é pra usuários INDIVIDUAIS, adicionais a esse acesso mestre.
--
-- restaurant_slug = NULL → usuário com escopo de super-admin (não vinculado
-- a um restaurante específico). Preenchido → usuário só acessa aquele
-- restaurante, a menos que tenha a permissão admin_gerenciar_restaurantes.
--
-- Senha nunca em texto puro: password_hash guarda "salt:hash" (scrypt,
-- ver server/lib/passwords.js). Não existe coluna de senha em texto puro.
-- ═══════════════════════════════════════════════════════════════════════

create table if not exists admin_users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  login text not null unique,
  password_hash text not null,
  restaurant_slug text references restaurants(slug) on delete set null,
  role text not null default 'operador',
  active boolean not null default true,
  permissions jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists admin_users_login_idx on admin_users (login);
create index if not exists admin_users_restaurant_slug_idx on admin_users (restaurant_slug);

comment on table admin_users is
  'Usuários individuais do painel administrativo (Fase 4, itens 17-19). Independente do login mestre por senha única (ADMIN_PASSWORD), que continua ativo.';
comment on column admin_users.password_hash is
  'Formato "salt:hash" (scrypt) — nunca texto puro. Ver server/lib/passwords.js.';
comment on column admin_users.restaurant_slug is
  'NULL = usuário com escopo de super-admin. Preenchido = usuário restrito àquele restaurante (isolamento reforçado no backend, não só no frontend).';
comment on column admin_users.permissions is
  'Mapa {chave: true} das permissões concedidas (catálogo em server/lib/permissions.js). Ausente/false = sem a permissão.';
