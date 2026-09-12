# TokioInbox — Deploy

Plataforma **multi-restaurante**: qualquer número de restaurantes, cada um
com seu próprio cardápio, URL e pedidos — e um **painel único de admin**
(com usuários e permissões granulares) pra gerenciar todos e receber os
pedidos em tempo real.

## Como está organizado

- `GET /:slug` → cardápio público do restaurante (ex: `/tokio-sushi`). O
  slug vem da configuração de cada restaurante — **não existe lista fixa de
  restaurantes em nenhum lugar do código**; a rota resolve dinamicamente
  contra o que estiver cadastrado no backend de dados (ver abaixo).
- `/` → página inicial, lista automaticamente todos os restaurantes ativos
  (inativos não aparecem). Se adapta sozinha à quantidade cadastrada.
- `/PAINELRESTAURANTE` → painel administrativo (endereço oficial; `/admin`
  continua aceito por compatibilidade com links antigos).
- `/kanban/:slug` e `/kanban` → quadros de pedidos com senha própria, sem
  acesso ao resto do painel (cozinha/balcão).

### Dois backends de dados, escolhidos automaticamente

O servidor (`backend/index.js`, via `backend/lib/db.js`) escolhe o backend
sozinho, sem precisar editar código:

- **Com `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` definidos** → usa
  Postgres/Supabase (`backend/lib/db.supabase.js`). **Recomendado para
  produção** — dados persistem de verdade, independente de reinício/redeploy
  do serviço. Veja [`docs/SUPABASE_SETUP.md`](docs/SUPABASE_SETUP.md) e as
  migrations em [`database/`](database/) (rode todas,
  em ordem, no SQL Editor do seu projeto).
- **Sem essas variáveis** → cai automaticamente em arquivos JSON locais
  (`backend/lib/db.json.js`), gravados em `backend/storage/legacy-json/restaurants/<slug>/`
  (config, cardápio, pedidos, uploads). Bom pra rodar local/teste rápido —
  **não recomendado em produção no Render** porque o disco do plano grátis é
  efêmero (ver aviso mais abaixo).

Em ambos os casos, todo dado é isolado por `slug`/`restaurant_id` — uma
rota nunca consegue ler ou gravar dado de outro restaurante (no backend
JSON isso é estrutural, pelo caminho do arquivo; no Supabase, por RLS +
filtro obrigatório por `restaurant_id` em toda query).

## Login do admin

O **ADMIN MASTER** usa uma senha única (`ADMIN_PASSWORD`) com acesso total a
todos os restaurantes. Além dele, cada restaurante pode ter usuários próprios
(Configurações → Usuários e Permissões) com permissões granulares por
ferramenta e ação (ver cardápio, editar preços, gerenciar pedidos, excluir
histórico, etc.) — dá pra montar perfis equivalentes a Caixa, Cozinha,
Entrega ou qualquer combinação personalizada.

- **Local:** a senha padrão é `admin123` (veja `backend/index.js`) — só
  funciona fora de `NODE_ENV=production`.
- **Produção (Render):** defina a variável de ambiente `ADMIN_PASSWORD` com
  uma senha forte, em Render → seu serviço → Environment. **O servidor
  recusa iniciar em produção sem essa variável definida.**

## Rodando localmente

```bash
npm install

# (Opcional) Gera alguns restaurantes de exemplo pra testar — não é
# obrigatório, você pode cadastrar restaurantes de verdade pelo painel.
node backend/scripts/seed-restaurants.mjs

# Terminal 1 — backend (API + dados)
npm run server        # http://localhost:3001

# Terminal 2 — front-end
npm run dev            # http://localhost:3000
```

Acesse `http://localhost:3000` pra ver a lista de restaurantes cadastrados,
ou direto `http://localhost:3000/seu-slug`. Pra administrar, vá em
`http://localhost:3000/PAINELRESTAURANTE` (senha `admin123` em dev).

## Deploy: GitHub + Render

1. Suba o projeto pro GitHub (`git add . && git commit -m "..." && git push`).
   Confira que `.env`/`.env.local` **não** estão no commit — `.gitignore` já
   bloqueia isso.
2. No Render, crie um **Web Service** apontando pro repositório (o
   `render.yaml` já vem configurado como Blueprint).
