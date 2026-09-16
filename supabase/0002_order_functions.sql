-- ============================================================================
-- FASE 2 — Pedidos transacionais, idempotentes, com preço calculado no
-- servidor (nunca confiando no valor enviado pelo cliente) e transições de
-- status validadas dentro do próprio banco (defesa em profundidade, além do
-- middleware do Express).
-- ============================================================================

-- Matriz de transições válidas do Kanban (seção 9 do briefing).
create table if not exists public.order_status_transitions (
  from_status text not null,
  to_status text not null,
  primary key (from_status, to_status)
);
insert into public.order_status_transitions (from_status, to_status) values
  ('novo', 'confirmado'),
  ('novo', 'cancelado'),
  ('confirmado', 'preparando'),
  ('confirmado', 'cancelado'),
  ('preparando', 'pronto'),
  ('preparando', 'cancelado'),
  ('pronto', 'em_entrega'),
  ('pronto', 'finalizado'),
  ('em_entrega', 'finalizado'),
  ('em_entrega', 'cancelado')
on conflict do nothing;

-- ----------------------------------------------------------------------------
-- Criação de pedido: atômica, idempotente, com preço recalculado a partir do
-- catálogo (produto/opções) do próprio restaurante — nunca a partir do que o
-- cliente mandou. Isso impede um cliente de manipular preço via requisição manual.
-- ----------------------------------------------------------------------------
create or replace function public.create_order_transactional(
  p_restaurant_id uuid,
  p_source text,
  p_order_type text,
  p_table_id uuid,
  p_customer_id uuid,
  p_created_by uuid,
  p_customer_name text,
  p_customer_phone text,
  p_delivery_address jsonb,
  p_payment_method text,
  p_delivery_fee numeric,
  p_discount numeric,
  p_idempotency_key text,
  p_items jsonb   -- [{ "product_id": "...", "quantity": 2, "notes": "...", "option_ids": ["..."] }]
)
returns public.orders
language plpgsql
security definer
as $$
declare
  v_order public.orders;
  v_existing public.orders;
  v_item jsonb;
  v_option_id uuid;
  v_product record;
  v_option record;
  v_order_item_id uuid;
  v_item_total numeric;
  v_option_total numeric;
  v_subtotal numeric := 0;
  v_short_code text;
begin
  if p_idempotency_key is not null then
    select * into v_existing from public.orders
      where restaurant_id = p_restaurant_id and idempotency_key = p_idempotency_key;
    if found then
      return v_existing;
    end if;
  end if;

  if jsonb_array_length(p_items) = 0 then
    raise exception 'Pedido precisa ter ao menos um item.';
  end if;

  v_short_code := '#' || to_char(now(), 'MMDD') || '-' || substr(md5(random()::text), 1, 4);

  insert into public.orders (
    restaurant_id, short_code, customer_id, source, table_id, status, order_type,
    customer_name, customer_phone, delivery_address, subtotal, delivery_fee, discount, total,
    payment_method, created_by, idempotency_key
  ) values (
    p_restaurant_id, v_short_code, p_customer_id, p_source, p_table_id, 'novo', p_order_type,
    p_customer_name, p_customer_phone, p_delivery_address, 0, coalesce(p_delivery_fee, 0), coalesce(p_discount, 0), 0,
    p_payment_method, p_created_by, p_idempotency_key
  )
  returning * into v_order;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    select id, name, price, destination, restaurant_id into v_product
    from public.products
    where id = (v_item->>'product_id')::uuid;

    if not found or v_product.restaurant_id <> p_restaurant_id then
      raise exception 'Produto % não pertence a este restaurante ou não existe.', (v_item->>'product_id');
    end if;

    v_option_total := 0;

    insert into public.order_items (order_id, product_id, name_snapshot, destination, quantity, unit_price, total_price, notes)
    values (
      v_order.id, v_product.id, v_product.name, v_product.destination,
      coalesce((v_item->>'quantity')::int, 1), v_product.price, 0, v_item->>'notes'
    )
    returning id into v_order_item_id;

    if v_item ? 'option_ids' then
      for v_option_id in select jsonb_array_elements_text(v_item->'option_ids')::uuid
      loop
        select po.id, po.name, po.price_delta into v_option
        from public.product_options po
        join public.product_option_groups g on g.id = po.group_id
        where po.id = v_option_id and g.product_id = v_product.id;

        if not found then
          raise exception 'Opção % inválida para o produto %.', v_option_id, v_product.id;
        end if;

        insert into public.order_item_options (order_item_id, name_snapshot, price_delta)
        values (v_order_item_id, v_option.name, v_option.price_delta);

        v_option_total := v_option_total + v_option.price_delta;
      end loop;
    end if;

    v_item_total := (v_product.price + v_option_total) * coalesce((v_item->>'quantity')::int, 1);
    update public.order_items set total_price = v_item_total where id = v_order_item_id;
    v_subtotal := v_subtotal + v_item_total;
  end loop;

  update public.orders
    set subtotal = v_subtotal,
        total = greatest(v_subtotal + coalesce(p_delivery_fee, 0) - coalesce(p_discount, 0), 0)
    where id = v_order.id
    returning * into v_order;

  insert into public.order_status_history (order_id, status, changed_by, note)
  values (v_order.id, 'novo', p_created_by, 'Pedido criado');

  return v_order;
end;
$$;

-- ----------------------------------------------------------------------------
-- Atualização de status: valida a transição contra order_status_transitions
-- (impede pular etapas ou "ressuscitar" pedido cancelado/finalizado).
-- ----------------------------------------------------------------------------
create or replace function public.update_order_status_transactional(
  p_order_id uuid,
  p_new_status text,
  p_changed_by uuid,
  p_note text default null
)
returns public.orders
language plpgsql
security definer
as $$
declare
  v_current text;
  v_order public.orders;
begin
  select status into v_current from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Pedido % não encontrado.', p_order_id;
  end if;

  if v_current = p_new_status then
    select * into v_order from public.orders where id = p_order_id;
    return v_order; -- idempotente: repetir o mesmo status não é erro
  end if;

  if not exists (
    select 1 from public.order_status_transitions
    where from_status = v_current and to_status = p_new_status
  ) then
    raise exception 'Transição inválida: % -> %.', v_current, p_new_status;
  end if;

  update public.orders set status = p_new_status, updated_at = now()
  where id = p_order_id
  returning * into v_order;

  insert into public.order_status_history (order_id, status, changed_by, note)
  values (p_order_id, p_new_status, p_changed_by, p_note);

  return v_order;
end;
$$;

alter table public.order_status_transitions enable row level security;
create policy order_status_transitions_read on public.order_status_transitions for select using (true);
