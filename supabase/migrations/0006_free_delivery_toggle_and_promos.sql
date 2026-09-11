-- ═══════════════════════════════════════════════════════════════════════
-- TokioInbox — frete grátis com liga/desliga + banner de promoções configurável
-- Aditivo: só adiciona colunas novas, com default que preserva o
-- comportamento atual (frete grátis continua ativo por padrão; nenhum
-- restaurante existente ganha promoção nova sozinho — a lista começa vazia).
-- ═══════════════════════════════════════════════════════════════════════

alter table restaurant_configs
  add column if not exists free_delivery_enabled boolean not null default true,
  add column if not exists promo_badges jsonb not null default '[]'::jsonb;