3. **Importante:** em Render → Environment, defina pelo menos:
   - `ADMIN_PASSWORD` com uma senha forte (não deixe a padrão `admin123`)
   - `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` (recomendado — ver seção
     de persistência abaixo)
4. Depois do deploy, a URL do Render já serve tudo: `/`, `/seu-slug`,
   `/PAINELRESTAURANTE`, no mesmo domínio.
5. Se estiver usando Supabase, rode todas as migrations de
   `database/` (em ordem) no SQL Editor do projeto antes do
   primeiro acesso, e recarregue o cache de schema do PostgREST depois
   (`NOTIFY pgrst, 'reload schema';`, ou Settings → API → Reload schema) —
   sem isso a API responde erro `PGRST204`/`PGRST205` mesmo com as tabelas
   já criadas.

### ⚠️ Persistência de dados no Render (plano grátis, sem Supabase)

O plano gratuito do Render usa disco **efêmero**. Isso significa que sempre
que o serviço reiniciar ou você fizer um novo deploy, os arquivos em
`backend/storage/legacy-json/` voltam pro estado que está no GitHub — ou seja, **pedidos
recebidos e edições de cardápio feitas depois do último deploy se perdem**
se você não tiver configurado Supabase.

Formas de resolver isso de verdade:

- **Configurar Supabase** (`SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`) —
  forma recomendada, sem custo adicional de disco no Render.
- **Persistent Disk** (recurso pago do Render) montado em `backend/storage/legacy-json`, se
  por algum motivo você quiser continuar no backend JSON em produção.

## Fotos (logo, banner, splash, pratos, entregadores)

Com `CLOUDINARY_CLOUD_NAME` + `CLOUDINARY_API_KEY` + `CLOUDINARY_API_SECRET`
configurados, todo upload feito pelo admin sobe pro Cloudinary com URL
permanente. Sem essas variáveis, o upload cai no disco local
(`backend/storage/legacy-json/uploads/<slug>/`), servido em `/uploads/<slug>/<arquivo>` —
sujeito ao mesmo aviso de disco efêmero do Render grátis acima.

## Splash de Boas-vindas

Cada restaurante pode ter sua própria tela de abertura em tela cheia (fotos
de pratos/ambiente/promoções, com animação suave, por alguns segundos, antes
do cardápio abrir). É configurada em `/PAINELRESTAURANTE` → aba
**Configurações** → **Splash de Boas-vindas**: liga/desliga, adiciona/remove
fotos (clique numa foto já cadastrada pra trocá-la sem perder zoom/posição)
e ajusta os segundos por foto. Aparece uma vez por sessão do navegador do
cliente e tem um botão "Pular".

## Segurança do acesso admin

O acesso ao painel de cada restaurante é **só** por `/PAINELRESTAURANTE`
(ou `/admin`) com senha — o cardápio do cliente nunca mostra nenhum atalho
ou botão que abra o painel sem login.

Outras práticas já aplicadas neste projeto:

- `SUPABASE_SERVICE_ROLE_KEY` só é lida no backend (`backend/lib/`) — nunca
  enviada ao frontend nem embutida no bundle publicado.
- Toda rota administrativa exige sessão válida verificada no **backend**
  (nunca confia só em uma checagem do lado do cliente).
- Permissões de usuários restaurante-a-restaurante são validadas no
  backend a cada requisição, não só escondidas na interface.
- Rate limiting em rotas sensíveis (login, cadastro, pedidos).

## Adicionando um novo restaurante

Não é preciso editar nenhum arquivo de código-fonte — o roteador e a
página inicial são inteiramente dinâmicos:

1. No painel (`/PAINELRESTAURANTE`), cadastre o restaurante novo (nome,
   slug, cardápio, configurações).
2. Pronto — ele já aparece automaticamente na lista (`/`) e sua URL própria
   (`/seu-slug`) já funciona, sem precisar editar `Router.tsx` nem nenhum
   outro arquivo.

Alternativa pra ambiente de desenvolvimento/teste: edite
`backend/scripts/seed-restaurants.mjs` e rode `node backend/scripts/seed-restaurants.mjs`
(não sobrescreve restaurantes que já existem, só cria os novos).
