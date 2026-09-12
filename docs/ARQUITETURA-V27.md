# TokioInbox v27

Estrutura deliberadamente plana: cinco diretórios na raiz, sem subpastas.

- `frontend`: aplicação React, componentes, utilitários, tipos e assets.
- `backend`: API Express, adapters de banco, autenticação, impressão e dados locais de desenvolvimento.
- `database`: migrations SQL do Supabase.
- `docs`: documentação e testes.
- `tools`: scripts auxiliares e arquivos de apoio.

Produção exige Supabase e armazenamento persistente de mídia. Node 22 é obrigatório.
