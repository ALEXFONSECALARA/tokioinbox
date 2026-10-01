# V9 PLUS ULTRA 05 — alterações

1. Mesa: fechar e pagar com 10% INCLUÍDO por padrão (Caixa, PDV Garçom, Painel de Mesas) com botão para desativar em cada conta.
   Taxa de serviço agora tem campo próprio (`serviceFee`) e sai no cupom como "Taxa de serviço (10%)".
2. Impressão ativa por setor (cozinha, sushi bar, bar, caixa) — Ferramentas → Configurações do Sistema.
3. Impressoras: classificação correta de setor ao adicionar itens à mesa, anti-duplicidade em retry,
   impressora offline/sem papel não gera mais "não configurada", limite de tentativas, fila limitada antes de gravar,
   impressão offline usa o mesmo classificador do servidor.
4. Kanban com botão "Desativar Kanban" (também em Ferramentas) e "Envio automático aos setores" (ligado por padrão).

Teste novo: `node scripts/stations-print-test.mjs`
