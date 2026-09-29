import { buildCashReport, cashReportHtml } from '../src/utils/cashReport';
let ok = 0, bad = 0;
const t = (n: string, c: boolean, x = '') => { c ? ok++ : bad++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${c ? '' : ' -> ' + x}`); };
const base = Date.parse('2026-09-28T12:00:00Z');
const iso = (m: number) => new Date(base + m * 60000).toISOString();
const mk = (id: string, m: number, o: any) => ({ id, createdAt: iso(m), restaurantSlug: 'a', orderType: 'mesa', tableNumber: 1, status: 'finalizado',
  paymentMethod: 'dinheiro', discount: 0, total: 50, items: [{ quantity: 2 }], waiterName: 'Ana', paymentDetails: { paid: true }, ...o }) as any;
const shift: any = { id: 's1', openedAtIso: iso(0), initialAmount: 100, isClosed: false, openedBy: 'Bia',
  movements: [{ type: 'suprimento', amount: 100 }, { type: 'suprimento', amount: 30 }, { type: 'sangria', amount: 40 }] };
const orders = [
  mk('1', 5, {}),                                            // dinheiro 50
  mk('2', 10, { paymentMethod: 'pix', total: 80, orderType: 'delivery', discount: 10, items: [{ quantity: 1 }] }),
  mk('3', 15, { paymentMethod: 'cartao_credito', total: 120, orderType: 'balcao', waiterName: 'Caio', tableNumber: undefined }),
  mk('4', 20, { paymentMethod: 'cartao_debito', total: 30, tableNumber: 2 }),
  mk('5', 25, { status: 'cancelado', total: 999, paymentDetails: { paid: false } }),
  mk('6', 30, { status: 'em_preparo', total: 777, paymentDetails: { paid: false } }),   // em aberto: fora
  mk('7', -60, { total: 500 }),                                                        // antes do turno: fora
  mk('8', 12, { restaurantSlug: 'b', total: 300 }),
];
const r = buildCashReport(shift, orders, { a: { name: 'Loja A' } } as any, { slug: 'a', to: new Date(base + 3600000) });
t('pedidos pagos = 4 (exclui cancelado, aberto, fora da janela e outra loja)', r.ordersCount === 4, String(r.ordersCount));
t('bruto = líquido + descontos', Math.abs(r.gross - (r.net + r.discounts)) < 0.001);
t('descontos = 10', r.discounts === 10);
t('líquido = 280', r.net === 280, String(r.net));
t('cancelados = 1 (R$ 999)', r.cancelledCount === 1 && r.cancelledTotal === 999);
t('dinheiro 1x50 / pix 1x80 / crédito 1x120 / débito 1x30',
  r.byPayment.dinheiro.total === 50 && r.byPayment.pix.total === 80 && r.byPayment.credito.total === 120 && r.byPayment.debito.total === 30);
t('soma das formas de pagamento = líquido', r.byPayment.dinheiro.total + r.byPayment.pix.total + r.byPayment.credito.total + r.byPayment.debito.total === r.net);
t('canal: 2 mesas, 1 delivery, 1 balcão', r.byChannel.mesa.count === 2 && r.byChannel.delivery.count === 1 && r.byChannel.balcao.count === 1);
t('itens vendidos = 2+1+2+2 = 7', r.itemsCount === 7, String(r.itemsCount));
t('por operador: Ana 3, Caio 1', r.byOperator.find((o) => o.name === 'Ana')?.count === 3 && r.byOperator.find((o) => o.name === 'Caio')?.count === 1);
t('por mesa: Mesa 1 e Mesa 2', r.byTable.length === 2);
t('suprimento extra = 30 (100 do fundo não conta em dobro)', r.suprimentos === 30, String(r.suprimentos));
t('esperado gaveta = 100 + 30 + 50 - 40 = 140', r.expectedCash === 140, String(r.expectedCash));
const r2 = buildCashReport({ ...shift, closing: { expectedCash: 140, countedCash: 135, difference: -5 } }, orders, {}, { slug: 'a', to: new Date(base + 3600000) });
t('diferença = informado − esperado = −5', r2.difference === -5, String(r2.difference));
const html = cashReportHtml(r, ['pix']);
t('relatório respeita tipos marcados (só PIX)', html.includes('PIX') && !html.includes('Cartão crédito') && !html.includes('>Dinheiro<'));
const html2 = cashReportHtml(r, ['dinheiro', 'pix', 'credito', 'debito', 'delivery', 'mesa', 'retirada', 'balcao', 'outros']);
t('com todos os tipos aparecem todas as seções', html2.includes('Cartão crédito') && html2.includes('Delivery') && html2.includes('Por mesa'));
const evil = cashReportHtml({ ...r, restaurantName: '<script>x</script>' }, ['pix']);
t('HTML escapa texto (sem <script> injetado)', !evil.includes('<script>x'));
console.log(`\n${ok} ok, ${bad} falhas`); process.exit(bad ? 1 : 0);
