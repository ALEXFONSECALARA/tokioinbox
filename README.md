# TokioInbox — V7 Operação Delivery

<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/d50af42b-1b9c-471c-9389-ec1caf300c9a

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Generate the seed data for the 4 restaurants (only needed once):
   `node scripts/seed-restaurants.mjs`
4. Run the backend (serves the multi-restaurant JSON API):
   `npm run server`
5. Run the app (in another terminal):
   `npm run dev`

> Este é um sistema **multicardápio**: 4 restaurantes separados (Japonês,
> Italiano, Pizza, Hamburgueria), cada um com sua própria URL
> (`/japones`, `/italiano`, `/pizza`, `/hamburgueria`), e um painel único de
> super-admin em `/admin` (uma senha só) pra gerenciar todos e ver os pedidos.
> Veja [DEPLOY.md](DEPLOY.md) para detalhes e instruções de deploy no GitHub + Render.

## Realtime V6

Para Supabase, execute também `supabase/migrations/0018_order_realtime_versioning.sql`.
A migração adiciona `updated_at` aos pedidos e impede que uma tela antiga sobrescreva uma alteração feita em outro dispositivo.


## Evolução V7 — operação sem atalhos

- Fluxo operacional obrigatório: **Recebido → Em preparo → Pronto → Saiu para entrega → Entregue**.
- Cancelamento continua separado e protegido por permissão.
- O backend rejeita transições inválidas, inclusive quando feitas por outro cliente/painel.
- `statusHistory` recebe a mudança de status no servidor para manter o histórico consistente.
- Rastreamento do cliente agora mostra a etapa **Pronto** antes de **A caminho**.
- Impressão ganhou estado visual por pedido: **Pendente → Imprimindo → Impresso**, com **Tentar novamente** em caso de falha de inicialização. O estado é mantido por restaurante na estação do navegador.
- Kanban reduz a operação a uma ação principal por etapa, favorecendo uso em celular.

> V7 mantém SSE + polling de pedidos da V6 como mecanismo de sincronização.

## Evolução V8 — Operação em produção
- Diagnóstico autenticado por restaurante em `/api/:slug/health`.
- Readiness separado em `/api/health/ready` para health checks de infraestrutura.
- O painel agora exibe banco, armazenamento de imagens, Push, IA, conexões realtime, volume de pedidos e alertas operacionais.
- O diagnóstico detecta cardápio vazio, categorias ausentes, produtos sem imagem, WhatsApp ausente e status operacional inválido.
- Endpoint global `/api/health` passou a informar latência, uptime, backend de dados e capacidades ativas.

## Evolução V9 → V12

- **V9:** fila de impressão persistente por restaurante/dispositivo, com estados operacionais e retomada após reload.
- **V10:** central unificada de notificações no painel.
- **V11:** eventos realtime para pedidos, cardápio e configurações; polling permanece como fallback.
- **V12:** PWA com shell offline, API nunca cacheada, health/readiness preservados e endpoint `/api/version`.

> A impressão térmica automática física continua dependendo de uma ponte/agente local de impressão. O navegador não recebe acesso direto e silencioso à impressora por segurança.

## V19 — Hardening / Bugfix

V19 corrige riscos encontrados na auditoria: senha/CORS obrigatórios em produção, correlation ID, realtime por restaurante, conflito em pagamento, claim/lease da fila de impressão e backup de segurança antes de restore.
