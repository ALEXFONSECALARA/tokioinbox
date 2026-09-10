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
