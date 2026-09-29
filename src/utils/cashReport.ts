import type { CashRegisterShift, Order, ReportKind, RestaurantConfig } from '../types/restaurant';

/**
 * V9.2 — Relatório de venda do fechamento de caixa.
 * Considera SOMENTE os pedidos dentro da janela do turno (openedAtIso → closedAtIso/agora).
 * Turnos antigos (sem openedAtIso) usam o dia corrente como janela.
 */

export interface Bucket {
  count: number;
  total: number;
}

export interface CashReport {
  shiftId: string;
  restaurantName: string;
  openedBy?: string;
  closedBy?: string;
  from: Date;
  to: Date;
  ordersCount: number;
  itemsCount: number;
  gross: number;
  discounts: number;
  net: number;
  cancelledCount: number;
  cancelledTotal: number;
  byPayment: Record<'dinheiro' | 'pix' | 'credito' | 'debito' | 'outros', Bucket>;
  byChannel: Record<'mesa' | 'balcao' | 'retirada' | 'delivery' | 'online', Bucket>;
  byOperator: Array<{ name: string } & Bucket>;
  byHour: Array<{ hour: string } & Bucket>;
  byTable: Array<{ table: string } & Bucket>;
  initialAmount: number;
  sangrias: number;
  suprimentos: number;
  expectedCash: number;
  countedCash: number | null;
  difference: number | null;
  note?: string;
}

const bucket = (): Bucket => ({ count: 0, total: 0 });
const add = (b: Bucket, v: number) => {
  b.count += 1;
  b.total += v;
};

function isPaid(o: Order): boolean {
  return Boolean(o.paymentDetails?.paid) || o.status === 'finalizado' || o.status === 'entregue';
}

export function buildCashReport(
  shift: CashRegisterShift,
  orders: Order[],
  restaurants: Record<string, RestaurantConfig>,
  opts: { slug?: string; to?: Date } = {}
): CashReport {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const from = shift.openedAtIso ? new Date(shift.openedAtIso) : startOfToday;
  const to = shift.closedAtIso ? new Date(shift.closedAtIso) : opts.to || new Date();

  const inWindow = orders.filter((o) => {
    const t = new Date(o.createdAt).getTime();
    if (t < from.getTime() || t > to.getTime()) return false;
    return !opts.slug || opts.slug === 'all' || o.restaurantSlug === opts.slug;
  });

  const byPayment: CashReport['byPayment'] = { dinheiro: bucket(), pix: bucket(), credito: bucket(), debito: bucket(), outros: bucket() };
  const byChannel: CashReport['byChannel'] = { mesa: bucket(), balcao: bucket(), retirada: bucket(), delivery: bucket(), online: bucket() };
  const ops = new Map<string, Bucket>();
  const hours = new Map<string, Bucket>();
  const tables = new Map<string, Bucket>();
  let itemsCount = 0, gross = 0, discounts = 0, cancelledCount = 0, cancelledTotal = 0, ordersCount = 0;

  for (const o of inWindow) {
    if (o.status === 'cancelado') {
      cancelledCount += 1;
      cancelledTotal += o.total;
      continue;
    }
    if (!isPaid(o)) continue; // pedido em aberto não entra no faturamento
    ordersCount += 1;
    gross += o.total + (o.discount || 0);
    discounts += o.discount || 0;
    itemsCount += o.items.reduce((s, i) => s + i.quantity, 0);

    const pay =
      o.paymentMethod === 'dinheiro' ? 'dinheiro'
      : o.paymentMethod === 'pix' ? 'pix'
      : o.paymentMethod === 'cartao_credito' ? 'credito'
      : o.paymentMethod === 'cartao_debito' ? 'debito'
      : 'outros';
    add(byPayment[pay], o.total);
    add(byChannel[o.orderType in byChannel ? o.orderType : 'balcao'], o.total);

    const op = o.waiterName?.trim() || 'Sem operador';
    add(ops.get(op) || ops.set(op, bucket()).get(op)!, o.total);
    const h = `${String(new Date(o.createdAt).getHours()).padStart(2, '0')}h`;
    add(hours.get(h) || hours.set(h, bucket()).get(h)!, o.total);
    if (o.orderType === 'mesa') {
      const tb = `Mesa ${o.tableNumber ?? 'S/N'}`;
      add(tables.get(tb) || tables.set(tb, bucket()).get(tb)!, o.total);
    }
  }

  const sum = (t: string) => shift.movements.filter((m) => m.type === t).reduce((s, m) => s + m.amount, 0);
  const sangrias = sum('sangria');
  // suprimento inclui o fundo inicial (lançado na abertura); o "extra" é o que passa do fundo
  const suprimentos = Math.max(0, sum('suprimento') - shift.initialAmount);
  const cashSales = byPayment.dinheiro.total;
  const expectedCash = Number((shift.initialAmount + suprimentos + cashSales - sangrias).toFixed(2));
  const counted = shift.closing?.countedCash ?? null;

  const sorted = <T extends Bucket>(m: Map<string, T>, key: string) =>
    [...m.entries()].map(([k, v]) => ({ [key]: k, ...v })).sort((a: any, b: any) => b.total - a.total);

  return {
    shiftId: shift.id,
    restaurantName: !opts.slug || opts.slug === 'all' ? 'Todas as lojas' : restaurants[opts.slug]?.name || opts.slug,
    openedBy: shift.openedBy,
    closedBy: shift.closedBy,
    from, to, ordersCount, itemsCount, gross, discounts, net: gross - discounts,
    cancelledCount, cancelledTotal, byPayment, byChannel,
    byOperator: sorted(ops, 'name') as any,
    byHour: (sorted(hours, 'hour') as any).sort((a: any, b: any) => a.hour.localeCompare(b.hour)),
    byTable: sorted(tables, 'table') as any,
    initialAmount: shift.initialAmount, sangrias, suprimentos, expectedCash,
    countedCash: counted,
    difference: counted == null ? null : Number((counted - expectedCash).toFixed(2)),
    note: shift.closing?.note,
  };
}

