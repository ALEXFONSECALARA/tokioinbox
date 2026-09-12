-- ═══════════════════════════════════════════════════════════════════════
-- TokioInbox — Fase 4: restaurante ativo/inativo
-- ═══════════════════════════════════════════════════════════════════════
-- Adiciona a coluna `active` na tabela `restaurants` (lista mestre do
-- super-admin). Default true: nenhum restaurante já cadastrado some da
-- vitrine por causa desta migration. Não apaga nada, só cria a coluna.
-- ═══════════════════════════════════════════════════════════════════════

alter table restaurants
  add column if not exists active boolean not null default true;

comment on column restaurants.active is
  'Restaurante desativado não aparece na vitrine pública nem recebe novos pedidos, mas continua no banco e visível/editável no painel admin.';
