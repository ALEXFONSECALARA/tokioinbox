# TokioInbox v26 — varredura e reorganização

## Corrigido nesta versão

- `frontend/components/` reorganizado por domínio: `admin`, `customer`, `order`, `restaurant`, `printing`, `kanban`, `system`.
- `KanbanOnlyPortal.tsx` + `UnifiedKanbanPortal.tsx` unificados em `components/kanban/KanbanPortal.tsx`, mantendo os dois exports e as duas rotas.
- `backend/lib/db.json.js` e `db.supabase.js` movidos para `backend/lib/adapters/`; `backend/lib/db.js` continua como único ponto de entrada.
- Dados JSON locais movidos para `backend/storage/legacy-json/` para deixar explícito que são apenas fallback de desenvolvimento.
- Produção/Render não pode mais iniciar silenciosamente com JSON quando Supabase estiver ausente.
- Upload de imagens não cai mais para disco efêmero em produção; exige Supabase Storage ou Cloudinary.
- `package.json` e `package-lock.json` agora identificam o projeto como `tokioinbox`.
- Render usa `npm ci` e Node `22.22.2`.
- Migration duplicada `0013` eliminada: a configuração de restaurante foi transformada em migration posterior idempotente (`0024_restaurant_config_complete_reconcile.sql`).
- Criada `0025_schema_consolidation.sql` para compatibilizar `print_jobs` antigos com o contrato atual, normalizar status e remover policies permissivas `USING(true)` de tabelas privadas.
- Importações do frontend foram padronizadas para o alias `@/frontend/...`.

## Pontos que ainda dependem do ambiente

1. Render precisa estar realmente ligado ao commit/branch deste pacote e usar Node 22.x.
2. `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` precisam existir no Environment do serviço.
3. Supabase Storage precisa ter o bucket `restaurant-media` (ou o valor de `SUPABASE_STORAGE_BUCKET`).
4. Rode as migrations novas no mesmo projeto Supabase usado pelo Render.
5. O ZIP foi validado estaticamente; a validação de build depende de instalar as dependências do `package-lock.json` no ambiente de deploy.
