-- ═══════════════════════════════════════════════════════════════════════
-- TokioInbox — Vitrine multi-restaurantes / Galeria Gourmet
-- Adiciona os campos de identidade visual usados pela nova Landing "/" e
-- pela seção "🎨 Aparência e Página Inicial" do painel do restaurante.
--
-- 100% aditivo: só ADICIONA colunas com DEFAULT seguro. Não apaga nem
-- altera nada que já existe — restaurantes já cadastrados continuam
-- funcionando exatamente como antes, só sem os novos campos preenchidos
-- (o frontend já trata esses campos como opcionais/undefined).
-- ═══════════════════════════════════════════════════════════════════════

alter table restaurant_configs
  add column if not exists color text,
  add column if not exists secondary_color text,
  add column if not exists layout text not null default 'galeria-gourmet',
  add column if not exists banner_position_x integer not null default 50,
  add column if not exists banner_position_y integer not null default 50,
  add column if not exists banner_zoom integer not null default 100,
  add column if not exists banner_overlay integer not null default 0;

-- splash_images já é jsonb (default '[]') — continua aceitando tanto o
-- formato antigo (array de strings) quanto o novo (array de objetos com
-- positionX/positionY/zoom/overlay/text/enabled). A normalização dos dois
-- formatos acontece no frontend (ver src/utils/helpers.ts, normalizeSplashImage),
-- então nenhuma migração de dados é necessária aqui.
