# Reparo Supabase V27.4

Execute `database/0028_production_schema_repair.sql` uma vez no Supabase SQL Editor.

Essa migration é idempotente e corrige:
- `public.customers`
- `public.customer_addresses`
- `orders.customer_id`
- `orders.updated_at`
- `orders.payment_status`
- `orders.payment_confirmed_at`
- `public.restaurant_backups`
- `public.realtime_events`
- índices e trigger de `orders.updated_at`
- cache do PostgREST com `NOTIFY pgrst, 'reload schema'`

Depois faça novo deploy do Render.
