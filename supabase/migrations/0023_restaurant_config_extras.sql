-- TokioInbox — extras de configuração por restaurante: senhas de segurança
-- (Kanban individual e limpeza de histórico) e o toggle de tema visual
-- "premium" do cardápio.
--
-- Bug corrigido aqui: o campo "🔒 Senhas de segurança" já existia no painel
-- (Configurações) e a rota PUT /api/:slug/config já sabia gerar o hash e
-- tentar salvar `kanban_password_hash` / `history_clear_password_hash`, mas
-- essas duas colunas NUNCA foram criadas em nenhuma migration — então em
-- produção (Supabase) o salvamento parecia funcionar ("Configurações salvas
-- com sucesso!"), mas a senha nunca era persistida de verdade: o valor era
-- descartado silenciosamente antes mesmo de chegar ao banco.
--
-- `premium_theme` substitui um if/else hardcoded no código
-- (`restaurantSlug === 'japones'`) que dava um tema visual dourado/escuro só
-- pro restaurante de exemplo com esse slug específico — agora é uma opção
-- de configuração como qualquer outra, disponível pra qualquer restaurante.
--
-- Execute este arquivo no SQL Editor do MESMO projeto Supabase usado pelo
-- Render e depois recarregue o cache de schema do PostgREST (Settings → API
-- → "Reload schema", ou rode `NOTIFY pgrst, 'reload schema';` no SQL
-- Editor) — sem isso a API continua respondendo PGRST204/PGRST205 mesmo
-- com a coluna já existindo.

alter table restaurant_configs
  add column if not exists kanban_password_hash text,
  add column if not exists history_clear_password_hash text,
  add column if not exists premium_theme boolean not null default false;

notify pgrst, 'reload schema';
