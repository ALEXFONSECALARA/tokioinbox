# V9 PLUS ULTRA 06 — alterações (sobre a 05)

1. Mesa/Salão imprime COM 10%: cupom (térmico, ESC/POS e HTML) usa a taxa de serviço respeitando o botão
   "10% INCLUÍDO · desativar" da conta. Função única: `applyServiceFeeToOrder` (src/utils/conferencePrint.ts).
2. FECHAMENTO imprime no mesmo clique: botões do "Detalhes da Mesa", do cardápio e da tela de fechamento (PDV Garçom),
   e do painel de Mesas, agora travam a conta E imprimem o cupom (antes só trocavam de tela).
3. PAGAMENTO imprime o comprovante escolhido (Cupom Comum ou Nota Fiscal) no mesmo clique, com forma de pagamento,
   no Caixa, no painel de Mesas e no PDV Garçom (Cupom Comum). O painel de Mesas não abre mais modal intermediário.
4. FERRAMENTAS DO SALÃO no topo: botão com menu (Mesas/PDV, Pagamento/Caixa, Gestão de Mesas, Placas QR,
   Impressoras, Configurações) + liga/desliga de 10%, envio automático e Kanban (administrador).
5. QR da mesa pelo celular não finalizava o pedido: o item era enviado sem `menuItemId` e o servidor recusa itens
   de cliente que não reconhece no cardápio — sem nenhuma mensagem na tela. Corrigido, além de: escolha de opções
   obrigatórias (sabor/ponto), erro sempre visível, renovação automática da senha do QR expirada, retry sem duplicar,
   restaurante do QR respeitado, som bloqueado no celular não trava mais o envio.

Testes: `node scripts/stations-print-test.mjs` (19) e `npx tsx scripts/receipt-10pct-test.ts` (10).
