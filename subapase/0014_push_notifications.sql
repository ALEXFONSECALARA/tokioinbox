-- ═══════════════════════════════════════════════════════════════════════
-- TokioInbox — Fase 4: central de notificações push + campanhas (27-30)
-- ═══════════════════════════════════════════════════════════════════════

-- Uma inscrição por navegador/dispositivo que aceitou notificações,
-- vinculada ao restaurante cujo cardápio estava aberto quando aceitou.
-- customer_id preenchido = "clientes cadastrados" (item 27, segmento 2);
-- nulo = visitante sem conta que mesmo assim aceitou push (segmento 1,
-- "todos os inscritos" inclui os dois).
create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  restaurant_slug text not null references restaurants(slug) on delete cascade,
  customer_id uuid references customers(id) on delete set null,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create index if not exists push_subscriptions_restaurant_idx on push_subscriptions (restaurant_slug);
create index if not exists push_subscriptions_customer_idx on push_subscriptions (customer_id);

-- Campanhas — tanto um disparo único agendado quanto uma campanha recorrente
-- (item 29/30). `schedule` guarda tudo num jsonb pra não precisar de mais
-- colunas a cada novo tipo de repetição:
--   { "sendAt": "2026-08-30T18:30:00-03:00" }                      → uma vez
--   { "repeat": "daily", "time": "18:00" }                         → todo dia
--   { "repeat": "weekly", "days": [2,3,4], "time": "18:00" }       → dias da semana (0=domingo)
--   { "repeat": "monthly", "dayOfMonth": 1, "time": "09:00" }      → todo mês
create table if not exists notification_campaigns (
  id uuid primary key default gen_random_uuid(),
  restaurant_slug text not null references restaurants(slug) on delete cascade,
  name text not null,
  title text not null,
  message text not null,
  image_url text,
  audience text not null default 'all', -- 'all' | 'customers'
  schedule jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  last_sent_at timestamptz,
  -- Marca até quando essa campanha já disparou nesta janela de repetição,
  -- pra não mandar duas vezes se o servidor reiniciar no mesmo minuto.
  last_sent_window text,
  created_at timestamptz not null default now()
);

create index if not exists notification_campaigns_restaurant_idx on notification_campaigns (restaurant_slug);

comment on table push_subscriptions is
  'Inscrições de push do navegador/dispositivo do visitante ou cliente (Fase 4, item 27).';
comment on table notification_campaigns is
  'Notificação agendada ou campanha recorrente (Fase 4, itens 28-30). Disparo controlado pelo agendador em server/index.js.';
