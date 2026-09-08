# Deploy — GitHub + Render + Supabase

## 1. Supabase

1. Abra o projeto correto.
2. SQL Editor → New query.
3. Cole **o conteúdo** de `supabase/migrations/0001_core.sql`.
4. Execute uma vez.
5. Confirme que as tabelas `restaurants`, `menu_categories`, `menu_items`, `customers`, `orders` e `order_items` existem.

## 2. GitHub

Suba o projeto para um repositório GitHub e mantenha a branch de produção como `main`.

## 3. Render

Crie um Web Service conectado ao GitHub. O `render.yaml` pode ser usado pelo Blueprint.

Variáveis obrigatórias em produção:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ADMIN_PASSWORD`
- `SESSION_SECRET`
- `CORS_ORIGINS` com o domínio público do Render, por exemplo `https://seu-app.onrender.com`

Opcional:

- `GEMINI_API_KEY`
- `GEMINI_MODEL`

Não use `admin123` em produção.

## 4. Primeiro teste

Depois do deploy:

- `/api/health`
- `/api/health/ready`
- abrir um restaurante público
- criar um pedido
- entrar em `/admin`
- confirmar que o pedido aparece no Kanban
- testar filtro Japonês/Italiano/Pizza/Hamburgueria
- alterar status
- cancelar
- excluir um pedido finalizado do histórico

## Regra de isolamento

Um pedido criado no restaurante A recebe `restaurant_slug=A` no banco. O endpoint de atualização/exclusão também exige o mesmo slug. O Kanban global apenas agrega os pedidos para o super-admin; o filtro por restaurante nunca mistura o banco dos restaurantes.
