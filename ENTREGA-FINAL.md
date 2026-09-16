# ENTREGA — Multi-Restaurantes: status real de todas as fases

Este documento é a seção 26 do seu briefing (entrega final), com uma diferença: em vez de te dizer "está tudo pronto e testado", vou te dizer exatamente o que **eu verifiquei** (compilação, build, lógica) versus o que **só pode ser confirmado com o Supabase real + clique na tela** — porque eu não tenho acesso a um navegador nem a um banco Supabase ao vivo neste ambiente. Isso é proposital: seu próprio briefing (seção 24) pede pra não mascarar erros nem fingir que algo funciona sem testar. Prefiro te dar esse mapa exato do que confiar cegamente.

---

## 1. Arquivos alterados/criados, por fase

### Fase 1 — Banco, RBAC, multi-tenant
- `supabase/migrations/0001_multi_tenant_core.sql` (novo)
- `server/db.ts`, `server/authMiddleware.ts`, `server/authServiceV2.ts`, `server/restaurantService.ts` (novos)
- `scripts/create-super-admin.ts` (novo)
- `.env.example`, `package.json` (editados — só adições)

### Fase 2 — Pedidos reais no Postgres
- `supabase/migrations/0002_order_functions.sql` (novo)
- `server/orderServiceV2.ts`, `server/orderRoutes.ts` (novos)
- `server.ts` (editado — 3 linhas adicionadas: import + `app.use('/api/v2/orders', ...)`)

### Fase 3 — Sessão/perfil real, roteamento e frontend operacional
- `supabase/migrations/0003_security_hardening.sql` (novo — trava as funções privilegiadas para não serem chamadas direto do navegador)
- `server/meRoutes.ts` (novo)
- `src/lib/supabaseClient.ts`, `src/lib/operationalData.ts`, `src/lib/ordersApi.ts` (novos)
- `src/context/AuthContext.tsx` (novo)
- `src/hooks/useRealtimeOrders.ts` (novo — também é a Fase 4)
- `src/components/WaiterView.tsx`, `CaixaView.tsx`, `KitchenView.tsx`, `DeliveryView.tsx`, `KanbanBoard.tsx`, `OperacaoRouter.tsx`, `StaffLoginScreen.tsx` (novos)
- `src/App.tsx` (editado): rotas `/operacao`, `/garcom`, `/pedidos` passam a usar sessão real; a tela `/admin` (inclusive via Alt+A) agora exige uma sessão real de Super Admin antes de mostrar qualquer coisa — a seção 15/24 do briefing ("não confiar em esconder botão") estava sendo violada antes disso.
- `src/vite-env.d.ts` (novo — tipagem das variáveis de ambiente do Vite)
- `server.ts` (editado): rotas `/api/v2/me` e `/api/v2/print-jobs` adicionadas.

### Fase 5 — Impressão idempotente
- `server/printJobServiceV2.ts`, `server/printJobRoutes.ts` (novos)
- Ligado automaticamente: `orderRoutes.ts` chama a fila de impressão ao criar pedido e ao mudar status (pronto/em_entrega), sempre com `idempotency_key` única.

### Fase 6 — Build
- `npm run build` e `npx tsc --noEmit` rodados e passando limpos (ver seção 4).

**Nada do que já existia foi apagado.** `server/orderService.ts` (arquivo antigo baseado em `data/orders.json`), `server/authAndDeviceService.ts`, `StoreContext.tsx` e os ~25 componentes `Admin*.tsx` continuam no repositório e funcionando como antes.

---

## 2. Tabelas/migrations criadas

Rode as 3 migrations nesta ordem no SQL Editor do Supabase:
1. `0001_multi_tenant_core.sql` — todas as tabelas (restaurants, profiles, roles, permissions, role_permissions, restaurant_users, user_permissions, customer_addresses, categories, products, product_option_groups, product_options, tables, drivers, orders, order_items, order_item_options, order_status_history, deliveries, payments, printers, print_jobs, audit_logs) + RLS + seed de papéis/permissões padrão.
2. `0002_order_functions.sql` — `order_status_transitions`, `create_order_transactional()`, `update_order_status_transactional()`.
3. `0003_security_hardening.sql` — revoga acesso direto do navegador às funções privilegiadas.

## 3. APIs criadas

