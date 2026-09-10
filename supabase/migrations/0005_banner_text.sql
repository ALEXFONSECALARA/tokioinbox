-- ═══════════════════════════════════════════════════════════════════════
-- TokioInbox — texto opcional sobre a capa do restaurante
-- Item 3 do prompt original ("texto opcional" na capa) ainda não tinha
-- coluna correspondente. 100% aditivo: só adiciona uma coluna nullable,
-- sem default obrigatório — restaurantes existentes continuam sem texto
-- (comportamento idêntico ao atual) até que alguém preencha no painel.
-- ═══════════════════════════════════════════════════════════════════════

alter table restaurant_configs
  add column if not exists banner_text text;