const money = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`;
const esc = (v: unknown) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const dt = (d: Date) => d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

/** HTML do relatório (80 mm). `kinds` = tipos marcados em Ferramentas. */
export function cashReportHtml(r: CashReport, kinds: ReportKind[]): string {
  const has = (k: ReportKind) => kinds.includes(k);
  const row = (label: string, b: Bucket) =>
    `<tr><td>${esc(label)}</td><td class="c">${b.count}</td><td class="r">${money(b.total)}</td></tr>`;
  const section = (title: string, rows: string) =>
    rows ? `<h4>${esc(title)}</h4><table><tr><th></th><th class="c">Qtd</th><th class="r">Total</th></tr>${rows}</table>` : '';

  const pay = [
    has('dinheiro') && row('Dinheiro', r.byPayment.dinheiro),
    has('pix') && row('PIX', r.byPayment.pix),
    has('credito') && row('Cartão crédito', r.byPayment.credito),
    has('debito') && row('Cartão débito', r.byPayment.debito),
    has('outros') && r.byPayment.outros.count > 0 && row('Outros', r.byPayment.outros),
  ].filter(Boolean).join('');
  const ch = [
    has('mesa') && row('Consumo no salão (mesas)', r.byChannel.mesa),
    has('balcao') && row('Balcão', r.byChannel.balcao),
    has('retirada') && row('Retirada', r.byChannel.retirada),
    has('delivery') && row('Delivery', r.byChannel.delivery),
    has('delivery') && r.byChannel.online.count > 0 && row('Online', r.byChannel.online),
  ].filter(Boolean).join('');

  return `<!doctype html><html><head><meta charset="utf-8"><title>Relatório de venda</title><style>
@page{size:80mm auto;margin:3mm}body{font:11px/1.35 monospace;width:74mm;margin:0;color:#000}
h3{text-align:center;margin:0 0 2px;font-size:14px}h4{margin:8px 0 2px;border-bottom:1px dashed #000;font-size:11px}
table{width:100%;border-collapse:collapse}td,th{padding:1px 0;text-align:left;font-weight:normal}th{font-size:9px;color:#444}
.c{text-align:center}.r{text-align:right}.b{font-weight:bold}.hr{border-top:1px dashed #000;margin:6px 0}
</style></head><body>
<h3>RELATÓRIO DE VENDA</h3>
<div class="c">${esc(r.restaurantName)}</div>
<div class="c">${dt(r.from)} → ${dt(r.to)}</div>
<div class="c">Abertura: ${esc(r.openedBy || '-')} • Fechamento: ${esc(r.closedBy || '-')}</div>
<div class="hr"></div>
<table>
<tr><td>Pedidos pagos</td><td class="r">${r.ordersCount}</td></tr>
<tr><td>Itens vendidos</td><td class="r">${r.itemsCount}</td></tr>
<tr><td>Total bruto</td><td class="r">${money(r.gross)}</td></tr>
<tr><td>Descontos</td><td class="r">- ${money(r.discounts)}</td></tr>
<tr class="b"><td>Total líquido</td><td class="r">${money(r.net)}</td></tr>
<tr><td>Cancelamentos</td><td class="r">${r.cancelledCount} (${money(r.cancelledTotal)})</td></tr>
</table>
${section('Por forma de pagamento', pay)}
${section('Por tipo de venda', ch)}
${section('Por operador', r.byOperator.map((o) => row(o.name, o)).join(''))}
${section('Por período (hora)', r.byHour.map((h) => row(h.hour, h)).join(''))}
${has('mesa') ? section('Por mesa', r.byTable.map((t) => row(t.table, t)).join('')) : ''}
<h4>Gaveta (dinheiro)</h4>
<table>
<tr><td>Fundo inicial</td><td class="r">${money(r.initialAmount)}</td></tr>
<tr><td>+ Vendas em dinheiro</td><td class="r">${money(r.byPayment.dinheiro.total)}</td></tr>
<tr><td>+ Suprimentos</td><td class="r">${money(r.suprimentos)}</td></tr>
<tr><td>- Sangrias</td><td class="r">${money(r.sangrias)}</td></tr>
<tr class="b"><td>Valor esperado</td><td class="r">${money(r.expectedCash)}</td></tr>
<tr><td>Valor informado</td><td class="r">${r.countedCash == null ? '-' : money(r.countedCash)}</td></tr>
<tr class="b"><td>Diferença</td><td class="r">${r.difference == null ? '-' : money(r.difference)}</td></tr>
</table>
${r.note ? `<div class="hr"></div><div>Obs.: ${esc(r.note)}</div>` : ''}
<div class="hr"></div><div class="c">Emitido em ${dt(new Date())}</div>
</body></html>`;
}

/** Impressão pelo navegador (iframe oculto). Não envia nada ao servidor. */
export function printCashReport(r: CashReport, kinds: ReportKind[]): void {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
  document.body.appendChild(iframe);
  const doc = iframe.contentWindow!.document;
  doc.open();
  doc.write(cashReportHtml(r, kinds));
  doc.close();
  setTimeout(() => {
    try {
      iframe.contentWindow!.focus();
      iframe.contentWindow!.print();
    } finally {
      setTimeout(() => iframe.remove(), 2000);
    }
  }, 250);
}