| Rota | Método | Protegida por | O que faz |
|---|---|---|---|
| `/api/v2/orders` | POST | `requireAuth` + (`order.create` ou cliente autenticado) | Cria pedido, preço calculado no servidor, idempotente |
| `/api/v2/orders?restaurantId=` | GET | `order.view` | Kanban central |
| `/api/v2/orders/by-destination/:destino` | GET | `order.view` | Fila da cozinha/sushibar |
| `/api/v2/orders/mine` | GET | cliente autenticado | Histórico do próprio cliente |
| `/api/v2/orders/:id` | GET | `order.view` | Detalhe do pedido |
| `/api/v2/orders/:id/status` | PATCH | `order.edit`/`order.close`/`order.cancel` conforme a transição | Muda status com transição validada |
| `/api/v2/me` | GET | `requireAuth` | Perfil + restaurantes/papéis do usuário logado |
| `/api/v2/print-jobs` | GET | `printing.view` | Fila de impressão pendente |
| `/api/v2/print-jobs/:id/printed` | PATCH | `printing.manage` | Marca job como impresso |

Além disso, o frontend fala **direto com o Supabase** (via `supabase-js`, protegido por RLS) para leitura/escrita de `tables`, `categories` e `products` — não duplica lógica de backend pra isso porque a política de RLS já filtra por restaurante e permissão.

## 4. Rotas de página criadas

- `/operacao`, `/garcom`, `/pedidos` → `OperacaoRouter`: identifica o usuário logado e mostra Mesas (garçom), Balcão+Kanban+Delivery (caixa), fila da estação (cozinha/sushibar), entregas (motoboy), ou o painel completo (gerente/super admin).
- `/admin` (e o atalho Alt+A que já existia) → agora exige sessão real de Super Admin antes de renderizar qualquer coisa.
- **Pendente**: `/restaurante/:slug` e `/restaurante/:slug/cardapio` como vitrine pública ligada às tabelas novas do Supabase. Hoje a vitrine (`HomeHub`/`StoreContext`) ainda usa a lista de restaurantes do sistema antigo — ver seção "O que ficou pendente" abaixo.

## 5. Permissões implementadas

`restaurant.view/edit`, `menu.view/edit`, `product.view/create/edit/delete`, `table.view/manage`, `order.view/create/edit/cancel/close`, `delivery.view/manage`, `users.view/create/edit/delete`, `reports.view`, `printing.view/manage`, `settings.view/edit` — exatamente as da seção 4 do briefing, com mapeamento padrão por papel e possibilidade de override individual por usuário via `user_permissions`.

## 6. Como criar o primeiro Super Admin

```bash
npm run create-super-admin -- seu-email@exemplo.com "SenhaForte123!" "Seu Nome"
```
Só funciona uma vez (o script recusa se já existir um super admin).

## 7. Variáveis de ambiente necessárias

```
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...        # só no backend, nunca no frontend
VITE_SUPABASE_URL=...                # mesmo valor de SUPABASE_URL
VITE_SUPABASE_ANON_KEY=...           # mesmo valor de SUPABASE_ANON_KEY
GEMINI_API_KEY=...                   # já existia
```

## 8. Build

- `npx tsc --noEmit` → **0 erros**.
- `npm run build` (vite build + esbuild do server) → **build de produção concluído sem erros**. Único aviso é sobre tamanho de chunk (1.3MB), que é um problema de performance preexistente do projeto (SPA grande, sem code-splitting), não um erro — não mexi nisso para não arriscar quebrar algo fora do escopo pedido.

---

## 9. Checklist dos 20 testes — status real

