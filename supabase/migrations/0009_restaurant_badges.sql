-- ═══════════════════════════════════════════════════════════════════════
-- TokioInbox — Fase 4: badges/etiquetas de pratos editáveis por restaurante
-- ═══════════════════════════════════════════════════════════════════════
-- Cada restaurante ganha sua própria biblioteca de badges (nome, emoji, cor,
-- ordem = posição no array, ativo/inativo). Ausente = usa os 8 badges
-- padrão (DEFAULT_BADGES no frontend) — nenhum restaurante existente perde
-- os badges que já usava, porque os IDs dos badges padrão são os mesmos
-- valores que já estavam salvos em menu_items.tags.
-- ═══════════════════════════════════════════════════════════════════════

alter table restaurant_configs
  add column if not exists badges jsonb not null default '[]'::jsonb;

comment on column restaurant_configs.badges is
  'Biblioteca de badges/etiquetas de pratos deste restaurante: [{id,label,emoji,color,active}]. Vazio = usa os padrões do frontend.';
