import { getAdminClient } from './db';
import { formatTicketHeader, formatFullTicket } from './ticketFormatter';

/**
 * FASE 5 — Impressão idempotente. Cada job tem uma idempotency_key única por
 * restaurante (unique constraint no banco: restaurants_id + idempotency_key),
 * então mesmo que essa função seja chamada duas vezes para o mesmo evento
 * (ex: dois clientes de socket recebendo o mesmo update e cada um tentando
 * enfileirar a impressão), o banco recusa o segundo insert e não duplica.
 */

const DESTINATIONS_THAT_PRINT_ON_CREATE = ['cozinha', 'sushibar', 'bar', 'outro'];

export async function enqueuePrintJobsOnOrderCreated(orderId: string, restaurantId: string) {
  const admin = getAdminClient();
  const { data: order, error: orderErr } = await admin
    .from('orders')
    .select('short_code, source, order_type, table_id, pickup_code, customer_name, customer_phone, total, tables(number)')
    .eq('id', orderId)
    .single();
  if (orderErr || !order) throw new Error(orderErr?.message || 'Pedido não encontrado.');

  const { data: items, error } = await admin
    .from('order_items')
    .select('destination, quantity, name_snapshot, notes')
    .eq('order_id', orderId);
  if (error) throw new Error(error.message);

  const destinations = Array.from(
    new Set((items ?? []).map((i) => i.destination).filter((d) => DESTINATIONS_THAT_PRINT_ON_CREATE.includes(d)))
  );

  const ticketOrder = {
    short_code: order.short_code,
    source: order.source,
    order_type: order.order_type,
    table_number: (order as any).tables?.number ?? null,
    pickup_code: order.pickup_code,
    customer_name: order.customer_name,
    customer_phone: order.customer_phone,
    total: Number(order.total ?? 0),
  };
  // Cabeçalho em destaque (seção "Painel do Caixa e Nota Impressa" do briefing de POS),
  // já pronto dentro do payload — o agente de impressão só manda pra impressora.
  const ticketHeader = formatTicketHeader(ticketOrder);
  const ticketText = formatFullTicket(ticketOrder, items ?? []);

  const jobs = destinations.map((destination) => ({
    restaurant_id: restaurantId,
    order_id: orderId,
    destination,
    idempotency_key: `${orderId}:${destination}:novo`,
    status: 'pendente',
    payload: { orderId, destination, event: 'novo', ticketHeader, ticketText },
  }));

  if (jobs.length === 0) return [];

  // on conflict do nothing (constraint unique(restaurant_id, idempotency_key)) evita duplicar
  const { data, error: insertErr } = await admin
    .from('print_jobs')
    .upsert(jobs, { onConflict: 'restaurant_id,idempotency_key', ignoreDuplicates: true })
    .select();
  if (insertErr) throw new Error(insertErr.message);
  return data ?? [];
}

/** Ticket de "pronto" para o caixa/motoboy, também idempotente por status. */
export async function enqueuePrintJobOnStatusChange(orderId: string, restaurantId: string, status: string) {
  if (!['pronto', 'em_entrega'].includes(status)) return null;
  const destination = status === 'pronto' ? 'caixa' : 'motoboy';
  const admin = getAdminClient();
  const { data: order } = await admin
    .from('orders')
    .select('short_code, source, order_type, pickup_code, customer_name, tables(number)')
    .eq('id', orderId)
    .single();
  const ticketHeader = order
    ? formatTicketHeader({
        short_code: order.short_code,
        source: order.source,
        order_type: order.order_type,
        table_number: (order as any).tables?.number ?? null,
        pickup_code: order.pickup_code,
      })
    : undefined;
  const { data, error } = await admin
    .from('print_jobs')
    .upsert(
      [
        {
          restaurant_id: restaurantId,
          order_id: orderId,
          destination,
          idempotency_key: `${orderId}:${destination}:${status}`,
          status: 'pendente',
          payload: { orderId, destination, event: status, ticketHeader },
        },
      ],
      { onConflict: 'restaurant_id,idempotency_key', ignoreDuplicates: true }
    )
    .select();
  if (error) throw new Error(error.message);
  return data?.[0] ?? null;
}

export async function listPendingPrintJobs(restaurantId: string, destination?: string) {
  const admin = getAdminClient();
  let query = admin.from('print_jobs').select('*').eq('restaurant_id', restaurantId).eq('status', 'pendente');
  if (destination) query = query.eq('destination', destination);
  const { data, error } = await query.order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return data;
}

/** Marca como impresso — chamada pelo agente de impressão local depois de imprimir de fato. */
export async function markPrintJobPrinted(printJobId: string, restaurantId: string) {
  const admin = getAdminClient();
  const { error } = await admin
    .from('print_jobs')
    .update({ status: 'impresso', printed_at: new Date().toISOString() })
    .eq('id', printJobId)
    .eq('restaurant_id', restaurantId);
  if (error) throw new Error(error.message);
}