| # | Teste | Status |
|---|---|---|
| 1 | Super Admin cria restaurante | ✅ Lógica pronta e tipada (`restaurantService.ts`). **Precisa** de um Supabase real rodando pra confirmar na prática. |
| 2 | Super Admin cria usuário Garçom | ✅ Lógica pronta (`authServiceV2.createStaffUser`). Falta uma tela de admin pra isso — hoje só dá pra fazer via chamada direta da função/API; **não construí uma UI de "criar usuário" nova** (a antiga `AdminUsers.tsx` ainda fala com o sistema de arquivo antigo). |
| 3 | Garçom não acessa /admin | ✅ Verificado no código: `AdminAuthGate` bloqueia sem sessão de super admin real. |
| 4 | Garçom acessa só suas funções | ✅ `OperacaoRouter` só monta `WaiterView` pro papel `garcom`, e a RLS do banco reforça isso na leitura de `tables`. |
| 5 | Cliente visualiza restaurantes | ⚠️ **Pendente** — vitrine ainda não migrada pra ler `restaurants` do Supabase (ver seção 10). |
| 6 | Cliente abre restaurante | ⚠️ Mesmo motivo do teste 5. |
| 7 | Cliente faz pedido | ⚠️ O backend aceita (`source: 'online'`), mas a tela de checkout do cliente (`CheckoutModal.tsx`) ainda não foi religada pra chamar `/api/v2/orders`. |
| 8 | Pedido aparece automaticamente no Kanban | ✅ Lógica de realtime pronta (`useRealtimeOrders` + Supabase Realtime habilitado na migration). Precisa de teste com dois dispositivos reais. |
| 9 | Pedido aparece pro caixa | ✅ Mesmo mecanismo do teste 8, dentro de `CaixaView`. |
| 10 | Pedido aparece pra cozinha/sushibar conforme os itens | ✅ `create_order_transactional` grava `destination` por item; `KitchenView` filtra por destino. |
| 11 | Mudança de status sincroniza em todos os dispositivos | ✅ Mesmo mecanismo de realtime; testável só ao vivo. |
| 12 | Garçom adiciona item à mesa | ✅ Fluxo completo em `WaiterView`/`TableOrderView`. |
| 13 | Garçom solicita conta | ✅ Botão "Solicitar Conta" muda `tables.status` pra `aguardando_conta`. |
| 14 | Caixa cria pedido pelo balcão | ✅ `CaixaView` reaproveita o fluxo de mesas; falta só uma opção explícita "sem mesa" pro balcão puro (hoje sempre pede uma mesa/local — ajuste pequeno se você quiser). |
| 15 | Cliente não acessa dados administrativos | ✅ Verificado por RLS + `OperacaoRouter` bloqueando clientes. |
| 16 | Restaurante A não acessa dados do B | ✅ Verificado na lógica: toda função de backend filtra por `restaurant_id`, e RLS reforça no nível do banco. **Recomendo fortemente testar isso na prática** antes de ir pra produção — é o teste mais crítico de todos. |
| 17 | Internet instável / reconexão | ✅ Coberto pelo `useRealtimeOrders` (reconciliação ao reconectar) + Supabase Realtime reconecta sozinho. Só testável ao vivo. |
| 18 | Atualização simultânea celular/computador | ✅ Mesmo mecanismo; só testável ao vivo com dois dispositivos. |
| 19 | Impressão sem duplicação | ✅ Garantido por constraint `unique(restaurant_id, idempotency_key)` no banco — duplicar é fisicamente impossível na tabela, não só "evitado por lógica". |
| 20 | Build de produção | ✅ **Confirmado nesta sessão** — `npm run build` passou sem erros. |

---

## 10. O que ficou pendente (sendo direto, sem mascarar)

Isso é o mais importante desta entrega: onde a "Fase 3" de religar tudo ainda não terminou.

1. **Vitrine pública do cliente** (`HomeHub.tsx`) ainda lista restaurantes vindos do `StoreContext` antigo, não da tabela `restaurants` nova. Pra funcionar de ponta a ponta (testes 5, 6, 7), isso precisa ser religado.
2. **Checkout do cliente** (`CheckoutModal.tsx`) ainda não chama `/api/v2/orders` — continua no fluxo antigo.
3. **AdminLayout** (painel do gerente/super admin) ainda usa o login e os dados antigos (`StoreContext`) por dentro. O `AdminAuthGate` que eu criei garante que só um Super Admin de verdade chega até ele, mas uma vez lá dentro, os dados (usuários, cardápio, etc.) ainda são os do sistema de arquivo antigo — as telas de gerenciar usuário/permissão que criei existem como *serviço* (`authServiceV2.ts`) mas não como *tela nova*.
4. **Criar restaurante/usuário pela interface**: a lógica existe e está testada por tipo, mas não montei formulários novos pra isso — hoje seria via chamada de API direta (Postman/curl) ou eu construir as telas, se você quiser que eu continue.
5. Os testes marcados ⚠️ ou "só testável ao vivo" realmente precisam do Supabase real + um clique na tela pra ter certeza — eu me policiei pra não te dizer "passou" numa coisa que não rodei de verdade.

Quer que eu continue e feche os itens 1–4 (religar vitrine, checkout e as telas de gestão dentro do AdminLayout)? É o que resta pra bater o fluxo ponta a ponta inteiro que você pediu na seção "Prioridade Absoluta".

---

## FASE 7 — Otimização de rede, modernização e módulos adicionais

Atendendo aos pedidos seguintes (rede/performance, bugs/modernização, CMV/IA, fluxo POS):

### Rede e performance
- **Gzip/Brotli**: middleware `compression()` ligado no `server.ts` — todas as respostas de API e assets comprimidos automaticamente.
- **Requisição condicional (ETag)**: `GET /api/v2/orders` agora responde `304 Not Modified` quando nada mudou desde a última consulta (fingerprint por id+status+updated_at). O frontend (`ordersApi.ts`) reaproveita os dados em cache nesse caso — zero bytes de JSON re-baixados à toa.
- **Page Visibility API**: `src/hooks/usePageVisibility.ts` + `src/hooks/useSmartPolling.ts` — pausa qualquer polling quando a aba vai pra segundo plano, e faz backoff exponencial em erro de rede em vez de martelar o servidor. (O Kanban/Cozinha/Delivery já usam Supabase Realtime — push, não polling — então isso é reservado pra pontos que ainda dependem de polling, como um futuro agente de impressão local.)
- **Cache local (IndexedDB)**: `src/lib/operationalData.ts` → `getMenuInstant()` guarda o cardápio no IndexedDB (via `idb-keyval`) e usa padrão *stale-while-revalidate*: a tela do garçom mostra o cardápio salvo instantaneamente e atualiza em segundo plano.

