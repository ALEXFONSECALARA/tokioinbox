-- ============================================================================
-- POS — código de retirada/balcão (1 a 100) para identificar o pedido na
-- comanda térmica sem precisar de uma mesa física.
-- ============================================================================
alter table public.orders add column if not exists pickup_code int;
comment on column public.orders.pickup_code is 'Número de identificação (1-100) para pedidos de balcão/retirada, exibido em destaque na comanda térmica.';
