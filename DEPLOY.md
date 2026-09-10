# Tokio inBox — Multicardápio (4 restaurantes)

Plataforma com **4 restaurantes separados** (Japonês, Italiano, Pizza e
Hamburgueria), cada um com seu próprio cardápio, URL e pedidos — e um **painel
único de super-admin** (uma senha só) pra gerenciar todos e receber os pedidos
em tempo real.

## Como está organizado

- `GET /:slug` → cardápio público do restaurante (ex: `/japones`, `/pizza`,
  `/italiano`, `/hamburgueria`)
- `/` → página inicial com a lista dos 4 restaurantes
- `/admin` → painel do super-admin (pede senha), com um seletor pra trocar
  entre os 4 restaurantes e gerenciar cardápio + pedidos de cada um
- `server/data/restaurants.json` → registro dos 4 restaurantes (nome, emoji, cor)
- `server/data/restaurants/<slug>/config.json` → configuração (identidade,
  contato, delivery, pagamento, mesas, splash, entregadores) de cada restaurante
- `server/data/restaurants/<slug>/menu.json` → cardápio (categorias + itens) de
  cada restaurante
- `server/data/restaurants/<slug>/orders.json` → pedidos de cada restaurante
- `server/data/restaurants/<slug>/uploads/` → fotos enviadas pelo admin
  (logo, banner, splash, pratos, entregadores) daquele restaurante

**Isolamento por restaurante:** cada um desses arquivos é individual, por
`slug`. Não existe nenhum arquivo/config compartilhado entre restaurantes — as
funções `configPath(slug)`, `menuPath(slug)` e `ordersPath(slug)` no
`server/index.js` sempre montam o caminho a partir do `:slug` da própria URL,
então é estruturalmente impossível uma rota ler ou gravar o arquivo de outro
restaurante. Um restaurante novo cadastrado no futuro automaticamente recebe
seu próprio trio de arquivos (via `scripts/seed-restaurants.mjs`).

Se algum dia esse projeto migrar pra um banco (Postgres/Supabase), o
equivalente é: toda tabela (`config`, `menu_items`, `categories`, `orders`,
`drivers`, `delivery_zones`) precisa de uma coluna `restaurant_id`/`slug`, com
RLS (`USING (restaurant_id = current_setting('app.restaurant_id'))` ou
verificação equivalente na aplicação) impedindo uma query sem esse filtro.

## Login do admin

Uma senha única dá acesso ao painel `/admin`, de onde dá pra gerenciar os 4
restaurantes (não precisa logar de novo pra cada um).

- **Local:** a senha padrão é `admin123` (veja `server/index.js`)
- **Produção (Render):** defina a variável de ambiente `ADMIN_PASSWORD` com uma
  senha forte, em Render → seu serviço → Environment

## Rodando localmente

```bash
npm install

# Gera os dados iniciais dos 4 restaurantes (só precisa rodar uma vez,
# ou se quiser resetar tudo pro estado original)
node scripts/seed-restaurants.mjs

# Terminal 1 — backend (API + dados)
npm run server        # http://localhost:3001

# Terminal 2 — front-end
npm run dev            # http://localhost:3000
```

Acesse `http://localhost:3000` pra ver a lista de restaurantes, ou direto
`http://localhost:3000/japones`, `/italiano`, `/pizza`, `/hamburgueria`.
Pra administrar, vá em `http://localhost:3000/admin` (senha `admin123` em dev).

## Deploy: GitHub + Render

1. Suba o projeto pro GitHub (`git add . && git commit -m "..." && git push`)
2. No Render, crie um **Web Service** apontando pro repositório (o
   `render.yaml` já vem configurado como Blueprint)
3. **Importante:** em Render → Environment, defina `ADMIN_PASSWORD` com a
   senha que você quer usar em produção (não deixe a padrão `admin123`)
4. Depois do deploy, a URL do Render já serve tudo: `/`, `/japones`, `/admin`
   etc, no mesmo domínio

