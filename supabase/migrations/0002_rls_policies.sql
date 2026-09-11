-- ═══════════════════════════════════════════════════════════════════════
-- TokioInbox — Fase 2: Row Level Security (isolamento por restaurant_id)
-- ═══════════════════════════════════════════════════════════════════════
-- IMPORTANTE — leia antes de assumir que isso já "protege tudo" sozinho:
--
-- Hoje (Fase 2) o backend Express é o ÚNICO cliente que fala com o Supabase,
-- e ele usa a SUPABASE_SERVICE_ROLE_KEY (nunca exposta ao navegador). A
-- service role IGNORA RLS por padrão — é o Postgres confiando 100% no
-- backend. O isolamento real entre restaurantes, hoje, é feito pelo próprio
-- código do backend (toda rota deriva o restaurante do :slug da URL, nunca
-- aceita restaurant_id vindo solto do cliente — ver server/lib/db.supabase.js).
--
-- Essas políticas de RLS abaixo são a segunda camada de defesa, pensada pra
-- quando o app passar a falar com o Supabase diretamente do navegador (ex:
-- Supabase Realtime pro Kanban ao vivo, ou o Print Agent autenticando direto
-- no Supabase) — algo que faz parte das fases seguintes, não desta. Sem essa
-- segunda camada, um bug futuro no backend poderia vazar dado entre
-- restaurantes; com RLS, o banco recusa mesmo que o código erre.
--
-- As políticas abaixo assumem um claim customizado `restaurant_id` no JWT de
-- autenticação (via Supabase Auth) do painel de cada restaurante. Esse claim
-- ainda NÃO existe — não há login de restaurante individual implementado
-- ainda (hoje existe um único ADMIN_PASSWORD pra tudo). Portanto, na prática,
-- as políticas "authenticated" abaixo não deixam ninguém passar até essa
-- parte de autenticação por restaurante ser implementada numa fase futura.
-- Isso é intencional: nega por padrão até existir identidade real.
-- ═══════════════════════════════════════════════════════════════════════

alter table restaurants enable row level security;
alter table restaurant_configs enable row level security;
alter table menu_categories enable row level security;
alter table menu_items enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table printers enable row level security;
alter table agents enable row level security;
alter table print_jobs enable row level security;
alter table notifications enable row level security;

-- Helper: extrai o restaurant_id do JWT do usuário autenticado (claim custom).
-- Retorna null se não houver claim (ex: usuário anônimo) — o que faz as
-- políticas "= restaurant_id_claim()" falharem com segurança (nunca dão match).
create or replace function restaurant_id_claim()
returns uuid
language sql stable
as $$
  select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'restaurant_id', '')::uuid
$$;

-- ---------------------------------------------------------------------
-- Dados públicos da vitrine (cardápio + identidade do restaurante):
-- o site de pedidos precisa ler isso sem login, então SELECT é público.
-- Nenhuma dessas tabelas guarda dado pessoal de cliente.
-- ---------------------------------------------------------------------
create policy restaurants_public_read on restaurants
  for select using (true);

create policy restaurant_configs_public_read on restaurant_configs
  for select using (true);

create policy menu_categories_public_read on menu_categories
  for select using (true);

create policy menu_items_public_read on menu_items
  for select using (true);

-- Escrita nessas 4 tabelas: só service_role (o backend, via /api/:slug/config,
-- /api/:slug/menu-items, /api/:slug/categories, todos atrás de requireAdmin).
-- Não criamos policy de INSERT/UPDATE/DELETE para "authenticated"/"anon" —
-- por padrão, sem policy, a operação é negada.

-- ---------------------------------------------------------------------
-- orders / order_items — nunca públicos (têm nome, telefone, endereço do
-- cliente). Só o dono do restaurante (via claim) ou o backend (service_role).
-- ---------------------------------------------------------------------
create policy orders_restaurant_isolated on orders
  for all
  using (restaurant_id = restaurant_id_claim())
  with check (restaurant_id = restaurant_id_claim());

create policy order_items_restaurant_isolated on order_items
  for all
  using (restaurant_id = restaurant_id_claim())
  with check (restaurant_id = restaurant_id_claim());

-- ---------------------------------------------------------------------
-- printers / agents / print_jobs / notifications (Fase 3) — mesmo padrão.
-- ---------------------------------------------------------------------
create policy printers_restaurant_isolated on printers
  for all
  using (restaurant_id = restaurant_id_claim())
  with check (restaurant_id = restaurant_id_claim());

create policy agents_restaurant_isolated on agents
  for all
  using (restaurant_id = restaurant_id_claim())
  with check (restaurant_id = restaurant_id_claim());

create policy print_jobs_restaurant_isolated on print_jobs
  for all
  using (restaurant_id = restaurant_id_claim())
  with check (restaurant_id = restaurant_id_claim());

create policy notifications_restaurant_isolated on notifications
  for all
  using (restaurant_id = restaurant_id_claim())
  with check (restaurant_id = restaurant_id_claim());
