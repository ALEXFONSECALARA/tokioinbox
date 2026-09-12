-- ═══════════════════════════════════════════════════════════════════════
-- TokioInbox — Fase 4: ajuste operacional em tempo real (itens 14-16)
-- ═══════════════════════════════════════════════════════════════════════
-- Aditivo e opcional: ausente = 'normal' / +0min, tempo padrão exibido puro
-- (comportamento de sempre). O histórico é capado em 50 entradas pelo
-- backend (server/index.js), não aqui — a coluna aceita qualquer array.
-- ═══════════════════════════════════════════════════════════════════════

alter table restaurant_configs
  add column if not exists operational_status text,
  add column if not exists operational_adjustment_minutes integer not null default 0,
  add column if not exists operational_adjustment_history jsonb not null default '[]'::jsonb;

comment on column restaurant_configs.operational_status is
  'normal (padrão/ausente) | busy | delayed — só informativo pro painel, quem afeta o tempo exibido é operational_adjustment_minutes.';
comment on column restaurant_configs.operational_adjustment_minutes is
  'Minutos somados ao tempo padrão de cada zona/faixa na hora de exibir ao cliente. 0 = tempo padrão puro.';
comment on column restaurant_configs.operational_adjustment_history is
  'Histórico dos últimos ajustes (mais recente primeiro), capado a 50 entradas: [{id,timestamp,previousMinutes,newMinutes,status,reason}]';
