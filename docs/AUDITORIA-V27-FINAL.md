# TokioInbox v27 — auditoria final

## Estrutura
A raiz contém exatamente cinco diretórios: `frontend`, `backend`, `database`, `docs`, `tools`. Nenhum desses diretórios contém subpastas.

## Correções principais
- Node 22 fixado para compatibilidade com Supabase JS/Realtime.
- Login de cliente com telefone normalizado (com/sem código 55) e PIN de 4 dígitos.
- Sessão do cliente assinada e persistente no navegador.
- Pedido recebe `customerId` exclusivamente do token autenticado.
- Cliente só cancela o próprio pedido em `recebido` ou `em_preparo`.
- Exclusão do histórico do cliente remove somente pedidos finalizados (`entregue`/`cancelado`), preservando pedidos em andamento.
- JSON de desenvolvimento usa a mesma normalização de telefone.
- Upload local de desenvolvimento não expõe o diretório inteiro do backend.
- Vite não depende de `__dirname` inexistente em ESM e os assets PWA são emitidos no build.
- Removidos scripts/pastas duplicados e arquivos auxiliares obsoletos.
- Migrations SQL ficaram todas em um único diretório, sem duplicidade de versão 0013.

## Validação
- Estrutura: OK.
- Subpastas: 0.
- Imports locais: OK na verificação estática.
- Sintaxe JavaScript/MJS do backend: OK.
- Build completo requer instalação das dependências; o ambiente desta análise não concluiu `npm ci` dentro do limite de execução.
