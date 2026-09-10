-- TokioInbox — completa as colunas de restaurant_configs usadas pelo painel.
-- Migration idempotente: pode ser executada mesmo se algumas colunas já existirem.

alter table public.restaurant_configs
  add column if not exists color text,
  add column if not exists secondary_color text,
  add column if not exists layout text not null default 'galeria-gourmet',
  add column if not exists banner_position_x integer not null default 50,
  add column if not exists banner_position_y integer not null default 50,
  add column if not exists banner_zoom integer not null default 100,
  add column if not exists banner_overlay integer not null default 0,
  add column if not exists banner_text text,
  add column if not exists free_delivery_enabled boolean not null default true,
  add column if not exists promo_badges jsonb not null default '[]'::jsonb,
  add column if not exists badges jsonb not null default '[]'::jsonb,
  add column if not exists restaurant_location jsonb,
  add column if not exists delivery_calc_method text,
  add column if not exists delivery_hybrid_priority jsonb,
  add column if not exists cep_ranges jsonb not null default '[]'::jsonb,
  add column if not exists distance_tiers jsonb not null default '[]'::jsonb,
  add column if not exists delivery_formula jsonb,
  add column if not exists max_delivery_radius_km numeric,
  add column if not exists operational_status text,
  add column if not exists operational_adjustment_minutes integer not null default 0,
  add column if not exists operational_adjustment_history jsonb not null default '[]'::jsonb;

-- Garante que a estrutura-base da sequência exista também em bancos antigos.
alter table public.restaurant_configs
  add column if not exists splash_enabled boolean not null default false,
  add column if not exists splash_images jsonb not null default '[]'::jsonb,
  add column if not exists splash_duration_seconds integer;
