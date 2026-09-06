# Deploy V19

## Variáveis obrigatórias em produção
- NODE_ENV=production
- ADMIN_PASSWORD=<senha forte>
- CORS_ORIGINS=https://seu-dominio.com,https://admin.seu-dominio.com
- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY

## Banco
Execute, em ordem, todas as migrations anteriores e depois:
`supabase/migrations/0021_v19_hardening.sql`

## Print Bridge
Configure:
- TOKIO_API_URL=http://servidor:3001
- TOKIO_RESTAURANT_SLUG=slug-da-loja
- TOKIO_ADMIN_TOKEN=token-do-admin
- TOKIO_WORKER_ID=nome-unico-do-computador
- PRINTER_HOST=IP_DA_IMPRESSORA
- PRINTER_PORT=9100
- POLL_MS=2000

V19 usa claim/lease para impedir que dois bridges peguem o mesmo job simultaneamente.
