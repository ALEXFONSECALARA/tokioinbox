# Tokio inBox — Multicardápio

Plataforma de delivery multi-restaurante com React + Vite no frontend, Node/Express no backend e Supabase/Postgres como persistência.

## Arquitetura

- **GitHub:** código-fonte e CI.
- **Render:** serviço Web Node que serve API e frontend.
- **Supabase:** banco PostgreSQL persistente.
- **Cliente:** cardápio por restaurante, carrinho e checkout.
- **Admin:** login único de super-admin e Kanban global com filtro por restaurante.
- **Realtime:** SSE do servidor; os pedidos são sempre filtrados por `restaurant_slug`.

## Restaurantes iniciais

- Japonês — Sakura Sushi House
- Italiano — Cantina Bella Vista
- Pizza — Forno D'Oro Pizzeria
- Hamburgueria — Burger Craft & Beer

## Desenvolvimento local

```bash
npm install
cp .env.example .env
npm run dev
```

Para desenvolvimento sem Supabase, o frontend mantém os dados de demonstração locais; para operação real, configure Supabase.

## Supabase

Execute **uma única vez**, no SQL Editor do projeto Supabase:

`supabase/migrations/0001_core.sql`

Depois reinicie o serviço Render. Na primeira inicialização com banco vazio, o servidor cria os quatro restaurantes, categorias, produtos e clientes iniciais automaticamente.

**Nunca** coloque `SUPABASE_SERVICE_ROLE_KEY` no frontend ou em variável `VITE_*`.

## Render

O `render.yaml` já define:

- build: `npm install && npm run build`
- start: `npm start`
- health check: `/api/health/ready`

Configure no Render:

`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_PASSWORD`, `SESSION_SECRET`, `CORS_ORIGINS` e, opcionalmente, `GEMINI_API_KEY`.

## GitHub

O workflow `.github/workflows/ci.yml` executa TypeScript e build em pushes/PRs para `main`.
