# FASE 1 — Banco de dados, autenticação real e RBAC multi-restaurante

## O que foi entregue nesta fase

**Arquivos novos:**
- `supabase/migrations/0001_multi_tenant_core.sql` — schema completo: restaurantes, perfis, papéis, permissões granulares, vínculo usuário↔restaurante, permissões individuais por usuário, cardápio, mesas, pedidos, itens, histórico de status, entregas, motoristas, pagamentos, impressão idempotente e auditoria. Todas as tabelas sensíveis têm **Row Level Security (RLS)** habilitado com políticas reais de isolamento por `restaurant_id`.
- `server/db.ts` — cliente Supabase (admin para o backend, e um cliente "em nome do usuário" para respeitar RLS quando fizer sentido).
- `server/authMiddleware.ts` — `requireAuth`, `requirePermission(chave, restaurantId)` e `requireSuperAdmin`. Toda checagem de permissão roda **no banco**, via a função SQL `has_permission_for()`, nunca só no frontend.
- `server/authServiceV2.ts` — criação de funcionários e clientes usando o **Supabase Auth real** (sem hash de senha reinventado, sem senha hardcoded). Inclui `bootstrapFirstSuperAdmin`, que só funciona uma única vez.
- `server/restaurantService.ts` — CRUD de restaurantes com isolamento (criar/editar/desativar só via Super Admin).
- `scripts/create-super-admin.ts` — script de linha de comando para criar o primeiro Super Admin.

**O que NÃO foi alterado ainda (de propósito):** `server.ts`, `orderService.ts`, `authAndDeviceService.ts` (o antigo) e todos os componentes React continuam como estavam, para você conseguir testar a Fase 1 isoladamente antes de eu religar tudo. Nada foi quebrado.

## Passo a passo (uns 5 minutos)

