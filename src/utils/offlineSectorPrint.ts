import { ProductionStation } from '../types/restaurant';

/**
 * V9 PLUS ULTRA 04 — IMPRESSÃO 100% OFFLINE DA COZINHA/SUSHIBAR/BAR
 *
 * Quando a internet cai, o Print Agent (que busca trabalhos na nuvem) não
 * consegue avisar as impressoras dos setores. Em vez de perder o ticket até
 * a internet voltar, imprimimos DIRETO pelo navegador do dispositivo que
 * lançou o pedido (window.print() → diálogo de impressão do sistema
 * operacional → qualquer impressora local/de rede configurada no Windows,
 * sem passar pela nuvem).
 *
 * Isso NÃO substitui o Print Agent: quando online, tudo continua indo pelo
 * fluxo normal (routeOrderToPrint no servidor). Esta função só entra em
 * ação nos ramos "offline" do StoreContext, e o pedido é marcado com
 * `skipAutoPrint: true` para o servidor nunca duplicar o ticket depois,
 * quando a fila offline sincronizar.
 */

export interface OfflinePrintItem {
  name: string;
  quantity: number;
  notes?: string;
  selectedOptions?: any[];
  station?: ProductionStation;
}

export interface OfflinePrintContext {
  restaurantName: string;
  orderShortCode: string;
  tableNumber?: number;
  orderType: 'mesa' | 'delivery' | 'retirada' | 'balcao' | 'online';
}

const STATION_LABEL: Record<ProductionStation, string> = {
  cozinha: 'COZINHA',
  sushibar: 'SUSHI BAR',
  bar: 'BAR',
};

function resolveStation(item: OfflinePrintItem): ProductionStation {
  if (item.station) return item.station;
  const n = (item.name || '').toLowerCase();
  if (n.includes('sushi') || n.includes('temaki') || n.includes('sashimi') || n.includes('uramaki')) return 'sushibar';
  if (n.includes('drink') || n.includes('suco') || n.includes('refrigerante') || n.includes('cerveja') || n.includes('chopp')) return 'bar';
  return 'cozinha';
}

function buildTicketHtml(station: ProductionStation, items: OfflinePrintItem[], ctx: OfflinePrintContext): string {
  const headline =
    ctx.orderType === 'mesa'
      ? `MESA ${ctx.tableNumber ?? 'S/N'}`
      : ctx.orderType === 'delivery'
        ? 'DELIVERY'
        : 'BALCÃO';

  const itemsHtml = items
    .map((it) => {
      const opts = Array.isArray(it.selectedOptions)
        ? it.selectedOptions.map((o: any) => (typeof o === 'string' ? o : o?.name)).filter(Boolean)
        : [];
      return `
        <div class="item">
          <div class="qty-name">${it.quantity}x ${String(it.name || '').toUpperCase()}</div>
          ${opts.map((o) => `<div class="opt">+ ${String(o).toUpperCase()}</div>`).join('')}
          ${it.notes ? `<div class="notes">OBS: ${String(it.notes).toUpperCase()}</div>` : ''}
        </div>`;
    })
    .join('');

  return `
    <html>
      <head>
        <title>${STATION_LABEL[station]} — ${headline}</title>
        <style>
          @page { margin: 4mm; }
          body { font-family: 'Courier New', monospace; width: 72mm; margin: 0 auto; }
          .station { text-align:center; font-size: 15px; font-weight: 900; letter-spacing: 1px; border: 2px solid #000; padding: 4px; }
          .headline { text-align:center; font-size: 26px; font-weight: 900; margin: 6px 0 2px; }
          .pedido { text-align:center; font-size: 15px; font-weight: 900; margin-bottom: 6px; }
          .badge { text-align:center; font-size: 10px; font-weight: 700; color:#900; margin-bottom: 4px; }
          hr { border: none; border-top: 2px dashed #000; margin: 6px 0; }
          .item { margin-bottom: 8px; }
          .qty-name { font-size: 18px; font-weight: 900; }
          .opt { font-size: 13px; font-weight: 700; margin-left: 10px; }
          .notes { font-size: 13px; font-weight: 900; margin-top: 2px; }
          .footer { text-align:center; font-size: 10px; margin-top: 8px; }
        </style>
      </head>
      <body>
        <div class="badge">🔴 IMPRESSO OFFLINE — SEM INTERNET</div>
        <div class="station">${STATION_LABEL[station]}</div>
        <div class="headline">${headline}</div>
        <div class="pedido">PEDIDO ${ctx.orderShortCode}</div>
        <hr />
        ${itemsHtml}
        <hr />
        <div class="footer">${ctx.restaurantName} • ${new Date().toLocaleString('pt-BR')}</div>
        <script>window.onload = () => { window.print(); };</script>
      </body>
    </html>`;
}

/**
 * Agrupa os itens por setor e abre UMA janela de impressão por setor
 * (igual ao Print Agent faria na nuvem — cada setor recebe só os seus itens).
 * Retorna true se pelo menos uma janela de impressão foi aberta.
 */
export function printSectorTicketsOffline(items: OfflinePrintItem[], ctx: OfflinePrintContext): boolean {
  if (typeof window === 'undefined' || !items.length) return false;

  const byStation: Record<ProductionStation, OfflinePrintItem[]> = { cozinha: [], sushibar: [], bar: [] };
  for (const item of items) {
    byStation[resolveStation(item)].push(item);
  }

  let opened = false;
  (Object.keys(byStation) as ProductionStation[]).forEach((station) => {
    const stationItems = byStation[station];
    if (!stationItems.length) return;
    try {
      const w = window.open('', '_blank', 'width=380,height=600');
      if (!w) return; // pop-up bloqueado pelo navegador — segue sem travar o pedido
      w.document.write(buildTicketHtml(station, stationItems, ctx));
      w.document.close();
      opened = true;
    } catch {
      /* impressão local é um "melhor esforço" — nunca deve travar o pedido offline */
    }
  });
  return opened;
}
