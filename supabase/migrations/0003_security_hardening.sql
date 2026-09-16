-- ============================================================================
-- FASE 3 — Hardening de segurança
-- ============================================================================
-- Por padrão o Postgres concede EXECUTE em funções novas para o role PUBLIC,
-- e no Supabase os roles `anon`/`authenticated` herdam isso. Como o frontend
-- agora fala direto com o Supabase (para tabelas com RLS simples, como
-- `tables`, `categories`, `products`), precisamos garantir que as funções
-- "privilegiadas" — que fazem a criação/transição de pedido e as checagens de
-- permissão por user_id explícito — só possam ser chamadas pelo backend
-- (service_role), nunca diretamente pelo navegador driblando o Express.
-- ============================================================================

revoke execute on function public.create_order_transactional(
  uuid, text, text, uuid, uuid, uuid, text, text, jsonb, text, numeric, numeric, text, jsonb
) from public, anon, authenticated;

revoke execute on function public.update_order_status_transactional(
  uuid, text, uuid, text
) from public, anon, authenticated;

revoke execute on function public.has_permission_for(uuid, text, uuid) from public, anon, authenticated;
revoke execute on function public.is_super_admin_for(uuid) from public, anon, authenticated;
revoke execute on function public.user_restaurant_ids_for(uuid) from public, anon, authenticated;

-- As variantes usadas DENTRO das políticas de RLS (baseadas em auth.uid(), ou
-- seja, no contexto do próprio usuário logado) continuam acessíveis, pois são
-- chamadas implicitamente pelo motor de RLS quando o usuário lê/escreve uma
-- tabela através do client do navegador — isso é esperado e seguro.
grant execute on function public.is_super_admin() to authenticated, anon;
grant execute on function public.user_restaurant_ids() to authenticated, anon;
grant execute on function public.has_permission(text, uuid) to authenticated, anon;
