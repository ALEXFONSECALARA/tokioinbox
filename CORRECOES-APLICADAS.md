# Correções aplicadas

## 1. Erro ao criar conta pelo cliente
- `server/index.js` (`POST /api/customers/register` e `PATCH /api/customers/me`): o erro genérico
  "Não foi possível criar a conta..." agora devolve também o **código técnico** e o **requestId**,
  igual já acontecia na criação de pedidos — dá pra achar a causa real no log do Render em vez de só
  "verifique os dados". A detecção de "banco não migrado" (tabela `customers` ausente) também ficou
  mais abrangente.

## 2. Senha de 4 dígitos (conta do cliente)
- Backend: `/api/customers/register` e `/api/customers/me` agora exigem **exatamente 4 dígitos
  numéricos** (regex `^\d{4}$`) em vez de "6+ caracteres".
- Frontend (`src/components/CustomerAccountModal.tsx`): campo de senha virou um PIN numérico
  (`inputMode="numeric"`, só aceita dígitos, máximo 4), com texto explicando "PIN de 4 dígitos".
- Login e demais senhas do painel administrativo (`admin_users`) **não foram alteradas** — a regra
  de 4 dígitos é só para a conta do cliente final.

## 3. Link do restaurante sem `/r/` e sem hífen
- `sakura-sushi-house` → `sakurasushihouse`, e o link deixou de usar o prefixo `/r/`
  (`/sakurasushihouse` em vez de `/r/sakurasushihouse`).
- Alterado em 4 lugares que geram o mesmo slug (frontend `toPublicSlug` em `src/utils/api.ts`,
  backend `publicSlug` em `server/index.js`, `server/lib/db.json.js` e `server/lib/db.supabase.js`)
  e em todos os pontos que montam o link (QR/flyer, "copiar link exclusivo" no painel, card do
  restaurante na home, manifesto do PWA).
- **Compatibilidade mantida**: a rota antiga `/r/:slug` continua funcionando (QR codes já impressos
  não quebram), porque o normalizador remove hífens dos dois lados na hora de comparar.

## 4. Impressão automática/simultânea de novos pedidos
- `server/index.js` (`POST /api/:slug/orders`): quando o restaurante liga "Imprimir novos pedidos
  automaticamente" (`config.printAutoNewOrders`, já existia como preferência mas nunca fazia nada),
  o servidor agora cria o print-job de cozinha **na hora** que o pedido chega — o Print Bridge
  (agente ligado na impressora térmica real) pega a fila e imprime em segundos, sem precisar de
  clique manual.
- `src/components/AdminPortal.tsx` + `src/components/AdminDashboard.tsx`: se o painel estiver aberto
  no navegador, o recibo do pedido novo abre e imprime sozinho assim que chega por tempo real (SSE),
  reaproveitando o `ReceiptPrintModal` que já chama `window.print()` ao abrir.

## 5. Siglas de versão removidas dos botões/telas
- "Diagnóstico V22" → "Diagnóstico", "Produção V22" → "Produção" (`src/components/ToolsHub.tsx`).
- "SAÚDE OPERACIONAL V8" → "SAÚDE OPERACIONAL" (mesmo arquivo).
- "TokioInbox Print Bridge V14" → "TokioInbox Print Bridge" (`print-bridge/README.md`).

## 6. Excluir entregador a qualquer momento (super admin)
- Antes: o botão de excluir só atualizava a lista local e reenviava a configuração inteira do
  restaurante (`PUT /api/:slug/config`) — se esse PUT falhasse silenciosamente, o entregador
  "excluído" reaparecia no próximo carregamento, sem nenhum aviso de erro.
- Agora: usa a rota dedicada `DELETE /api/:slug/drivers/:id` (já existia no backend, mas nunca era
  chamada pelo frontend), com confirmação antes de excluir e aviso real de erro se a exclusão falhar.
- Arquivos: `src/utils/api.ts` (nova função `deleteDriverAdmin`), `src/components/AdminDashboard.tsx`.

## 7. Trocar foto da sequência de splash clicando na imagem
- Antes: as fotos já cadastradas na sequência (Configurações → Sequência de fotos ao abrir o app)
  só podiam ser excluídas e recadastradas do zero — perdendo zoom/posição/overlay/texto configurados.
- Agora: clicar direto na miniatura da foto abre o seletor de arquivo e troca **só a URL** daquela
  foto, mantendo todos os ajustes. Tem indicador visual ao passar o mouse e um spinner durante o
  envio. Arquivo: `src/components/AdminDashboard.tsx`.

## Verificação
- `npm run build` (vite build) rodou sem erros.
- `node --check` em todos os arquivos do backend alterados.
- Testes existentes em `tests/server/` continuam passando (exceto `smoke.mjs`, que já falhava antes
  destas mudanças por checar uma string que nunca existiu em `server/index.js` — bug pré-existente,
  não relacionado a este pacote de correções).

---

# Rodada 2 de correções

