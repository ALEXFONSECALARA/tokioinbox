import type {
  ConferenceAutoPrintOptions,
  ConferenceSource,
  Order,
  PrinterSettings,
  RestaurantConfig,
} from '../types/restaurant';

/**
 * V9 ULTRA PLUS — CUPOM DE CONFERÊNCIA AUTOMÁTICO
 *
 * Ao clicar no botão de FECHAMENTO (Garçom, Caixa, Salão, Balcão, Retirada,
 * Delivery e Pedidos) o cupom de conferência é impresso sozinho, sem abrir
 * modal, na impressora já escolhida no Caixa.
 *
 * Caminhos de impressão:
 *  1. Agente de Impressão (/api/print-agent) → 100% silencioso, vai direto
 *     para a impressora térmica escolhida no Caixa (estação CAIXA).
 *  2. Navegador (iframe oculto + window.print) → usado quando não há agente/
 *     impressora cadastrada. Para NÃO aparecer a janela de impressão, abra o
 *     Chrome/Edge do caixa com o atalho `--kiosk-printing`.
 */

export const DEFAULT_CONFERENCE_OPTIONS: ConferenceAutoPrintOptions = {
  enabled: true,
  sources: {
    garcom: true,
    caixa: true,
    mesa: true,
    balcao: true,
    retirada: true,
    delivery: true,
    pedidos: true,
  },
  copies: 1,
  mode: 'auto',
};

export function getConferenceOptions(settings?: Partial<PrinterSettings> | null): ConferenceAutoPrintOptions {
  const saved = settings?.conferenceAutoPrint;
  return {
    ...DEFAULT_CONFERENCE_OPTIONS,
    ...(saved || {}),
    sources: { ...DEFAULT_CONFERENCE_OPTIONS.sources, ...(saved?.sources || {}) },
  };
}

const money = (v: number | undefined) => `R$ ${(Number(v) || 0).toFixed(2).replace('.', ',')}`;

const esc = (v: unknown) =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const noAccents = (v: string) => v.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

function originLabel(order: Order): string {
  if (order.orderType === 'mesa') return `MESA ${order.tableNumber ?? 'S/N'}`;
  if (order.orderType === 'delivery') return 'ENTREGA DELIVERY';
  return `SENHA ${order.pickupNumber ?? ((order.shortCode || '').replace(/\D/g, '') || '01')}`;
}

/** Junta todos os pedidos abertos da mesma mesa em uma única conferência. */
export function mergeOrdersForConference(orders: Order[]): Order {
  if (orders.length <= 1) return orders[0];
  const base = orders[0];
  return {
    ...base,
    items: orders.flatMap((o) => o.items),
    subtotal: orders.reduce((s, o) => s + (o.subtotal || 0), 0),
    discount: orders.reduce((s, o) => s + (o.discount || 0), 0),
    deliveryFee: orders.reduce((s, o) => s + (o.deliveryFee || 0), 0),
    serviceFee: orders.reduce((s, o) => s + (o.serviceFee || 0), 0),
    total: orders.reduce((s, o) => s + (o.total || 0), 0),
  };
}

