-- ═══════════════════════════════════════════════════════════════════════
-- TokioInbox — Fase 4: categorias com imagem opcional e ativo/inativo
-- ═══════════════════════════════════════════════════════════════════════
-- `sort_order` já existia desde a 0001 (é o que já dá a ordem editável).
-- Aqui só adicionamos o que faltava: foto opcional da categoria e a
-- possibilidade de ocultá-la sem apagar (nem apagar os produtos dela).
-- ═══════════════════════════════════════════════════════════════════════

alter table menu_categories
  add column if not exists image text,
  add column if not exists active boolean not null default true;