## 8. "Não foi possível listar backups" e erros genéricos sem pista nenhuma
- Vários endpoints (`/api/:slug/backups`, `/api/:slug/backup`, restore, entregadores) engoliam
  qualquer erro do banco e devolviam só uma mensagem genérica, sem logar e sem dizer o motivo.
- Criado um helper central `sendDbError()` (`server/index.js`) que agora é usado nesses endpoints.
  Ele loga o erro de verdade, devolve `código técnico` + `requestId`, e **detecta especificamente
  os códigos PGRST205/PGRST204** (PostgREST com o cache de schema desatualizado depois de uma
  migration) — nesse caso a mensagem já orienta a rodar `NOTIFY pgrst, 'reload schema';` no SQL
  Editor do Supabase (ou Settings → API → Reload schema), que é a causa real mais provável desses
  erros aparecerem do nada depois de aplicar uma migration nova.

## 9. Causa raiz do erro "código: PGRST205" ao criar conta / senhas de segurança nunca salvavam
Bug real encontrado: os campos **"Senha do Kanban individual"** e **"Senha de limpeza de
histórico"** (Configurações → 🔒 Senhas de segurança) já existiam na tela e a rota do servidor já
sabia gerar o hash certinho — mas **nenhuma migration jamais criou as colunas correspondentes no
Supabase**, e a função que traduz os campos da API pro banco (`configApiToRow` em
`db.supabase.js`) nem tinha essas duas chaves no mapa. Resultado: a senha era descartada
**silenciosamente antes mesmo de tentar gravar** — a tela mostrava "Configurações salvas com
sucesso!", mas nada era persistido.
- Nova migration: `supabase/migrations/0023_restaurant_security_passwords.sql` — cria
  `kanban_password_hash` e `history_clear_password_hash` em `restaurant_configs` e já recarrega o
  cache de schema do PostgREST.
- `server/lib/db.supabase.js`: adicionado o mapeamento das duas colunas em `configApiToRow` (API →
  banco) e `configRowToApi` (banco → API).
- **Ação necessária**: rodar essa migration no SQL Editor do MESMO projeto Supabase usado pelo
  Render.

## 10. "Excluir histórico" não fazia nada — erro engolido silenciosamente
- O botão de confirmar exclusão de histórico (fluxo sem senha extra) chamava
  `await onClearOrderHistory()` **sem nenhum try/catch**. Se o servidor recusasse (por exemplo,
  403 por falta da permissão "Excluir histórico" na conta logada) ou desse qualquer outro erro, a
  promise rejeitada ficava sem tratamento nenhum — o usuário não via absolutamente nada, parecendo
  que "o sistema ignorou o pedido de excluir". Corrigido com try/catch + alerta visível com a
  mensagem real do servidor. Arquivo: `src/components/AdminDashboard.tsx`.
- Relacionado: criar um usuário no painel (Usuários e Permissões) exigia marcar manualmente umas
  25 caixinhas de permissão uma por uma, sem nenhum atalho — fácil esquecer alguma (como "Excluir
  histórico") e a conta ficar sem conseguir fazer ações básicas, sem nenhum aviso claro do motivo
  na hora. Adicionados botões "Marcar todas" / "Desmarcar todas" em
  `src/components/AdminUsersPanel.tsx` (+ `ALL_PERMISSION_KEYS` exportado em
  `src/utils/permissions.ts`).

## 11. Botões "Produção" e "Entregadores" do Central de Ferramentas não faziam nada
- Achado: o conteúdo dessas duas abas (`productionCards`/`driverCards`) estava renderizado **fora
  do lugar** — logo no topo do componente, antes até do cabeçalho "Central de Ferramentas" e da
  barra de abas — em vez de aparecer na área de conteúdo abaixo delas, como as outras abas
  (Diagnóstico, Históricos & Logs etc.). Clicar nessas duas abas destacava o botão mas não mudava
  nada visível na tela. Corrigido: conteúdo movido pro lugar certo, dentro do fluxo normal de abas,
  com um cabeçalho próprio e botão de atualizar em "Entregadores". Arquivo:
  `src/components/ToolsHub.tsx`.

## Verificação (rodada 2)
- `npm run build` (vite build) rodou sem erros.
- `npx tsc --noEmit` não introduziu nenhum erro novo (os 2 erros pré-existentes, não relacionados
  a este pacote, continuam os mesmos: `AdminPortal.tsx:387` e `main.tsx:18`).
- `node --check` em todos os arquivos do backend alterados.

## ⚠️ Ação manual necessária no Supabase
Depois de subir este código, rode no SQL Editor do Supabase, na ordem:
1. `supabase/migrations/0022_production_repair.sql` (se ainda não tiver rodado)
2. `supabase/migrations/0023_restaurant_security_passwords.sql` (novo)

E confirme que o cache de schema foi recarregado (a própria migration 0023 já faz isso, mas se
continuar vendo erros PGRST204/PGRST205 em qualquer rota, rode manualmente:
`NOTIFY pgrst, 'reload schema';` no SQL Editor, ou Settings → API → "Reload schema" no painel do
Supabase).