/** HTML do cupom (58mm ou 80mm) — impressão pelo navegador. */
export function buildConferenceHtml(
  order: Order,
  restaurant: Partial<RestaurantConfig> | undefined,
  paperWidth: '80mm' | '58mm' = '80mm'
): string {
  const w = paperWidth === '58mm' ? '48mm' : '72mm';
  const fs = paperWidth === '58mm' ? '10px' : '12px';
  const now = new Date().toLocaleString('pt-BR');

  const items = (order.items || [])
    .map((it) => {
      const opts = it.selectedOptions?.length
        ? `<div class="sub">${esc(it.selectedOptions.map((o) => `+ ${o.name}`).join(' | '))}</div>`
        : '';
      const obs = it.notes ? `<div class="sub">OBS: ${esc(it.notes)}</div>` : '';
      return `<div class="row b"><span>${it.quantity}x ${esc(it.name)}</span><span>${money(it.totalPrice)}</span></div>${opts}${obs}`;
    })
    .join('');

  const address =
    order.orderType === 'delivery' && order.deliveryAddress
      ? `<div class="sub">${esc(order.deliveryAddress.street)}, ${esc(order.deliveryAddress.number)} - ${esc(
          order.deliveryAddress.neighborhood
        )}</div>`
      : '';

  return `<!doctype html><html><head><meta charset="utf-8"><title>Conferência ${esc(order.shortCode)}</title>
<style>
@page { size: ${paperWidth} auto; margin: 0; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: #fff; }
body { width: ${w}; margin: 0 auto; padding: 3mm 0; font: ${fs}/1.35 "Courier New", monospace; color: #000; }
.c { text-align: center; }
.b { font-weight: 700; }
.big { font-size: 1.5em; font-weight: 900; letter-spacing: .04em; }
.row { display: flex; justify-content: space-between; gap: 6px; }
.sub { padding-left: 8px; font-size: .88em; }
.hr { border-top: 1px dashed #000; margin: 5px 0; }
</style></head><body>
<div class="c b">${esc(restaurant?.name || order.restaurantName || '')}</div>
<div class="c">*** CONFERENCIA - NAO FISCAL ***</div>
<div class="hr"></div>
<div class="c big">${esc(originLabel(order))}</div>
<div class="row"><span>Codigo: ${esc(order.shortCode)}</span><span>${esc(now)}</span></div>
${order.customerName ? `<div>Cliente: ${esc(order.customerName)}</div>` : ''}
${order.waiterName ? `<div>Atendente: ${esc(order.waiterName)}</div>` : ''}
${address}
<div class="hr"></div>
${items}
<div class="hr"></div>
<div class="row"><span>Subtotal</span><span>${money(order.subtotal)}</span></div>
${order.discount > 0 ? `<div class="row"><span>Desconto</span><span>- ${money(order.discount)}</span></div>` : ''}
${order.deliveryFee > 0 ? `<div class="row"><span>Taxa de entrega</span><span>${money(order.deliveryFee)}</span></div>` : ''}
${(order.serviceFee || 0) > 0 ? `<div class="row"><span>Taxa de servico (10%)</span><span>${money(order.serviceFee || 0)}</span></div>` : ''}
<div class="row big"><span>TOTAL</span><span>${money(order.total)}</span></div>
<div class="hr"></div>
<div class="c">Confira os itens. Este cupom nao e documento fiscal.</div>
<div class="c">Obrigado pela preferencia!</div>
<div style="height:8mm"></div>
</body></html>`;
}

/** Texto ESC/POS simples (sem acentos) para o Agente de Impressão. */
export function buildConferenceEscPos(
  order: Order,
  restaurant: Partial<RestaurantConfig> | undefined,
  paperWidth: '80mm' | '58mm' = '80mm'
): string {
  const cols = paperWidth === '58mm' ? 32 : 48;
  const ESC = '\x1b';
  const GS = '\x1d';
  const line = '-'.repeat(cols);
  const pad = (l: string, r: string) => {
    const space = Math.max(1, cols - l.length - r.length);
    return l + ' '.repeat(space) + r;
  };
  const center = (t: string) => ' '.repeat(Math.max(0, Math.floor((cols - t.length) / 2))) + t;

  const out: string[] = [];
  out.push(`${ESC}@`);
  out.push(center(noAccents(String(restaurant?.name || order.restaurantName || '')).toUpperCase().slice(0, cols)));
  out.push(center('*** CONFERENCIA - NAO FISCAL ***'));
  out.push(line);
  out.push(`${ESC}!\x30${center(noAccents(originLabel(order)).slice(0, cols / 2))}${ESC}!\x00`);
  out.push(pad(`Cod: ${order.shortCode}`, new Date().toLocaleString('pt-BR')));
  if (order.customerName) out.push(noAccents(`Cliente: ${order.customerName}`).slice(0, cols));
  out.push(line);
  for (const it of order.items || []) {
    const left = noAccents(`${it.quantity}x ${it.name}`);
    const right = money(it.totalPrice);
    out.push(pad(left.slice(0, cols - right.length - 1), right));
    if (it.selectedOptions?.length) out.push('  ' + noAccents(it.selectedOptions.map((o) => `+ ${o.name}`).join(' | ')).slice(0, cols - 2));
    if (it.notes) out.push('  ' + noAccents(`OBS: ${it.notes}`).slice(0, cols - 2));
  }
  out.push(line);
  out.push(pad('Subtotal', money(order.subtotal)));
  if (order.discount > 0) out.push(pad('Desconto', `- ${money(order.discount)}`));
  if (order.deliveryFee > 0) out.push(pad('Taxa entrega', money(order.deliveryFee)));
  if ((order.serviceFee || 0) > 0) out.push(pad('Taxa servico 10%', money(order.serviceFee || 0)));
  out.push(`${ESC}E\x01${pad('TOTAL', money(order.total))}${ESC}E\x00`);
  out.push(line);
  out.push(center('Confira os itens. Nao e documento fiscal.'.slice(0, cols)));
  out.push('\n\n\n');
  out.push(`${GS}V\x41\x03`); // corte parcial
  return out.join('\n');
}

