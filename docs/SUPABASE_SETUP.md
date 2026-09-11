# Fase 2 — Configurar o Supabase (banco multi-restaurante)

Este guia assume o projeto Supabase já existente `ojztmcnghgsrvstmasnc` (não
criar um projeto novo — seção 44 do prompt mestre).

> ⚠️ **Importante sobre o que já foi/não foi feito por mim:** eu escrevi e
> testei a sintaxe de todo o SQL e do código abaixo, e testei
> funcionalmente as rotas do servidor contra o backend em JSON (continuam
> 100% iguais a antes). **Eu não tenho acesso às credenciais do projeto
> Supabase de vocês nem rede liberada para `supabase.co` neste ambiente**,
> então não rodei o SQL nem a migração contra o banco real. Os passos abaixo
> precisam ser executados por alguém com acesso ao painel do Supabase.

## 1. Rodar as migrações SQL

No [Supabase Dashboard](https://supabase.com/dashboard) → projeto
`ojztmcnghgsrvstmasnc` → **SQL Editor** → **New query**:

1. Cole o conteúdo de `supabase/migrations/0001_init_schema.sql` → **Run**.
2. Cole o conteúdo de `supabase/migrations/0002_rls_policies.sql` → **Run**.

(Alternativa via CLI, se o projeto já estiver linkado localmente:
`supabase db push`.)

Confira em **Table Editor** se as 10 tabelas apareceram: `restaurants`,
`restaurant_configs`, `menu_categories`, `menu_items`, `orders`,
`order_items`, `printers`, `agents`, `print_jobs`, `notifications`.

## 2. Pegar as chaves do projeto

**Project Settings → API**:

- **Project URL** → isso é o `SUPABASE_URL`.
- **service_role key** (na seção "Project API keys", é a chave secreta, NÃO
  a `anon`/`public`) → isso é o `SUPABASE_SERVICE_ROLE_KEY`.

⚠️ A `service_role` ignora Row Level Security e dá acesso total ao banco.
Trate como senha de root. Nunca cole ela em código, nunca comite no git,
nunca coloque em variável que vá pro frontend.

## 3. Rodar a migração dos dados existentes

Local (na raiz do projeto, com Node instalado):

```bash
npm install                # se ainda não rodou
SUPABASE_URL="https://ojztmcnghgsrvstmasnc.supabase.co" \
SUPABASE_SERVICE_ROLE_KEY="cole-a-chave-aqui" \
node scripts/migrate-to-supabase.mjs
```

O script:
1. Faz backup de `server/data/` inteiro (pasta `server/data-backup-<data>/`).
2. Migra os 4 restaurantes (`restaurants.json` + `menu.json` + `config.json`
   + `orders.json` de cada um) para as tabelas do Supabase.
3. Valida comparando as contagens (itens de cardápio e pedidos) entre o JSON
   e o que ficou gravado no Supabase, e avisa se algo não bateu.

É seguro rodar mais de uma vez (usa upsert por slug/id — não duplica nada).
**Nada em `server/data/` é apagado por este script.**

## 4. Apontar o servidor para o Supabase

**Local (dev):** crie um `.env` na raiz (baseado em `.env.example`) com
`SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` preenchidos, e rode `npm run
server` normalmente. No log de inicialização, confira que aparece:

```
Servidor multicardápio rodando na porta 3001 — backend de dados: supabase
```

(Se aparecer `backend de dados: json`, as variáveis não foram lidas — confira
o `.env`.)

**Produção (Render):** painel do serviço → **Environment** → adicione
`SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` (já estão declaradas em
`render.yaml`, só falta o valor) → **Save, rebuild and deploy**.

## 5. Validar de verdade (não só o `npm run build`)

Depois do deploy com Supabase ativo, testar manualmente:

- [ ] `GET /api/restaurants` retorna os restaurantes cadastrados.
- [ ] Abrir o cardápio de cada restaurante ativo (`/seu-slug`) e comparar
      visualmente com a versão em JSON — preços, fotos, categorias e
      disponibilidade batendo.
- [ ] Fazer um pedido de teste em cada restaurante e confirmar que ele
      aparece no painel admin (Kanban) daquele restaurante e **não** aparece
      no painel de outro restaurante.
- [ ] No painel admin, editar um item de cardápio (ex: mudar disponibilidade)
      e confirmar que persiste depois de recarregar a página.
- [ ] Reiniciar manualmente o serviço no Render e confirmar que os pedidos
      continuam lá (esse é o problema do disco efêmero que a Fase 2 resolve
      para pedidos/cardápio/config — não para uploads, ver abaixo).

## O que NÃO mudou nesta fase (importante não presumir que já está pronto)

- **Uploads de imagem** (`/api/:slug/upload`) continuam salvando em disco
  local (`server/data/uploads/`), não no Supabase Storage. No plano free do
  Render, essas imagens ainda são perdidas a cada redeploy. Migrar isso é
  trabalho futuro, fora do escopo desta fase.
- **Impressão automática, Print Agent, SSE, Kanban em tempo real** — as
  tabelas `printers`, `agents`, `print_jobs`, `notifications` já foram
  criadas no schema (pra Fase 3 não exigir outra migração), mas nenhuma rota
  do backend usa elas ainda. Isso é a próxima fase.
- **Subdomínios** (`shogatsu.tokioinbox.com`) — o roteamento continua só por
  `/:slug` na URL. Resolver restaurante por hostname é outra fase.
- **Login por restaurante** (em vez de uma senha única `ADMIN_PASSWORD` para
  todos) — as políticas de RLS em `0002_rls_policies.sql` já preveem um claim
  `restaurant_id` no JWT para esse cenário, mas a autenticação por
  restaurante em si ainda não existe.

## Biblioteca de fotos por restaurante

A migration `supabase/migrations/0016_media_library.sql` cria:

- tabela `media_assets` para catálogo/metadata das imagens;
- bucket público `restaurant-media` no Supabase Storage;
- limite de 8 MB e tipos JPG/PNG/WebP/GIF/AVIF;
- índices por restaurante, tipo e entidade.

Em produção, com `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`, o backend grava o arquivo no Supabase Storage e registra a referência em `media_assets`. O caminho do objeto é sempre prefixado pelo slug do restaurante (`<slug>/...`), evitando mistura entre lojas.

O backend mantém fallback para Cloudinary e disco local, nessa ordem, para não quebrar ambientes antigos.
