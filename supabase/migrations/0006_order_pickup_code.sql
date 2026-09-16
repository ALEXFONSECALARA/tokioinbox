-- ============================================================================
-- Atualiza create_order_transactional para aceitar pickup_code (número de
-- balcão/retirada 1-100, seção "Fluxo de Atendimento Rápido" do pedido).
-- Precisa DROP + CREATE porque estamos mudando a assinatura da função.
-- ============================================================================
drop function if exists public.create_order_transactional(
  uuid, text, text, uuid, uuid, uuid, text, text, jsonb, text, numeric, numeric, text, jsonb
);

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
  p_items jsonb,
  p_pickup_code int default null
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

  if p_pickup_code is not null and (p_pickup_code < 1 or p_pickup_code > 100) then
    raise exception 'Código de retirada/balcão precisa estar entre 1 e 100.';
  end if;

  v_short_code := '#' || to_char(now(), 'MMDD') || '-' || substr(md5(random()::text), 1, 4);

  insert into public.orders (
    restaurant_id, short_code, customer_id, source, table_id, status, order_type,
    customer_name, customer_phone, delivery_address, subtotal, delivery_fee, discount, total,
    payment_method, created_by, idempotency_key, pickup_code
  ) values (
    p_restaurant_id, v_short_code, p_customer_id, p_source, p_table_id, 'novo', p_order_type,
    p_customer_name, p_customer_phone, p_delivery_address, 0, coalesce(p_delivery_fee, 0), coalesce(p_discount, 0), 0,
    p_payment_method, p_created_by, p_idempotency_key, p_pickup_code
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

revoke execute on function public.create_order_transactional(
  uuid, text, text, uuid, uuid, uuid, text, text, jsonb, text, numeric, numeric, text, jsonb, int
) from public, anon, authenticated;
