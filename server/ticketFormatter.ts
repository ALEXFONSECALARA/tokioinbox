/**
 * Seção "Painel do Caixa e Nota Impressa" do pedido de POS: a origem do
 * pedido precisa sair impressa em destaque no TOPO da comanda térmica.
 * Esta função só formata texto (sem dependência de driver de impressora) —
 * o agente de impressão local (server/printAgentService.ts, já existente)
 * é quem manda a string final pra impressora ESC/POS.
 */

export interface OrderForTicket {
  short_code: string;
  source: 'mesa' | 'balcao' | 'delivery' | 'online';
  order_type: 'delivery' | 'retirada' | 'mesa' | 'balcao';
  table_number?: number | null;
  pickup_code?: number | null;
  customer_name?: string | null;
  customer_phone?: string | null;
}

/** A linha de destaque que vai no topo da comanda — é o que muda por tipo de pedido. */
export function formatTicketHeader(order: OrderForTicket): string {
  if (order.source === 'mesa' && order.table_number) {
    return `🔹 MESA ${String(order.table_number).padStart(2, '0')}`;
  }
  if (order.order_type === 'retirada' && order.pickup_code) {
    return `🔹 BALCÃO - RETIRADA #${order.pickup_code}`;
  }
  if (order.source === 'delivery') {
    return `🔹 DELIVERY${order.pickup_code ? ` #${order.pickup_code}` : ''}`;
  }
  if (order.source === 'balcao' && order.pickup_code) {
    return `🔹 BALCÃO #${order.pickup_code}`;
  }
  return `🔹 PEDIDO ${order.short_code}`;
}

/** Comanda completa em texto puro (largura ~32/42 colunas, padrão de bobina térmica de 58/80mm). */
export function formatFullTicket(
  order: OrderForTicket & { total: number },
  items: { quantity: number; name_snapshot: string; notes?: string | null }[],
  width: 32 | 42 = 32
): string {
  const line = '-'.repeat(width);
  const center = (text: string) => {
    const pad = Math.max(0, Math.floor((width - text.length) / 2));
    return ' '.repeat(pad) + text;
  };

  const lines: string[] = [];
  lines.push(center(formatTicketHeader(order)));
  lines.push(line);
  lines.push(`Pedido: ${order.short_code}`);
  if (order.customer_name) lines.push(`Cliente: ${order.customer_name}`);
  if (order.customer_phone) lines.push(`Tel: ${order.customer_phone}`);
  lines.push(line);
  for (const item of items) {
    lines.push(`${item.quantity}x ${item.name_snapshot}`);
    if (item.notes) lines.push(`   obs: ${item.notes}`);
  }
  lines.push(line);
  lines.push(`TOTAL: R$ ${order.total.toFixed(2)}`);
  return lines.join('\n');
}
