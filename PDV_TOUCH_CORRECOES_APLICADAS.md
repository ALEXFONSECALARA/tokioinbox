# PDV Touch Garçom — Correções aplicadas

Data: 2026-09-22

## Principais alterações

- Removidos limites fixos de 24/50 mesas das telas de atendimento; a lista passa a usar `restaurant.activeTables` e mesas presentes em pedidos ativos.
- Adicionada idempotência para abertura/adição de itens em mesas usando `idempotencyKey`.
- Removido telefone fictício automático para comandas de mesa.
- Criada API `PATCH /api/orders/:id/items/:itemId` para edição persistida de item da comanda.
- O PDV Touch agora permite abrir a edição de um item já enviado e salvar quantidade, adicionais e observações no pedido real.
- Criada persistência da fila de impressão em `data/print_jobs.json`.
- Hash de impressão passou a considerar o conteúdo ESC/POS, evitando que conteúdo diferente seja confundido com o mesmo job.
- Criada persistência do cadastro de impressoras em `data/printers.json`.
- Adicionada exclusão de impressoras via API.
- Implementado roteamento automático de novos pedidos/rodadas por setor: COZINHA, SUSHI_BAR, BAR e CAIXA para pedidos de delivery/balcão/retirada/online.
- Adicionada API de conferência não fiscal `POST /api/orders/:id/conference`, sem alteração de status.
- Adicionado estado de vitrine `ATIVO`, `OCULTO` e `FECHADO_TEMPORARIAMENTE`.
- A regra de vitrine é validada no backend durante criação de pedidos públicos.
- `OCULTO` deixa de aparecer no catálogo público; `FECHADO_TEMPORARIAMENTE` continua visível, mas bloqueia novos pedidos públicos.

## Validação

O projeto original não possuía `node_modules` completo. Foi iniciada a instalação das dependências, porém o ambiente não conseguiu concluir a instalação/validação TypeScript dentro do limite disponível. Portanto, não é declarado aqui que `npm run typecheck` ou `npm run build` passaram.

Com as dependências instaladas em ambiente de desenvolvimento, executar:

```bash
npm ci
npm run typecheck
npm run build
```

Depois validar os fluxos reais de impressão com o Print Agent e as impressoras físicas.

## Observação

As correções foram feitas preservando os contratos e componentes existentes sempre que possível. Não foram inseridos registros de negócio fictícios no catálogo ou nos pedidos.


## Correção emergencial 2026-09-22 — rotas /pdv e /balcao
- Corrigido `CounterTouchView`: import ausente de `Store`, que podia causar tela preta ao renderizar o estado inicial vazio.
- Corrigido contrato de `CounterTouchViewProps` para aceitar `onOpenAdmin`, já utilizado pelo `BalcaoModule`.
- Adicionada barreira de erro no `PainelApp` para impedir tela preta silenciosa caso um módulo lazy falhe no carregamento.
- As URLs `/pdv` e `/balcao` continuam sendo rotas internas do painel; não são links externos.


## Correção adicional — navegação sem links internos

A navegação entre PDV, Balcão, Caixa, Delivery e demais ferramentas agora é feita exclusivamente pelo estado interno do React.
- Não usa `history.pushState` ou `history.replaceState` para trocar de ferramenta.
- Não cria URLs `/pdv`, `/balcao`, `/caixa` etc. ao clicar nos botões.
- Não usa `window.location.assign()` para a navegação interna do painel.
- A URL permanece estável enquanto o usuário troca de módulo.
- As rotas continuam reconhecidas apenas para compatibilidade caso o sistema seja aberto diretamente em uma URL existente.
