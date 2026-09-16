import { getAdminClient } from './db';

/**
 * FASE 2 — Substitui o antigo server/orderService.ts (arquivo data/orders.json)
 * por tabelas reais no Postgres. IMPORTANTE: como este service usa o client
 * admin (service role, que ignora RLS), toda função aqui filtra explicitamente
 * por restaurant_id/customer_id no código — nunca dependemos só do banco para
 * isolar dados quando a chamada vem do backend.
 */

export interface CreateOrderItemInput {
  productId: string;
  quantity: number;
  notes?: string;
  optionIds?: string[];
}

export interface CreateOrderInput {
  restaurantId: string;
  source: 'mesa' | 'balcao' | 'delivery' | 'online';
  orderType: 'delivery' | 'retirada' | 'mesa' | 'balcao';
  tableId?: string;
  customerId?: string;
  createdBy?: string;
  customerName?: string;
  customerPhone?: string;
  deliveryAddress?: Record<string, unknown>;
  paymentMethod?: string;
  deliveryFee?: number;
  discount?: number;
  idempotencyKey?: string;
  pickupCode?: number; // 1-100, identifica pedido de balcão/retirada na comanda térmica
  items: CreateOrderItemInput[];
}

export async function createOrder(input: CreateOrderInput) {
  const admin = getAdminClient();
  const { data, error } = await admin.rpc('create_order_transactional', {
    p_restaurant_id: input.restaurantId,
    p_source: input.source,
    p_order_type: input.orderType,
    p_table_id: input.tableId ?? null,
    p_customer_id: input.customerId ?? null,
    p_created_by: input.createdBy ?? null,
    p_customer_name: input.customerName ?? null,
    p_customer_phone: input.customerPhone ?? null,
    p_delivery_address: input.deliveryAddress ?? null,
    p_payment_method: input.paymentMethod ?? null,
    p_delivery_fee: input.deliveryFee ?? 0,
    p_discount: input.discount ?? 0,
    p_idempotency_key: input.idempotencyKey ?? null,
    p_pickup_code: input.pickupCode ?? null,
    p_items: input.items.map((i) => ({
      product_id: i.productId,
      quantity: i.quantity,
      notes: i.notes ?? null,
      option_ids: i.optionIds ?? [],
    })),
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function updateOrderStatus(
  orderId: string,
  restaurantId: string,
  newStatus: string,
  changedBy: string,
  note?: string
) {
  const admin = getAdminClient();
  // Confere que o pedido é do restaurante informado ANTES de mudar o status —
  // impede um usuário autorizado no restaurante A de alterar pedido do B só
  // adivinhando o order_id.
  const { data: existing, error: fetchErr } = await admin
    .from('orders')
    .select('id, restaurant_id')
    .eq('id', orderId)
    .single();
  if (fetchErr || !existing) throw new Error('Pedido não encontrado.');
  if (existing.restaurant_id !== restaurantId) {
    throw new Error('Este pedido não pertence ao restaurante informado.');
  }

  const { data, error } = await admin.rpc('update_order_status_transactional', {
    p_order_id: orderId,
    p_new_status: newStatus,
    p_changed_by: changedBy,
    p_note: note ?? null,
  });
  if (error) throw new Error(error.message);
  return data;
}

/** Kanban central — todos os pedidos de UM restaurante, com itens. */
export async function listOrdersForKanban(restaurantId: string, statuses?: string[]) {
  const admin = getAdminClient();
  let query = admin
    .from('orders')
    .select(
      `id, order_number, short_code, source, status, order_type, table_id, customer_name, customer_phone,
       subtotal, delivery_fee, discount, total, payment_method, payment_status, created_at, updated_at,
       order_items ( id, name_snapshot, destination, quantity, unit_price, total_price, notes,
         order_item_options ( name_snapshot, price_delta ) )`
    )
    .eq('restaurant_id', restaurantId)
    .order('created_at', { ascending: false });
  if (statuses?.length) {
    query = query.in('status', statuses);
  }
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data;
}

/** Pedidos filtrados por destino (cozinha/sushibar) — visão restrita dessas equipes. */
export async function listOrdersByDestination(restaurantId: string, destination: string) {
  const admin = getAdminClient();
  const { data, error } = await admin
    .from('orders')
    .select(
      `id, short_code, status, order_type, table_id, created_at,
       order_items!inner ( id, name_snapshot, destination, quantity, notes )`
    )
    .eq('restaurant_id', restaurantId)
    .eq('order_items.destination', destination)
    .in('status', ['novo', 'confirmado', 'preparando', 'pronto'])
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return data;
}

export async function getOrderById(orderId: string, restaurantId: string) {
  const admin = getAdminClient();
  const { data, error } = await admin
    .from('orders')
    .select(
      `*, order_items ( *, order_item_options (*) ), order_status_history ( status, note, created_at, changed_by )`
    )
    .eq('id', orderId)
    .eq('restaurant_id', restaurantId)
    .single();
  if (error) throw new Error(error.message);
  return data;
}

/** Histórico do próprio cliente, nunca de outros — sempre filtrado por customer_id explícito. */
export async function listOrdersForCustomer(customerId: string, restaurantId?: string) {
  const admin = getAdminClient();
  let query = admin
    .from('orders')
    .select('id, restaurant_id, short_code, status, order_type, total, created_at, order_items(name_snapshot, quantity)')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false });
  if (restaurantId) query = query.eq('restaurant_id', restaurantId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data;
}