### Modernização / bugs
- **Toasts**: `src/context/ToastContext.tsx` substitui `alert()` por notificações visuais não-bloqueantes (usado no Kanban e no fluxo de Balcão/Delivery).
- **Reconexão automática**: `src/lib/fetchWithRetry.ts` — retry com backoff exponencial em erro de rede/5xx, plugado em todas as chamadas de `ordersApi.ts`. Falha momentânea de wi-fi no salão não derruba a tela do operador.
- **Dependências**: instalei `compression`, `idb-keyval`, `@types/compression` (todas leves, sem breaking changes). Não fiz upgrade forçado de dependências maiores (React, Vite, etc.) sem testar — risco de quebrar algo fora do escopo pedido.

### Módulo CMV / IA
- O projeto **já tinha** um módulo de CMV com IA (`server/cmvAiService.ts` + `src/components/AdminPricingCmv.tsx`, quase 1.200 linhas) com alerta de margem 30-35% e sugestões via Gemini — não foi tocado.
- **Complementado** com ficha técnica real: `supabase/migrations/0004_cmv_module.sql` cria `ingredients` e `product_recipe_items`, e uma view `product_cmv` que calcula o CMV automaticamente (soma dos ingredientes × custo, dividido pelo preço) em vez de depender de um número digitado à mão.
- **Sugestões baseadas em vendas reais**: `product_sales_performance()` (SQL) cruza os últimos 30 dias de pedidos de verdade com a margem de cada prato. `server/cmvServiceV2.ts` usa isso para sugerir pausar item de baixa saída/margem apertada, revisar preço de item com CMV crítico, ou promover item de alta margem e bom giro.
  - **Importante para não criar expectativa errada**: isso é uma engine de regras transparente sobre dados reais, não um modelo de machine learning nem "IA" no sentido literal — está documentado assim no próprio código-fonte, exatamente para não vender algo que o sistema não faz.
- Rotas: `GET /api/v2/cmv/products`, `POST /api/v2/cmv/ingredients`, `PUT /api/v2/cmv/products/:id/recipe`, `GET /api/v2/cmv/suggestions`.

### Fluxo POS (mesas, delivery, balcão, impressão térmica)
- **Mesas 1-50**: `WaiterView` agora mostra a grade completa de 1 a 50 direto (função `buildTableGrid`) — a mesa só é criada de verdade no banco no instante em que é tocada pela primeira vez (`ensureTableExists`), sem exigir cadastro manual prévio.
- **Balcão/Retirada e Delivery (1-100, campo oculto)**: `src/components/BalcaoDeliveryQuickEntry.tsx` — o campo numérico só aparece depois que o operador escolhe "Balcão" ou "Delivery", e é opcional preencher. `src/components/BalcaoDeliveryView.tsx` junta isso ao cardápio (com cache instantâneo) numa aba nova do `CaixaView`.
- **Pedido em 1 clique**: o botão "Enviar Pedido" já cria e envia o pedido de uma vez (cria no banco → enfileira impressão → confirma) sem tela intermediária.
- **Impressão térmica com cabeçalho em destaque**: `server/ticketFormatter.ts` gera exatamente o formato pedido — `🔹 MESA 05` ou `🔹 BALCÃO - RETIRADA #12` — e isso já vem pronto dentro do `payload` de cada `print_job` (campo `ticketHeader`/`ticketText`), tanto na criação do pedido quanto na mudança de status (pronto → caixa, em_entrega → motoboy).
- Coluna nova `pickup_code` (1-100) em `orders`, adicionada via `supabase/migrations/0005_pickup_code.sql` e `0006_order_pickup_code.sql` (que atualiza `create_order_transactional` pra aceitar esse número, mantendo a mesma validação de preço/idempotência da Fase 2).

### Migrations, nesta ordem completa agora
1. `0001_multi_tenant_core.sql`
2. `0002_order_functions.sql`
3. `0003_security_hardening.sql`
4. `0004_cmv_module.sql`
5. `0005_pickup_code.sql`
6. `0006_order_pickup_code.sql`

### Build
`npx tsc --noEmit` e `npm run build` rodados novamente após todas essas mudanças — **0 erros**, build de produção concluído.

