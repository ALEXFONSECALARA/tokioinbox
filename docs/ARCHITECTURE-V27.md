# TokioInbox v27 — arquitetura

Estrutura oficial com quatro pastas de código/documentação no nível raiz:

- `frontend/` — frontend React/Vite e assets públicos.
- `backend/` — API Express, adapters de banco, scripts e ponte de impressão.
- `supabase/` — migrations do banco.
- `docs/` — documentação e testes.

Arquivos de configuração do projeto (`package.json`, `render.yaml`, `vite.config.ts`, `tsconfig.json`, `.env.example`) permanecem na raiz porque GitHub/Render/npm esperam esses manifests nesse nível.

## Cliente
- Login por telefone + PIN de 4 dígitos.
- Telefones são normalizados para dígitos; login aceita entrada com máscara e com/sem `55`.
- Token assinado não depende de memória da instância.
- Cliente pode cancelar pedido apenas em `recebido` ou `em_preparo`.
- Cliente pode apagar o próprio histórico mediante senha atual.

## Produção
- Node 22.22.2.
- Supabase obrigatório no Render.
- Nunca versionar `.env` ou chaves secretas.
