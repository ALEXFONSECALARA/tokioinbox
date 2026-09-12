# TokioInbox v27 — varredura e correções

## Cliente
- Login normaliza telefone e aceita máscara/com DDD; backend também tolera contas antigas com prefixo `55`.
- Token de cliente continua independente da memória da instância.
- Cancelamento autenticado do próprio pedido: somente `recebido`/`em_preparo`.
- Exclusão do histórico da própria conta exige a senha atual e remove pedidos em todos os restaurantes vinculados à conta.
- A tela de conta agora exibe ações reais de cancelar e excluir histórico; erros não são mais engolidos silenciosamente.
- Removido endereço fictício de fallback no checkout.

## Estrutura
A raiz possui quatro pastas principais: `src`, `server`, `supabase`, `docs`. Scripts e ponte de impressão ficaram dentro de `server`; testes e documentação dentro de `docs`; assets públicos dentro de `frontend/public`.

## Produção
- Node 22.22.2 fixado em `.nvmrc`, `package.json` e `render.yaml`.
- Supabase obrigatório em produção.
- `.env` e segredos não entram no GitHub.

## Validação
- `node --check` passou no backend e Print Bridge.
- smoke test passou.
- `npm run build` não pôde ser concluído neste ambiente porque a instalação de dependências excedeu o limite de execução; o código deve ser validado no GitHub/Render com `npm ci && npm run build`.
