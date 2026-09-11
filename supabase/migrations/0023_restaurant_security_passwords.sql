-- TokioInbox — senhas de segurança por restaurante (Kanban individual e
-- limpeza de histórico).
--
-- Bug corrigido aqui: o campo "🔒 Senhas de segurança" já existia no painel
-- (Configurações) e a rota PUT /api/:slug/config já sabia gerar o hash e
-- tentar salvar `kanban_password_hash` / `history_clear_password_hash`, mas
-- essas duas colunas NUNCA foram criadas em nenhuma migration — então em
-- produção (Supabase) o salvamento parecia funcionar ("Configurações salvas
-- com sucesso!"), mas a senha nunca era persistida de verdade: o valor era
-- descartado silenciosamente antes mesmo de chegar ao banco.
--
-- Execute este arquivo no SQL Editor do MESMO projeto Supabase usado pelo
-- Render e depois recarregue o cache de schema do PostgREST (Settings → API
-- → "Reload schema", ou rode `NOTIFY pgrst, 'reload schema';` no SQL
-- Editor) — sem isso a API continua respondendo PGRST204/PGRST205 mesmo
-- com a coluna já existindo.

alter table restaurant_configs
  add column if not exists kanban_password_hash text,
  add column if not exists history_clear_password_hash text;

notify pgrst, 'reload schema';