### ⚠️ Persistência de dados no Render (plano grátis)

O plano gratuito do Render usa disco **efêmero**. Isso significa que sempre
que o serviço reiniciar ou você fizer um novo deploy, os arquivos em
`server/data/` voltam pro estado que está no GitHub — ou seja, **pedidos
recebidos e edições de cardápio feitas depois do último deploy se perdem**.

Duas formas de resolver isso de verdade:

- **Persistent Disk** (recurso pago do Render) montado em `server/data`, pra
  que os arquivos sobrevivam a reinícios
- **Migrar pra um banco de dados** (ex: Render Postgres), recomendado se o
  volume de pedidos for grande ou se isso for pra uso real de produção

Pra uso de teste/demonstração, o jeito atual (arquivos JSON) funciona bem —
só não confie nele pra não perder pedidos reais em produção sem um dos ajustes
acima.

## Fotos (logo, banner, splash, pratos, entregadores)

Todo upload de foto feito pelo admin é salvo em `server/data/uploads/<slug>/`
e servido em `/uploads/<slug>/<arquivo>`. Como fica dentro de `server/data/`,
vale o mesmo aviso de disco efêmero do Render grátis acima: fotos enviadas
depois do último deploy somem se o serviço reiniciar, a menos que você use
Persistent Disk.

## Splash de Boas-vindas

Cada restaurante pode ter sua própria tela de abertura em tela cheia (fotos
de pratos/ambiente/promoções, com animação suave, por alguns segundos, antes
do cardápio abrir — estilo iFood/Uber Eats/Airbnb). É configurada em
`/admin` → aba **Configurações** → **Splash de Boas-vindas**: liga/desliga,
adiciona/remove fotos e ajusta os segundos por foto. Aparece uma vez por
sessão do navegador do cliente (some ao trocar de aba ou recarregar; volta a
aparecer numa sessão nova) e tem um botão "Pular".

## Migração: config.json separado do menu.json (rodar uma vez)

Versões antigas deste projeto guardavam a configuração do restaurante (nome,
delivery, pagamento, entregadores...) DENTRO do mesmo `menu.json` que o
cardápio. Isso foi separado em dois arquivos por restaurante. Se você está
atualizando uma instalação antiga:

```bash
node scripts/migrate-split-config.mjs
```

O script:
1. faz um **backup completo** de `server/data/` em `server/data-backup-<data>/`
   antes de tocar em qualquer coisa;
2. pra cada restaurante que ainda tiver a config junto do cardápio, cria o
   `config.json` separado (cópia exata, nada foi editado) e reescreve o
   `menu.json` só com `categories`/`menuItems`;
3. **pula** (não sobrescreve) qualquer restaurante que já tenha `config.json`
   — seguro rodar mais de uma vez;
4. não apaga nenhum pedido, produto, categoria, imagem ou configuração.

Se o projeto já estiver no formato novo (é o caso deste ZIP), rodar o script
não faz nada além de avisar que não há nada a migrar.

## Segurança do acesso admin

O acesso ao painel de cada restaurante é **só** por `/admin` com senha — o
cardápio do cliente (`/japones`, `/pizza` etc.) nunca mostra nenhum atalho
ou botão que abra o painel sem login. (Uma versão anterior deste projeto,
herdada do gerador do AI Studio, tinha um "simulador de dispositivo" com um
botão "Painel do Restaurante" que abria o admin sem senha nenhuma dentro do
próprio app do cliente — isso foi removido.)

## Adicionando um 5º restaurante no futuro

1. Edite `scripts/seed-restaurants.mjs` e adicione o novo restaurante no
   objeto `restaurants` (categorias, itens, config)
2. Rode `node scripts/seed-restaurants.mjs` (ele não sobrescreve restaurantes
   que já existem, só cria os novos)
3. Pronto — o novo restaurante já aparece na lista (`/`) e no admin (`/admin`)
