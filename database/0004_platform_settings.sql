-- ═══════════════════════════════════════════════════════════════════════
-- TokioInbox — Configurações globais da vitrine "/" (título, subtítulo,
-- layout). Diferente de restaurant_configs: isto NÃO pertence a nenhum
-- restaurante, é a configuração da página inicial compartilhada.
-- Tabela de uma linha só (id fixo) — mesmo padrão usado por outras tabelas
-- de "singleton" em Postgres.
-- ═══════════════════════════════════════════════════════════════════════

create table if not exists platform_settings (
  id boolean primary key default true,
  landing_title text not null default 'Escolha seu restaurante',
  landing_subtitle text not null default 'Cada loja tem seu próprio cardápio e pedidos',
  landing_layout text not null default 'galeria-gourmet',
  updated_at timestamptz not null default now(),
  constraint platform_settings_singleton check (id)
);

insert into platform_settings (id) values (true)
  on conflict (id) do nothing;

-- Mesmo padrão de 0002_rls_policies.sql: leitura pública (a Landing "/" lê
-- sem login), escrita só via service_role (backend, atrás de requireAdmin).
alter table platform_settings enable row level security;
create policy platform_settings_public_read on platform_settings
  for select using (true);

