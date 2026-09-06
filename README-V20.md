# TokioInbox V20 — Correções de Corrila, Ferramentas e Kanban Mobile

## Correções
- Adicionado `corrila.http` com variável de restaurante `Corrila` e chamadas REST de saúde, cardápio, pedidos, diagnóstico e teste de criação de pedido.
- Ferramentas administrativas atualizadas para refletir o hardening V19 e operação de produção.
- Simulador de pedido das Ferramentas agora injeta o pedido no estado real do painel e aparece imediatamente no Kanban.
- Kanban mobile recebe atualização automática a cada 4 segundos e possui atualização manual.
- Eventos realtime do painel usam a configuração de som atual e fazem refresh dos pedidos.
- Coluna de Novos Pedidos foi protegida contra clipping/overflow no mobile.
- Cabeçalho do Kanban mostra o nome do restaurante atual.

## Validação
- Sintaxe Node validada.
- Testes server existentes executados.
- Build frontend depende da instalação das dependências (`node_modules` não está presente no ambiente de geração).
