# NEXORO FOOD SYSTEM

Plataforma multi-restaurante (cardápio digital, pedidos em tempo real, KDS, salão, caixa, delivery, fiscal e IA).

O sistema é composto por **dois aplicativos totalmente separados**, servidos pelo mesmo servidor Node:

| | Cardápio do cliente | Painel da equipe |
|---|---|---|
| Arquivo de entrada | `index.html` → `src/customer/main.tsx` | `painel.html` → `src/painel/main.tsx` |
| Endereços | `/`, `/NomeDoRestaurante`, `/NomeDoRestaurante/mesa/3`, `/mesa/3`, `/login`, `/cadastro`, `/minha-conta`, `/pedido/<id>` | `/PAINELRESTAURANTE`, `/pdv`, `/balcao`, `/delivery`, `/kanban`, `/caixa`, `/cozinha`, `/sushibar`, `/bar`, `/entregador` |
| Acesso | público | somente com login validado no servidor |
| O que carrega | só o código do cardápio | módulos carregados sob demanda, depois do login |

O cliente **não recebe** o código das telas internas e **não vê** nenhum botão, atalho ou link para elas.
O servidor decide qual aplicativo entregar pelo primeiro trecho do endereço (`STAFF_PATH_RE` em `server.ts`).

## Como rodar

```bash
npm install
cp .env.example .env      # preencha ADMIN_PASSWORD (mín. 8 caracteres) e demais chaves
npm run dev               # http://localhost:3000  (cliente em /, painel em /PAINELRESTAURANTE)

npm run build             # gera dist/ (dois apps) e dist/server.cjs
npm start                 # produção: node dist/server.cjs
```

Primeiro acesso ao painel: usuário `admin` e a senha definida em `ADMIN_PASSWORD`.
Se ela estiver vazia **em produção**, o servidor gera uma senha aleatória e a mostra **uma única vez** no log.
Demais colaboradores (cozinha, caixa, garçom, gerente, entregador) são criados pelo administrador em
**Equipe > Usuários**, cada um com senha própria. Não existem mais usuários ou senhas padrão.

## Segurança (resumo do que o servidor garante)

- Lista, alteração, impressão e stream de pedidos: **somente colaboradores logados** (perfil e restaurante são respeitados).
- Cliente cria pedido sem login, mas o **preço é sempre recalculado** a partir do catálogo do servidor.
  Item inexistente, indisponível, opção inválida ou restaurante inexistente são recusados.
- Cliente acompanha o próprio pedido por um **token secreto** entregue só a ele (`/api/public/orders/:id?t=...`).
- Login com senha PBKDF2 (150 mil iterações), bloqueio progressivo por tentativas, sessões persistidas com hash,
  encerradas ao trocar senha/desativar usuário. Sem enumeração de contas.
- CORS restrito a `CORS_ORIGINS` (vazio = só mesma origem), headers de segurança, limite de requisições nas rotas públicas.
- Recuperação de senha do cliente: código gerado com `crypto`, 5 tentativas, **nunca** devolvido na resposta em produção
  (exige `WHATSAPP_SMS_PROVIDER_API_KEY` + `WHATSAPP_SMS_ENDPOINT_URL`).
- `Painel > Auditor Sênior` mostra verificações **reais** feitas pelo servidor (`GET /api/admin/system-audit`).

## Dados

| Dado | Onde fica |
|---|---|
| Cardápio, categorias, restaurantes, cupons | `data/catalog.json` (fonte única; o painel grava com `PUT /api/catalog`, o cliente lê `GET /api/public/catalog`) |
| Pedidos | `data/orders.json` |
| Usuários e sessões | `data/users.json`, `data/staff_sessions.json` |
| Clientes (conta) | `data/customers.json` |
| Fiscal | `data/fiscal/` |

> **Atenção:** o diretório `data/` precisa ficar em **disco persistente** (ex.: Render Persistent Disk). Em disco efêmero os
> dados se perdem a cada deploy. `data/` está no `.gitignore` e nunca deve ser versionado.
> No primeiro start o catálogo é criado com restaurantes de **demonstração**; edite-os no painel.
> Pedidos de exemplo só são criados com `SEED_DEMO_ORDERS=true` (apenas desenvolvimento).

## Fiscal (NFC-e/NF-e)

A integração real com a SEFAZ **não está implementada**. Em **homologação** as respostas são simuladas e marcadas como
`[SIMULADO]`. Em **produção** a emissão é **recusada** com mensagem clara (o sistema não "autoriza" documentos de mentira).
Para emitir de verdade, conecte um provedor fiscal ou implemente o web service SOAP com certificado A1.
Defina `FISCAL_ENCRYPTION_KEY` (mín. 24 caracteres) para habilitar o cofre de certificados.

## Testes

```bash
npm run typecheck                    # TypeScript
npm run build && npm run test:api    # 67 verificações de API/segurança/separação (sobe o servidor sozinho)
pip install playwright && playwright install chromium
npm run test:e2e                     # navegador real: cliente, pedido, painel, perfis, cardápio
```

## Limitações conhecidas

- Persistência em arquivos JSON (adequada a uma instância única). Para várias instâncias, migre para Postgres/Supabase.
- CRM do painel, caixa/turnos, mesas e entregadores ainda guardam estado no navegador do painel (sem API própria).
- Cupons do cliente usam lista embutida (`BEMVINDO10`, `TOKIO5`, `PRIMEIRACOMPRA`); o servidor é quem valida o valor.
- Pedido por QR de mesa é público por natureza (limitado por taxa de requisições).
- Integração real com SEFAZ (ver acima) e agente de impressão ESC/POS ainda não existem.
