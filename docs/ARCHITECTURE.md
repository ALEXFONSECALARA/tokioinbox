# TokioInbox — arquitetura v26

## Frontend
- `frontend/App.tsx`: cardápio/checkout do cliente.
- `frontend/Router.tsx`: roteamento por slug e portais.
- `frontend/components/admin/`: painel, usuários, IA, notificações e ferramentas.
- `frontend/components/customer/`: conta, endereços e instalação.
- `frontend/components/order/`: carrinho, checkout e produtos.
- `frontend/components/restaurant/`: landing, identidade e experiência do restaurante.
- `frontend/components/printing/`: impressão térmica e documentos.
- `frontend/components/kanban/KanbanPortal.tsx`: Kanban individual + Kanban geral, compartilhando componentes.
- `frontend/components/system/`: conexão, deploy watcher e upload.

## Backend
- `backend/index.js`: HTTP/API.
- `backend/lib/db.js`: único ponto de entrada do banco.
- `backend/lib/adapters/db.supabase.js`: produção/Supabase.
- `backend/lib/adapters/db.json.js`: fallback apenas para desenvolvimento/local.
- `backend/storage/legacy-json/`: dados locais de desenvolvimento; não usar como armazenamento de produção.

## Regras de produção
1. Node 22.x.
2. Supabase obrigatório.
3. Imagens devem usar armazenamento persistente (Cloudinary).
4. Não adicionar novas migrations com números duplicados.
5. Alterações de schema devem ser aditivas e compatíveis com bancos já migrados.
