# PDV Multicardápio V3 — Redesign Mesas / Modal / Finalização

## Implementado
- Canvas responsivo e rolável para mesas.
- Cards de mesas com visual isométrico e estados Livre / Em Uso / Fechada.
- Botões `Incluir Mesa` e `Excluir Mesa` acima do canvas.
- Modal de `Cadastro de Mesas` com incluir, excluir, editar/atualizar e salvar.
- Bloqueio de exclusão de mesa com comanda ativa.
- Modal `Detalhes da Mesa` em viewport completo, com visual da mesa, resumo da comanda, itens e ação `Cobrar Mesa`.
- Modal com cabeçalho fixo, conteúdo rolável e rodapé fixo para evitar cortes.
- `Finalizar Comanda` transformado em accordion fechado por padrão, contendo desconto, taxa de serviço e forma de pagamento.
- Botão principal `Cobrar Mesa` ganhou prioridade visual; Salvar/Cancelar ficaram discretos.
- Clique em qualquer mesa abre primeiro os detalhes, inclusive mesa livre.
- Novos SVGs isométricos para mesa livre, mesa em uso e mesa fechada.

## Observação visual
As imagens anexadas nesta conversa são capturas do PDV. O arquivo-fonte específico da cena 3D/isométrica descrita como `image_2.png` não estava presente como arquivo de imagem separado. Por isso, os novos SVGs foram desenhados no próprio projeto para manter a operação sem depender de um asset externo. Se a `image_2` original for fornecida, ela pode substituir diretamente esses três assets.

## Validação
- Todos os arquivos TS/TSX de `src` passaram por análise sintática/transpilação.
- A instalação completa das dependências (`npm ci`) excedeu o tempo disponível no ambiente, portanto o build completo não foi certificado neste ambiente.