1. **Criar o projeto Supabase**: acesse https://supabase.com/dashboard, crie um projeto novo (grátis). Anote a senha do banco que ele pedir.
2. **Pegar as chaves**: em *Project Settings → API*, copie `Project URL`, `anon public key` e `service_role key`.
3. **Preencher o `.env`**: copie `.env.example` para `.env` e cole os três valores em `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
4. **Rodar a migration**: no painel do Supabase, vá em *SQL Editor*, cole o conteúdo de `supabase/migrations/0001_multi_tenant_core.sql` e execute. (Alternativa: `supabase db push` se você usa a CLI do Supabase.)
5. **Criar o primeiro Super Admin**:
   ```bash
   npm run create-super-admin -- seu-email@exemplo.com "SenhaForte123!" "Seu Nome"
   ```
6. **Confirmar que funcionou**: no painel do Supabase, em *Table Editor → profiles*, você deve ver seu usuário com `is_super_admin = true`. Em *Authentication → Users*, o mesmo e-mail deve aparecer.

## Variáveis de ambiente necessárias a partir de agora

| Variável | Onde usar | Segredo? |
|---|---|---|
| `SUPABASE_URL` | backend e (futuramente) frontend | não |
| `SUPABASE_ANON_KEY` | backend e (futuramente) frontend | não (mas respeita RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | **somente backend** | **sim — nunca no frontend** |
| `GEMINI_API_KEY` | já existia, mantido | sim |

## O que essa fase resolve, item a item do seu briefing

- Seção 2 (Super Admin) e 3 (perfis): papéis reais em tabela (`roles`), não fixos em código.
- Seção 4 (permissões granulares): tabela `permissions` + `role_permissions` + `user_permissions` (override individual por usuário).
- Seção 15 (segurança real): toda API que eu ligar daqui pra frente passa por `requireAuth` + `requirePermission`, e o Postgres reforça com RLS por trás — dois níveis de defesa.
- Seção 16 (autenticação separada): `profiles.user_type` distingue `staff` de `customer`, mesma base de Auth, contextos separados.
- Seção 17 (Supabase/banco): schema criado do zero com relacionamentos e índices; a interface já **dizia** "Supabase + RLS" mas isso era só texto decorativo até agora — a partir desta migration passa a ser verdade.
- Seção 24 (não fazer): removi o padrão de super admin com senha hardcoded no código-fonte (`admin/admin123`). Agora o primeiro Super Admin nasce via script único, com senha escolhida por você.

## O que falta (próximas fases — só entramos aí depois de você validar esta)

- **Fase 2**: migrar `orderService.ts` (hoje um arquivo `data/orders.json`) para as tabelas `orders`/`order_items` do Postgres, com `restaurant_id` em tudo, e ligar o Kanban a isso.
- **Fase 3**: religar `server.ts` e o frontend (`StoreContext.tsx`, telas `Admin*`) para chamar as novas rotas autenticadas em vez do sistema de arquivo antigo; criar as rotas `/admin`, `/restaurante/:slug`, `/operacao` conforme o briefing.
- **Fase 4**: Supabase Realtime ligado no frontend (Kanban, cozinha, sushibar, caixa) ouvindo mudanças em `orders` ao vivo, com reconexão automática.
- **Fase 5**: impressão idempotente usando a tabela `print_jobs` já criada.
- **Fase 6**: os 20 testes ponta a ponta do briefing, e build de produção limpo.

Quer que eu já siga para a Fase 2 (pedidos + Kanban no banco real) assim que você confirmar que conseguiu criar o Super Admin?

---

## FASE 2 — Pedidos reais no Postgres (adicionada)

**Arquivos novos:**
- `supabase/migrations/0002_order_functions.sql` — roda DEPOIS da migration 0001. Cria:
  - `order_status_transitions`: matriz de transições válidas do Kanban (impede pular etapa ou reabrir pedido finalizado/cancelado).
  - `create_order_transactional(...)`: cria pedido + itens + opções em UMA transação atômica. **O preço nunca vem do cliente** — a função busca o preço atual do produto/opção direto na tabela, então ninguém consegue manipular valor mandando requisição manual. Também é idempotente: se você reenviar a mesma `idempotency_key` (ex: por causa de internet instável), ela devolve o pedido já criado em vez de duplicar.
  - `update_order_status_transactional(...)`: só deixa mudar status se a transição estiver na matriz permitida; registra tudo em `order_status_history`.
- `server/orderServiceV2.ts` — chama essas funções, e em toda leitura filtra explicitamente por `restaurant_id`/`customer_id` (nunca um `select *` solto, mesmo usando a chave de serviço que ignora RLS).
- `server/orderRoutes.ts` — rotas REST novas, montadas em `/api/v2/orders`, **sem remover nada das rotas antigas**:
  - `POST /api/v2/orders` — cria pedido (cliente cria pro próprio nome; funcionário precisa de `order.create` no restaurante).
  - `GET /api/v2/orders?restaurantId=...` — Kanban central (exige `order.view`).
  - `GET /api/v2/orders/by-destination/:destination?restaurantId=...` — visão da cozinha/sushibar.
  - `GET /api/v2/orders/mine` — histórico do próprio cliente.
  - `GET /api/v2/orders/:id?restaurantId=...` — detalhe de um pedido.
  - `PATCH /api/v2/orders/:id/status` — muda status (cancelar exige `order.cancel`, finalizar exige `order.close`, resto `order.edit`).

**Rode a migration 0002** do mesmo jeito que a 0001 (SQL Editor do Supabase, colar e executar).

**O que isso resolve do briefing:** seção 8/9 (Kanban único com status controlado), seção 10 (idempotência para não duplicar pedido), seção 11 (pedido com `restaurant_id`, nunca dependendo de localStorage), seção 15 (preço e permissão sempre validados no servidor).

**Ainda não fiz:** religar `server.ts`/frontend para usar `/api/v2/orders` no lugar das rotas antigas de arquivo, criar as rotas de página (`/admin`, `/restaurante/:slug`, `/operacao`), e o Realtime do frontend ouvindo a tabela `orders`. Isso é a Fase 3. Posso seguir?