/** Impressão silenciosa pelo navegador (iframe oculto). */
function printHtmlHidden(html: string): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const iframe = document.createElement('iframe');
      iframe.setAttribute('aria-hidden', 'true');
      iframe.tabIndex = -1;
      Object.assign(iframe.style, {
        position: 'fixed',
        right: '0',
        bottom: '0',
        width: '0',
        height: '0',
        border: '0',
        opacity: '0',
        pointerEvents: 'none',
      });
      document.body.appendChild(iframe);
      const win = iframe.contentWindow;
      if (!win) {
        iframe.remove();
        resolve(false);
        return;
      }
      win.document.open();
      win.document.write(html);
      win.document.close();
      setTimeout(() => {
        try {
          win.focus();
          win.print();
          resolve(true);
        } catch {
          resolve(false);
        } finally {
          setTimeout(() => iframe.remove(), 4000);
        }
      }, 250);
    } catch {
      resolve(false);
    }
  });
}

interface AgentPrinter {
  id: string;
  name: string;
  stations?: string[];
  status?: string;
}

/** Lista as impressoras online do Agente para a estação CAIXA. */
export async function fetchCaixaPrinters(restaurantSlug: string): Promise<AgentPrinter[]> {
  try {
    const res = await fetch(`/api/print-agent/printers?slug=${encodeURIComponent(restaurantSlug)}`);
    if (!res.ok) return [];
    const data = await res.json();
    const list: AgentPrinter[] = Array.isArray(data?.printers) ? data.printers : [];
    return list.filter((p) => p.status === 'online' && (p.stations || []).includes('CAIXA'));
  } catch {
    return [];
  }
}

async function sendToAgent(
  order: Order,
  restaurantSlug: string,
  rawEscPos: string,
  printerId: string | undefined,
  copies: number
): Promise<boolean> {
  const printers = await fetchCaixaPrinters(restaurantSlug);
  if (printers.length === 0) return false;
  if (printerId && !printers.some((p) => p.id === printerId)) return false;

  let ok = false;
  for (let i = 0; i < Math.max(1, copies); i += 1) {
    const res = await fetch('/api/print-agent/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId: order.id,
        orderShortCode: order.shortCode,
        restaurantSlug,
        station: 'CAIXA',
        printerId,
        // o sufixo torna cada cópia/impressão um trabalho novo (não é barrado como duplicado)
        rawEscPos: `${rawEscPos}\n${'\u200b'.repeat(i)}${Date.now()}`,
      }),
    });
    if (res.ok) ok = true;
  }
  return ok;
}

export interface PrintConferenceParams {
  order: Order;
  restaurant?: Partial<RestaurantConfig>;
  settings?: Partial<PrinterSettings> | null;
  source: ConferenceSource;
  /** ignora as opções e imprime mesmo assim (botão manual). */
  force?: boolean;
}

/**
 * Imprime o cupom de conferência automaticamente.
 * Retorna 'agent' | 'browser' | 'disabled' | 'error'.
 */
export async function printConferenceAuto(
  params: PrintConferenceParams
): Promise<'agent' | 'browser' | 'disabled' | 'error'> {
  const { order, restaurant, settings, source, force } = params;
  const opts = getConferenceOptions(settings);
  if (!force && (!opts.enabled || !opts.sources[source])) return 'disabled';
  if (!order || !order.items || order.items.length === 0) return 'error';

  const paper = settings?.paperWidth === '58mm' ? '58mm' : '80mm';
  const slug = order.restaurantSlug || (restaurant?.slug as string) || '';

  if (opts.mode !== 'browser') {
    try {
      const raw = buildConferenceEscPos(order, restaurant, paper);
      const sent = await sendToAgent(order, slug, raw, opts.printerId, opts.copies);
      if (sent) return 'agent';
    } catch {
      /* cai para o navegador */
    }
    if (opts.mode === 'agent') return 'error';
  }

  const html = buildConferenceHtml(order, restaurant, paper);
  let printed = false;
  for (let i = 0; i < Math.max(1, opts.copies); i += 1) {
    printed = (await printHtmlHidden(html)) || printed;
  }
  return printed ? 'browser' : 'error';
}
