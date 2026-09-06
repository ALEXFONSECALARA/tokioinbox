# TokioInbox V19 — Hardening / Bugfix

V19 é uma evolução de confiabilidade sobre V14–V18, preservando o modo cliente.

## Correções
- ADMIN_PASSWORD obrigatório em produção.
- CORS explícito em produção via CORS_ORIGINS.
- request/correlation ID em respostas (`X-Request-ID`).
- realtime compartilhado com cursor independente por restaurante.
- atualização de pagamento com `expectedUpdatedAt` e conflito 409.
- fila de impressão com claim/lease para evitar dupla impressão.
- recuperação de job preso em `imprimindo` após expiração do lease.
- restore cria backup de segurança antes de modificar configuração/cardápio.
- logs continuam persistentes e agora recebem contexto de request quando aplicável.

## Migração
Execute `supabase/migrations/0021_v19_hardening.sql` após todas as migrations anteriores.

## Produção
Configure obrigatoriamente:
- `NODE_ENV=production`
- `ADMIN_PASSWORD`
- `CORS_ORIGINS`
- credenciais Supabase quando usar Supabase

O cliente público não foi alterado propositalmente.
