# TokioInbox V14 → V18

Esta entrega consolida a plataforma para produção.

## V14 — impressão operacional
- Fila persistente de impressão (V13).
- Print Bridge local ESC/POS via TCP em `print-bridge/`.
- Retry manual pela fila e estados persistentes.

## V15 — produção e segurança
- Rate limiting por IP e limites mais rígidos para login/cadastro.
- CORS configurável com `CORS_ORIGINS`.
- Logout explícito de admin e cliente.
- Eventos compartilhados em `realtime_events` no Supabase; cada instância faz relay para seus clientes SSE.

## V16 — qualidade
- Smoke tests e teste da máquina de estados em `tests/server/`.
- Endpoint de health/readiness já existente e documentação consolidada.

## V17 — operação de entrega
- CRUD de entregadores por restaurante.
- Status disponível/ocupado/offline.
- Conciliação manual de pagamento: pendente/confirmado/recusado/reembolsado.

## V18 — continuidade comercial
- Backup persistente por restaurante.
- Restore seguro de configuração + categorias + cardápio; pedidos históricos não são sobrescritos automaticamente.
- API pronta para expansão de recompra/fidelidade.

### Migração obrigatória
Execute `supabase/migrations/0020_v14_v18.sql` depois das migrações anteriores.

### Produção
Defina pelo menos `ADMIN_PASSWORD`, `CORS_ORIGINS`, `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`. Para impressão, configure o Print Bridge na máquina conectada à impressora.
