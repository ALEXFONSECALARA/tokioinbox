# TokioInbox — Operação Delivery Multi-Restaurante

<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

Plataforma de delivery **multi-restaurante**: qualquer número de restaurantes,
cada um com seu próprio cardápio, configurações, pedidos e URL pública
(`/seu-restaurante`), mais um painel administrativo único para gerenciar
todos eles.

## Rodando localmente

**Pré-requisitos:** Node.js (veja a versão exata em [`.nvmrc`](.nvmrc))

1. Copie `.env.example` para `.env` e preencha o que for usar (veja
   [DEPLOY.md](DEPLOY.md) para o significado de cada variável).
2. Instale as dependências:
   `npm install`
3. (Opcional, só na primeira vez) Gere alguns restaurantes de exemplo:
   `node server/scripts/seed-restaurants.mjs`
4. Rode o backend (API multi-restaurante):
   `npm run server`
5. Em outro terminal, rode o frontend:
   `npm run dev`

## Rotas

- `/` — página inicial, lista **dinamicamente** todos os restaurantes ativos
  (não existe lista fixa no código — cadastrar um restaurante novo no painel
  já faz ele aparecer aqui e em `/seu-slug`, sem editar nada).
- `/:slug` — cardápio público de um restaurante (ex: `/tokio-sushi`). O slug
  vem da configuração de cada restaurante, não é hardcoded.
- `/PAINELRESTAURANTE` — painel administrativo (endereço oficial). `/admin`
  continua funcionando por compatibilidade com links antigos.
- `/conta` — área do cliente (pedidos, endereços salvos).
- `/kanban/:slug` — quadro de pedidos operacional de um restaurante
  específico, com senha própria (sem acesso a cardápio, configurações ou
  usuários) — pensado pra cozinha/balcão.
- `/kanban` — mesmo quadro, mas com um seletor entre todos os restaurantes
  (uma senha geral dá acesso a todos).

> Restaurantes de exemplo usados em desenvolvimento (gerados por
> `server/scripts/seed-restaurants.mjs`) são só dados — o roteador e o painel não
> têm nenhuma lógica amarrada a esses nomes específicos.

Veja [DEPLOY.md](DEPLOY.md) para instruções completas de deploy no GitHub + Render + Supabase.

## Variáveis de ambiente

Veja [`.env.example`](.env.example) para a lista completa. Resumo:

| Variável | Obrigatória? | Pra quê serve |
|---|---|---|
| `ADMIN_PASSWORD` | Sim, em produção | Senha do ADMIN MASTER (`/PAINELRESTAURANTE`) |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | Obrigatório em produção | Persistência real (sem isso, cai em `server/storage/legacy-json/*.json`, que é efêmero no Render) |
| `CLOUDINARY_*` | Opcional | Upload de imagens com URL permanente (sem isso, fica no disco local, efêmero no Render) |
| `GEMINI_API_KEY` | Opcional | Habilita o assistente de IA do painel (Ferramentas → Diagnóstico) |

## Histórico de evolução técnica

Resumo do que já foi endurecido/adicionado ao longo do projeto (mantido aqui
como changelog técnico, não como versão do produto):

- **Fluxo operacional de pedidos:** transições obrigatórias
  **Recebido → Em preparo → Pronto → Saiu para entrega → Entregue**, com
  cancelamento separado e protegido por permissão; o backend rejeita
  transições inválidas mesmo vindas de outro dispositivo/painel.
- **Tempo real:** eventos SSE para pedidos, cardápio, configuração e fila de
  impressão, com polling como fallback e `updated_at` em pedidos pra evitar
  que uma tela desatualizada sobrescreva uma mudança feita em outro lugar.
- **Diagnóstico:** `/api/:slug/health` (autenticado, por restaurante) e
  `/api/health/ready` (infraestrutura); o painel mostra banco, imagens,
  push, IA, conexões realtime e alertas operacionais; detecta cardápio
  vazio, categoria sem produto, produto sem imagem, WhatsApp ausente etc.
- **Impressão:** fila persistente por restaurante/dispositivo, com estado
  visual (Pendente → Imprimindo → Impresso) e retomada após reload. A
  impressão térmica física real depende do **Print Bridge** local (ver
  [`server/print-bridge/`](server/print-bridge/)) — o navegador nunca tem acesso direto e
  silencioso a uma impressora, por segurança.
- **PWA:** shell offline, API nunca cacheada, `/api/version` para detectar
  deploy novo.
- **Segurança:** senha e CORS obrigatórios em produção, correlation ID em
  toda resposta de erro (`requestId`), isolamento de dados por restaurante,
  backup de segurança automático antes de qualquer restore.
