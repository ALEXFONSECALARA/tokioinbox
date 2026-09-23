# PDV Multicardápio v3 — Auditoria e Correções 2026-09-23

## Correções aplicadas

- Cadastro de mesas passou a respeitar `restaurant.activeTables` como fonte de verdade.
- Corrigido bug que recriava automaticamente as mesas 1–30 depois de excluir uma mesa.
- Modal de Cadastro de Mesas agora permite adicionar, remover e restaurar mesas e mostra quais estão em uso.
- Mesa com comanda ativa não pode ser removida silenciosamente; primeiro deve ser fechada ou transferida.
- Cadastro pode ficar temporariamente sem mesas e depois receber novas mesas.
- Visual das mesas recebeu ilustração com cadeiras para estados livre, em uso e fechamento.
- Carrinho do PDV desktop permanece visível com `sticky` e rolagem interna, sem desaparecer ao percorrer produtos.
- Kanban central deixou de usar `min-w-max`/colunas fixas que causavam corte horizontal. Agora usa grid responsivo 1/2/3/5 colunas.
- Área administrativa ganhou largura útil maior em telas grandes e navegação de ferramentas mais compacta.
- Modais receberam viewport responsivo, altura baseada em `100dvh`, rolagem controlada e fundo opaco para impedir conteúdo por trás de competir com o formulário.
- Credencial inicial do super administrador fixada em:
  - Login: `admin`
  - Senha: `admin`

## Observação de segurança

A credencial fixa foi aplicada conforme solicitado. Para produção pública, recomenda-se trocar a senha e/ou remover a política fixa depois da implantação inicial.

## Arquivos principais alterados

- `src/components/TableServicePanel.tsx`
- `src/components/WaiterPdvTouch.tsx`
- `src/components/CentralKanbanView.tsx`
- `src/components/AdminLayout.tsx`
- `src/utils/index.css`
- `server/authAndDeviceService.ts`
- `public/table-chairs-open.svg`
- `public/table-chairs-use.svg`
- `public/table-chairs-closed.svg`

