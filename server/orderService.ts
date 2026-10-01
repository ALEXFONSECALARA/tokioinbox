import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { normalizePhone } from './phoneUtils';
import { getRestaurant, getCoupon, priceLine, restaurantExists, assertCanAcceptNewOrder } from './catalogService';
import { secureToken } from './security';
import { markTableSessionClosed } from './tableAccessService';
import { findMatchingDeliveryZone } from '../src/utils/geo';

export interface OrderItemOption {
  groupId: string;
  groupTitle: string;
  optionId: string;
  name: string;
  price: number;
}

export interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  selectedOptions?: OrderItemOption[];
  notes?: string;
  station?: ProductionStation;
  printStations?: ProductionStation[];
  stationStatus?: StationItemStatus;
}

export type ProductionStation = 'cozinha' | 'sushibar' | 'bar';
export type StationItemStatus = 'recebido' | 'em_preparo' | 'pedido_feito';

export interface StationProductionRecord {
  station: ProductionStation;
  status: StationItemStatus;
  startedAt?: string;
  finishedAt?: string;
  operator?: string;
  itemsCount: number;
}

export type OrderStatus =
  | 'recebido'
  | 'aceito'
  | 'em_producao'
  | 'em_preparo'
  | 'parcialmente_pronto'
  | 'pronto'
  | 'saiu_para_entrega'
  | 'entregue'
  | 'finalizado'
  | 'cancelado';

export interface StatusHistoryEntry {
  status: OrderStatus;
  timestamp: string;
  note?: string;
}

export type ServerOrderType = 'mesa' | 'balcao' | 'delivery' | 'retirada' | 'online';

export function normalizeOrderOrigin(raw: string | undefined | null): ServerOrderType {
  if (!raw) return 'mesa';
  const clean = raw.toLowerCase().trim().replace(/ã/g, 'a').replace(/ç/g, 'c');
  if (clean === 'dine_in' || clean === 'mesa' || clean.includes('mesa')) return 'mesa';
  if (clean === 'counter' || clean === 'balcao' || clean.includes('balcao')) return 'balcao';
  if (clean === 'delivery' || clean.includes('entrega')) return 'delivery';
  if (clean === 'retirada' || clean === 'takeaway' || clean.includes('retirada')) return 'retirada';
  if (clean === 'online' || clean.includes('web')) return 'online';
  return 'mesa';
}

export interface Order {
  id: string;
  shortCode: string;
  restaurantSlug: string;
  restaurantName: string;
  customerId?: string;
  customerName: string;
  customerPhone: string;
  customerPhoneNormalized?: string;
  orderType: ServerOrderType;
  tableNumber?: number;
  tableSessionId?: string;
  waiterName?: string;
  pickupNumber?: number;
  deliveryAddress?: {
    street: string;
    number: string;
    neighborhood: string;
    city: string;
    state?: string;
    cep?: string;
    complement?: string;
    distanceKm?: number;
  };
  items: OrderItem[];
  stations?: Partial<Record<ProductionStation, StationProductionRecord>>;
  subtotal: number;
  deliveryFee: number;
  /** Taxa de serviço (10% do Salão) cobrada no fechamento da mesa. 0/ausente = dispensada. */
  serviceFee?: number;
  discount: number;
  couponCode?: string;
  total: number;
  paymentMethod: string;
  paymentDetails?: {
    cashChangeFor?: number;
    cardBrand?: string;
    pixCode?: string;
    paid: boolean;
    receiptType?: 'fiscal' | 'comum';
  };
  notes?: string;
  status: OrderStatus;
  statusHistory: StatusHistoryEntry[];
  printStatus: 'pendente' | 'imprimindo' | 'impresso';
  // V8 PRO: ver mesmo campo em src/types/restaurant.ts — "fechar" a mesa
  // (pedir a conta) é diferente de "pagar" a mesa.
  awaitingPayment?: boolean;
  billRequestedAt?: string;
  idempotencyKey?: string;
  /** Chaves de operações já aplicadas a este pedido (itens adicionados à mesa) — evita duplicar item/comanda em retry. */
  appliedOperationKeys?: string[];
  /** Token secreto entregue só a quem criou o pedido; permite acompanhar sem login. */
  trackingToken?: string;
  createdAt: string;
  updatedAt: string;
}

// Classificação de item -> setor: módulo compartilhado com o navegador (impressão offline).
export { resolveItemStation } from '../src/utils/stationClassifier';
import { resolveItemStation } from '../src/utils/stationClassifier';

import { DATA_DIR } from './dataDir'; // Caminho configurável via env DATA_DIR (ver server/dataDir.ts)
import { getSystemSettings } from './systemSettings';
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');
const CUSTOMERS_FILE = path.join(DATA_DIR, 'customers.json');

// In-memory cache backed by persistent atomic JSON file
let ordersCache: Order[] = [];
let isInitialized = false;
let ordersVersion = 1;
let ordersLastModified = Date.now();

export function getOrdersVersion(): number {
  initializeOrders();
  return ordersVersion;
}

export function getOrdersLastModified(): number {
  initializeOrders();
  return ordersLastModified;
}

export function getOrdersEtag(filterSlug?: string): string {
  initializeOrders();
  const slugKey = filterSlug && filterSlug !== 'all' ? filterSlug : 'all';
  const count = filterSlug && filterSlug !== 'all'
    ? ordersCache.filter((o) => o.restaurantSlug === filterSlug).length
    : ordersCache.length;
  return `W/"ord-${slugKey}-v${ordersVersion}-${count}-${ordersLastModified}"`;
}

// Initial sample seed if file is empty
function getInitialSampleOrders(): Order[] {
  const now = Date.now();
  return [
    {
      id: 'ord-101',
      shortCode: 'TK-4821',
      restaurantSlug: 'japones',
      restaurantName: 'Sakura Sushi House',
      customerName: 'Mariana Oliveira',
      customerPhone: '(11) 99882-1234',
      orderType: 'delivery',
      deliveryAddress: {
        street: 'Rua Bela Cintra',
        number: '850',
        neighborhood: 'Consolação',
        city: 'São Paulo',
        complement: 'Apto 42',
      },
      items: [
        {
          id: 'ord-item-1',
          name: 'Combinado Tokyo Premium (32 Peças)',
          quantity: 1,
          unitPrice: 84.9,
          totalPrice: 88.4,
          selectedOptions: [
            {
              groupId: 'molhos',
              groupTitle: 'Molhos adicionais',
              optionId: 'tarê',
              name: 'Molho Tarê Artesanal Extra',
              price: 3.5,
            },
          ],
          notes: 'Sem wasabi no combinado por favor!',
        },
        {
          id: 'ord-item-2',
          name: 'Guioza Suíno Dourado na Chapa (6 Unidades)',
          quantity: 1,
          unitPrice: 28.0,
          totalPrice: 28.0,
        },
      ],
      subtotal: 116.4,
      deliveryFee: 7.5,
      discount: 10.0,
      couponCode: 'BEMVINDO10',
      total: 113.9,
      paymentMethod: 'pix',
      paymentDetails: {
        paid: true,
      },
      notes: 'Interfone tocar no bloco B',
      status: 'recebido', // STRICT INITIAL: Was em_preparo in seed, guaranteed received
      statusHistory: [
        { status: 'recebido', timestamp: 'Há 12 minutos', note: 'Pedido criado pelo cliente via Cardápio Web' },
      ],
      printStatus: 'pendente',
      idempotencyKey: 'seed-ord-101',
      createdAt: new Date(now - 12 * 60 * 1000).toISOString(),
      updatedAt: new Date(now - 12 * 60 * 1000).toISOString(),
    },
    {
      id: 'ord-102',
      shortCode: 'TK-4822',
      restaurantSlug: 'hamburgueria',
      restaurantName: 'Burger Craft & Beer',
      customerName: 'Lucas Ferreira',
      customerPhone: '(11) 98711-5544',
      orderType: 'mesa',
      tableNumber: 4,
      items: [
        {
          id: 'ord-item-3',
          name: 'Double Smash Bacon Cheddar',
          quantity: 2,
          unitPrice: 32.9,
          totalPrice: 70.8,
          selectedOptions: [
            {
              groupId: 'adicionais_burger',
              groupTitle: 'Turbine seu burger',
              optionId: 'bacon_extra',
              name: 'Bacon Crocante Extra',
              price: 5.0,
            },
          ],
          notes: 'Ponto da carne bem tostado',
        },
      ],
      subtotal: 70.8,
      deliveryFee: 0,
      discount: 0,
      total: 70.8,
      paymentMethod: 'cartao_credito',
      paymentDetails: {
        cardBrand: 'Mastercard',
        paid: false,
      },
      notes: 'Mesa 4 - Atendimento no salão',
      status: 'recebido',
      statusHistory: [
        { status: 'recebido', timestamp: 'Há 5 minutos', note: 'Pedido de mesa enviado pelo cliente' },
      ],
      printStatus: 'pendente',
      idempotencyKey: 'seed-ord-102',
      createdAt: new Date(now - 5 * 60 * 1000).toISOString(),
      updatedAt: new Date(now - 5 * 60 * 1000).toISOString(),
    },
  ];
}

function ensureDataDirectory() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function initializeOrders() {
  if (isInitialized) return;
  ensureDataDirectory();

  try {
    const raw = fs.existsSync(ORDERS_FILE) ? fs.readFileSync(ORDERS_FILE, 'utf-8').trim() : '';
    if (raw) {
      ordersCache = JSON.parse(raw);
      // V9.3: pedidos de demonstração do seed (id `seed-ord-*`) nunca são pedidos reais: são removidos.
      const before = ordersCache.length;
      ordersCache = ordersCache.filter((o: any) => !String(o?.idempotencyKey || '').startsWith('seed-ord-'));
      if (ordersCache.length !== before) {
        persistOrdersSync();
        console.log(`[ORDER STORAGE] ${before - ordersCache.length} pedido(s) de demonstração removido(s).`);
      }
      console.log(`[ORDER STORAGE] Carregados ${ordersCache.length} pedidos persistidos do arquivo.`);
    } else {
      // Arquivo ausente/vazio: começa limpo. Pedidos de demonstração só com SEED_DEMO_ORDERS=true.
      ordersCache = process.env.SEED_DEMO_ORDERS === 'true' ? getInitialSampleOrders() : [];
      persistOrdersSync();
      console.log(`[ORDER STORAGE] Banco de pedidos iniciado (${ordersCache.length} pedidos).`);
    }
  } catch (err) {
    // NUNCA substituir pedidos reais por dados de exemplo: preserva o arquivo e interrompe.
    const backup = `${ORDERS_FILE}.corrupt-${Date.now()}`;
    try { fs.copyFileSync(ORDERS_FILE, backup); } catch {}
    console.error(`[ORDER STORAGE FATAL] orders.json ilegível: ${(err as Error).message}. Cópia preservada em ${backup}.`);
    throw new Error('Base de pedidos corrompida. Restaure o backup antes de iniciar o servidor.');
  }
  isInitialized = true;
}

function persistOrdersSync() {
  ensureDataDirectory();
  const tempFile = `${ORDERS_FILE}.tmp.${Date.now()}`;
  try {
    fs.writeFileSync(tempFile, JSON.stringify(ordersCache, null, 2), 'utf-8');
    fs.renameSync(tempFile, ORDERS_FILE);
    ordersVersion++;
    ordersLastModified = Date.now();
  } catch (err) {
    console.error('[ORDER STORAGE ERROR] Falha ao persistir pedidos atomicamente:', err);
    try {
      if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
    } catch {}
    throw err;
  }
}

export function getAllOrders(filterSlug?: string): Order[] {
  initializeOrders();
  if (filterSlug && filterSlug !== 'all') {
    return ordersCache.filter((o) => o.restaurantSlug === filterSlug);
  }
  return [...ordersCache];
}

export function getOrderById(idOrCode: string): Order | undefined {
  initializeOrders();
  const search = idOrCode.toLowerCase().trim();
  return ordersCache.find(
    (o) => o.id.toLowerCase() === search || o.shortCode.toLowerCase() === search
  );
}

export function findOrderByDeliveryKey(key: string): Order | undefined {
  initializeOrders();
  if (!key) return undefined;
  return ordersCache.find((o) => o.idempotencyKey === key || (o.appliedOperationKeys || []).includes(key));
}

export interface CreateOrderPayload {
  customerId?: string;
  customerName: string;
  customerPhone: string;
  restaurantSlug: string;
  restaurantName: string;
  orderType: ServerOrderType | string;
  tableNumber?: number;
  tableSessionId?: string;
  waiterName?: string;
  pickupNumber?: number;
  deliveryAddress?: {
    street: string;
    number: string;
    neighborhood: string;
    city: string;
    state?: string;
    cep?: string;
    complement?: string;
    distanceKm?: number;
  };
  items: OrderItem[];
  paymentMethod: string;
  paymentDetails?: {
    cashChangeFor?: number;
    cardBrand?: string;
    pixCode?: string;
    paid: boolean;
  };
  notes?: string;
  couponCode?: string;
  idempotencyKey?: string;
}

export interface OrderActor {
  /** true quando a requisição veio de colaborador autenticado (PDV, garçom, caixa...). */
  isStaff?: boolean;
}

const MAX_ITEMS_PER_ORDER = 80;
const MAX_QTY_PER_ITEM = 50;

function cleanText(v: unknown, max: number): string {
  return String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
}

/** Precifica e valida todas as linhas contra o catálogo do servidor. */
export function priceOrderItems(
  slug: string,
  items: any[],
  actor: OrderActor
): { items: OrderItem[]; subtotal: number } {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('O pedido deve conter pelo menos 1 item.');
  }
  if (items.length > MAX_ITEMS_PER_ORDER) {
    throw new Error(`Um pedido pode ter no máximo ${MAX_ITEMS_PER_ORDER} itens.`);
  }
  let subtotal = 0;
  const priced: OrderItem[] = items.map((it, idx) => {
    const qty = Math.min(MAX_QTY_PER_ITEM, Math.max(1, Math.floor(Number(it.quantity) || 1)));
    const line = priceLine(slug, it, Boolean(actor.isStaff));
    const itemTotal = Number((line.unitPrice * qty).toFixed(2));
    subtotal += itemTotal;
    return {
      id: cleanText(it.id, 80) || `item-${Date.now()}-${idx}`,
      name: line.name,
      quantity: qty,
      unitPrice: line.unitPrice,
      totalPrice: itemTotal,
      selectedOptions: line.selectedOptions,
      notes: cleanText(it.notes, 300) || undefined,
      station: resolveItemStation(line.name, line.station || it.station),
      printStations: line.printStations as ProductionStation[] | undefined,
      stationStatus: 'recebido' as StationItemStatus,
    };
  });
  return { items: priced, subtotal: Number(subtotal.toFixed(2)) };
}

export function createOrderTransactional(
  payload: CreateOrderPayload,
  actor: OrderActor = {}
): { order: Order; deduplicated: boolean } {
  initializeOrders();

  // 1. Idempotency Check: Prevent duplicate orders
  if (payload.idempotencyKey) {
    const existing = findOrderByDeliveryKey(payload.idempotencyKey);
    if (existing) {
      return { order: existing, deduplicated: true };
    }
  }

  // 2. Validate payload
  const customerName = cleanText(payload.customerName, 80);
  const canonicalRequestedType = normalizeOrderOrigin(payload.orderType);
  if (!customerName || (canonicalRequestedType !== 'mesa' && !payload.customerPhone)) {
    throw new Error('Nome e telefone do cliente são obrigatórios.');
  }

  // 3. Restaurante precisa existir no catálogo (sem "cair" silenciosamente em outro)
  const slug = String(payload.restaurantSlug || '');
  if (!restaurantExists(slug)) {
    throw new Error('Restaurante não encontrado.');
  }
  const restaurant = getRestaurant(slug);
  if (restaurant.isActive === false) {
    throw new Error('Este restaurante não está recebendo pedidos.');
  }
  assertCanAcceptNewOrder(slug, Boolean(actor.isStaff));
  if (!actor.isStaff && restaurant.isOpen === false) {
    throw new Error(`${restaurant.name} está fechado no momento e não está recebendo pedidos.`);
  }
  if (canonicalRequestedType === 'mesa') {
    assertTableNotAwaitingPayment(slug, Number(payload.tableNumber));
  }
  const restaurantName = restaurant.name;

  // 4. Preços SEMPRE vindos do catálogo do servidor
  const priced = priceOrderItems(slug, payload.items, actor);
  const sanitizedItems = priced.items;
  let calculatedSubtotal = priced.subtotal;

  // Build stations map for this order
  const stationsMap: Partial<Record<ProductionStation, StationProductionRecord>> = {};
  for (const item of sanitizedItems) {
    const st = item.station || 'cozinha';
    if (!stationsMap[st]) {
      stationsMap[st] = {
        station: st,
        status: 'recebido',
        itemsCount: 0,
      };
    }
    stationsMap[st]!.itemsCount += item.quantity;
  }

  // Cupom validado no servidor (catálogo)
  let calculatedDiscount = 0;
  let appliedCouponCode: string | undefined;
  if (payload.couponCode) {
    const couponDef = getCoupon(String(payload.couponCode));
    if (couponDef && (!couponDef.minSubtotal || calculatedSubtotal >= couponDef.minSubtotal)) {
      appliedCouponCode = couponDef.code;
      calculatedDiscount =
        couponDef.type === 'percent'
          ? Number(((calculatedSubtotal * couponDef.value) / 100).toFixed(2))
          : couponDef.value;
    }
  }
  calculatedDiscount = Math.min(calculatedDiscount, calculatedSubtotal);

  // Taxa de entrega e pedido mínimo vêm do cadastro do restaurante
  const canonicalOrderType = normalizeOrderOrigin(payload.orderType);
  if (
    canonicalOrderType === 'delivery' &&
    !actor.isStaff &&
    restaurant.minOrderValue &&
    calculatedSubtotal < restaurant.minOrderValue
  ) {
    throw new Error(`Pedido mínimo para entrega em ${restaurant.name}: R$ ${Number(restaurant.minOrderValue).toFixed(2)}.`);
  }
  if (canonicalOrderType === 'delivery') {
    const a = payload.deliveryAddress;
    if (!a || !cleanText(a.street, 120) || !cleanText(a.number, 20) || !cleanText(a.neighborhood, 80)) {
      throw new Error('Endereço de entrega incompleto (rua, número e bairro).');
    }
  }
  // V8 PRO PLUS: taxa por distância (KM). O cliente calcula a distância no
  // checkout (geocodificação) e envia deliveryAddress.distanceKm; o
  // SERVIDOR — não o cliente — decide a taxa, buscando a faixa
  // correspondente nas zonas configuradas do restaurante. Isso evita que o
  // cliente manipule a taxa enviada, mantendo o cálculo de preço sempre
  // autoritativo no back-end. Sem zonas configuradas ou sem distância
  // informada, cai de volta para a taxa fixa (comportamento de sempre).
  const requestedDistanceKm =
    canonicalOrderType === 'delivery' && typeof payload.deliveryAddress?.distanceKm === 'number'
      ? payload.deliveryAddress.distanceKm
      : null;
  const matchedZone =
    requestedDistanceKm !== null
      ? findMatchingDeliveryZone(requestedDistanceKm, restaurant.deliveryZones)
      : null;
  const deliveryFee =
    canonicalOrderType === 'delivery'
      ? Number(Number(matchedZone?.fee ?? restaurant.deliveryFee ?? 0).toFixed(2))
      : 0;
  const calculatedTotal = Number(Math.max(0, calculatedSubtotal - calculatedDiscount + deliveryFee).toFixed(2));

// 4. Generate Unique IDs & Codes
  const randomSuffix = crypto.randomInt(1000, 10000);
  // V9 PLUS ULTRA 04 — seção 5: remover completamente o símbolo "#" da
  // apresentação dos pedidos. shortCode é só um código curto de exibição
  // (o ID interno real continua sendo `orderId`, abaixo, intocado).
  const shortCode = `TK-${randomSuffix}`;
  const orderId = `ord-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const nowIso = new Date().toISOString();

  // 5. Build strict order object (ALWAYS 'recebido' - NEVER auto 'pronto')
  const phoneNorm = normalizePhone(payload.customerPhone);
  const newOrder: Order = {
    id: orderId,
    shortCode,
    restaurantSlug: slug,
    restaurantName,
    customerId: payload.customerId,
    customerName,
    customerPhone: phoneNorm.isValid ? phoneNorm.displayFormatted : payload.customerPhone.trim(),
    customerPhoneNormalized: phoneNorm.isValid ? phoneNorm.canonical : undefined,
    orderType: canonicalOrderType,
    tableNumber: canonicalOrderType === 'mesa' ? payload.tableNumber : undefined,
    tableSessionId: payload.tableSessionId,
    waiterName: payload.waiterName,
    pickupNumber:
      canonicalOrderType === 'balcao' || canonicalOrderType === 'retirada'
        ? payload.pickupNumber
        : undefined,
    deliveryAddress:
      canonicalOrderType === 'delivery' && payload.deliveryAddress
        ? {
            street: cleanText(payload.deliveryAddress.street, 120),
            number: cleanText(payload.deliveryAddress.number, 20),
            neighborhood: cleanText(payload.deliveryAddress.neighborhood, 80),
            city: cleanText(payload.deliveryAddress.city, 80),
            state: cleanText(payload.deliveryAddress.state, 5) || undefined,
            cep: cleanText(payload.deliveryAddress.cep, 12) || undefined,
            complement: cleanText(payload.deliveryAddress.complement, 80) || undefined,
            distanceKm: requestedDistanceKm !== null ? Number(requestedDistanceKm.toFixed(2)) : undefined,
          }
        : undefined,
    items: sanitizedItems,
    stations: stationsMap,
    subtotal: calculatedSubtotal,
    deliveryFee,
    discount: calculatedDiscount,
    couponCode: appliedCouponCode,
    total: calculatedTotal,
    paymentMethod: payload.paymentMethod,
    paymentDetails: payload.paymentDetails,
    notes: cleanText(payload.notes, 500) || undefined,
    status: 'recebido', // CRITICAL: NEVER AUTO PRONTO
    statusHistory: [
      {
        status: 'recebido',
        timestamp: 'Agora',
        note: `Pedido recebido e confirmado no servidor (${payload.orderType.toUpperCase()})`,
      },
    ],
    printStatus: 'pendente',
    idempotencyKey: payload.idempotencyKey,
    trackingToken: secureToken('trk-', 12),
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  console.log(`[ORDER] Criado ${newOrder.shortCode} (${slug}, ${canonicalOrderType}, R$ ${calculatedTotal.toFixed(2)})`);

  // 6. Prepend to in-memory cache and commit to disk
  ordersCache.unshift(newOrder);
  persistOrdersSync();

  return { order: newOrder, deduplicated: false };
}

// Order Status Transitions - Enforces strict order lifecycle
const ALLOWED_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  recebido: ['aceito', 'em_producao', 'em_preparo', 'cancelado'],
  aceito: ['em_producao', 'em_preparo', 'cancelado'],
  em_producao: ['parcialmente_pronto', 'pronto', 'cancelado'],
  em_preparo: ['parcialmente_pronto', 'pronto', 'cancelado'],
  parcialmente_pronto: ['pronto', 'cancelado'],
  pronto: ['saiu_para_entrega', 'entregue', 'finalizado', 'cancelado'],
  saiu_para_entrega: ['entregue', 'finalizado', 'cancelado'],
  entregue: ['finalizado', 'cancelado'],
  finalizado: [],
  cancelado: [],
};

const DEFAULT_STATUS_NOTES: Record<OrderStatus, string> = {
  recebido: 'Pedido registrado no sistema',
  aceito: 'Pedido confirmado e aceito pelo restaurante',
  em_producao: 'Iniciada produção nas praças',
  em_preparo: 'Iniciado preparo na cozinha',
  parcialmente_pronto: 'Praça finalizada - aguardando outras praças',
  pronto: 'Pronto e embalado com sucesso na expedição',
  saiu_para_entrega: 'Saiu para entrega com entregador',
  entregue: 'Pedido entregue à mesa / ao cliente',
  finalizado: 'Pedido encerrado e conta fechada',
  cancelado: 'Pedido cancelado',
};

export function updateOrderStatusTransactional(
  orderId: string,
  newStatus: OrderStatus,
  note?: string
): Order {
  initializeOrders();

  const idx = ordersCache.findIndex((o) => o.id === orderId);
  if (idx === -1) {
    throw new Error(`Pedido com ID "${orderId}" não encontrado.`);
  }

  const currentOrder = ordersCache[idx];
  const allowed = ALLOWED_STATUS_TRANSITIONS[currentOrder.status];

  // Prevent illegal skip (e.g. recebido -> pronto)
  if (!allowed.includes(newStatus)) {
    throw new Error(
      `Transição inválida: Não é permitido mudar de "${currentOrder.status}" diretamente para "${newStatus}". O fluxo obrigatório é: recebido -> em_preparo -> pronto -> saiu_para_entrega -> entregue.`
    );
  }

  const nowIso = new Date().toISOString();
  const updatedHistory: StatusHistoryEntry[] = [
    ...currentOrder.statusHistory,
    {
      status: newStatus,
      timestamp: 'Agora mesmo',
      note: note || DEFAULT_STATUS_NOTES[newStatus] || `Status alterado para ${newStatus}`,
    },
  ];

  const updatedOrder: Order = {
    ...currentOrder,
    status: newStatus,
    statusHistory: updatedHistory,
    updatedAt: nowIso,
  };

  ordersCache[idx] = updatedOrder;
  persistOrdersSync();

  console.log(`[ORDER STATUS] Pedido ${updatedOrder.shortCode} avançou: ${currentOrder.status} -> ${newStatus}`);
  return updatedOrder;
}

export function updateOrderPrintStatusTransactional(
  orderId: string,
  printStatus: 'pendente' | 'imprimindo' | 'impresso'
): Order {
  initializeOrders();
  const idx = ordersCache.findIndex((o) => o.id === orderId);
  if (idx === -1) {
    throw new Error(`Pedido com ID "${orderId}" não encontrado.`);
  }

  ordersCache[idx] = {
    ...ordersCache[idx],
    printStatus,
    updatedAt: new Date().toISOString(),
  };
  persistOrdersSync();
  return ordersCache[idx];
}

export function updateOrderTableTransactional(
  orderId: string,
  newTableNumber: number
): Order {
  initializeOrders();
  const idx = ordersCache.findIndex((o) => o.id === orderId);
  if (idx === -1) {
    throw new Error(`Pedido com ID "${orderId}" não encontrado.`);
  }

  const oldTable = ordersCache[idx].tableNumber;
  ordersCache[idx] = {
    ...ordersCache[idx],
    tableNumber: newTableNumber,
    customerName: `Mesa ${String(newTableNumber).padStart(2, '0')}`,
    notes: `${ordersCache[idx].notes || ''} [Mesa alterada de ${oldTable} para ${newTableNumber}]`.trim(),
    updatedAt: new Date().toISOString(),
  };
  persistOrdersSync();
  console.log(`[ORDER TABLE] Pedido ${ordersCache[idx].shortCode} transferido da Mesa ${oldTable} para Mesa ${newTableNumber}`);
  return ordersCache[idx];
}

export function deleteOrderTransactional(orderId: string): boolean {
  initializeOrders();
  const initialLen = ordersCache.length;
  ordersCache = ordersCache.filter((o) => o.id !== orderId);
  if (ordersCache.length !== initialLen) {
    persistOrdersSync();
    console.log(`[ORDER] Pedido ${orderId} excluído.`);
    return true;
  }
  return false;
}

export function clearOrdersTransactional(slug?: string, mode: 'finished' | 'all' = 'finished'): number {
  initializeOrders();
  const beforeCount = ordersCache.length;

  ordersCache = ordersCache.filter((order) => {
    if (mode === 'all') {
      if (slug && slug !== 'all') {
        return order.restaurantSlug !== slug;
      }
      return false;
    }

    // Keep active pending orders
    const isFinished = order.status === 'entregue' || order.status === 'cancelado';
    if (!isFinished) return true;

    if (slug && slug !== 'all') {
      return order.restaurantSlug !== slug;
    }
    return false;
  });

  const removed = beforeCount - ordersCache.length;
  persistOrdersSync();
  console.log(`[ORDER] Limpeza de histórico concluída: ${removed} pedidos removidos.`);
  return removed;
}

export function masterResetOrdersTransactional(operatorName: string): {
  count: number;
  affectedRestaurants: string[];
  timestamp: string;
} {
  initializeOrders();
  const beforeCount = ordersCache.length;
  const affectedRestaurants = Array.from(new Set(ordersCache.map((o) => o.restaurantSlug)));

  ordersCache = [];
  persistOrdersSync();

  const timestamp = new Date().toISOString();
  console.log(
    `[MASTER RESET] Reset Mestre executado por "${operatorName}". ${beforeCount} pedidos apagados em transação.`
  );

  return {
    count: beforeCount,
    affectedRestaurants,
    timestamp,
  };
}

/**
 * Isolated customer orders query.
 * Strictly guarantees that customers only receive their own orders matching their customerId or phone.
 */
export function getOrdersByCustomer(customerId?: string, phoneNormalized?: string): Order[] {
  initializeOrders();
  if (!customerId && !phoneNormalized) {
    return [];
  }

  return ordersCache.filter((order) => {
    if (customerId && order.customerId === customerId) {
      return true;
    }
    if (phoneNormalized && order.customerPhoneNormalized === phoneNormalized) {
      return true;
    }
    return false;
  });
}

export function updateOrderStationStatusTransactional(
  orderId: string,
  station: ProductionStation,
  stationStatus: StationItemStatus,
  operatorName?: string
): Order {
  initializeOrders();
  const idx = ordersCache.findIndex((o) => o.id === orderId);
  if (idx === -1) {
    throw new Error(`Pedido com ID "${orderId}" não encontrado.`);
  }

  const currentOrder = ordersCache[idx];
  const nowIso = new Date().toISOString();

  // Update item stationStatus for items matching this station
  const updatedItems = currentOrder.items.map((it) => {
    const itemStation = it.station || resolveItemStation(it.name);
    if (itemStation === station) {
      return {
        ...it,
        station: itemStation,
        stationStatus,
      };
    }
    return {
      ...it,
      station: itemStation,
    };
  });

  const currentStations = currentOrder.stations || {};
  const existingRecord = currentStations[station] || {
    station,
    status: 'recebido',
    itemsCount: updatedItems
      .filter((i) => (i.station || resolveItemStation(i.name)) === station)
      .reduce((sum, i) => sum + i.quantity, 0),
  };

  const updatedStationRecord: StationProductionRecord = {
    ...existingRecord,
    status: stationStatus,
    operator: operatorName || existingRecord.operator,
    startedAt: stationStatus === 'em_preparo' ? (existingRecord.startedAt || nowIso) : existingRecord.startedAt,
    finishedAt: stationStatus === 'pedido_feito' ? nowIso : existingRecord.finishedAt,
  };

  const updatedStations: Partial<Record<ProductionStation, StationProductionRecord>> = {
    ...currentStations,
    [station]: updatedStationRecord,
  };

  // Determine global order status
  // RECEBIDO -> ACEITO -> EM PRODUÇÃO -> PARCIALMENTE PRONTO -> PRONTO -> ENTREGUE -> FINALIZADO
  const activeStations = Object.values(updatedStations).filter((s) => s && s.itemsCount > 0);
  const allDone = activeStations.length > 0 && activeStations.every((s) => s?.status === 'pedido_feito');
  const someDone = activeStations.some((s) => s?.status === 'pedido_feito');

  let newGlobalStatus: OrderStatus = currentOrder.status;
  if (allDone) {
    newGlobalStatus = 'pronto';
  } else if (someDone) {
    newGlobalStatus = 'parcialmente_pronto';
  } else if (
    stationStatus === 'em_preparo' &&
    (currentOrder.status === 'recebido' || currentOrder.status === 'aceito')
  ) {
    newGlobalStatus = 'em_producao';
  }

  const updatedHistory: StatusHistoryEntry[] = [
    ...currentOrder.statusHistory,
    {
      status: newGlobalStatus,
      timestamp: 'Agora mesmo',
      note: `Praça [${station.toUpperCase()}] atualizada para ${stationStatus.toUpperCase()}${operatorName ? ` por ${operatorName}` : ''}`,
    },
  ];

  const updatedOrder: Order = {
    ...currentOrder,
    items: updatedItems,
    stations: updatedStations,
    status: newGlobalStatus,
    statusHistory: updatedHistory,
    updatedAt: nowIso,
  };

  ordersCache[idx] = updatedOrder;
  persistOrdersSync();
  return updatedOrder;
}

export function appendItemsToTableOrderTransactional(params: {
  tableNumber: number;
  restaurantSlug: string;
  restaurantName?: string;
  items: Array<{
    id?: string;
    name: string;
    quantity: number;
    unitPrice: number;
    selectedOptions?: OrderItemOption[];
    notes?: string;
    station?: ProductionStation;
  }>;
  customerName?: string;
  customerPhone?: string;
  waiterName?: string;
  tableSessionId?: string;
  idempotencyKey?: string;
}, actor: OrderActor = {}): { order: Order; isNew: boolean; addedItems: OrderItem[]; deduplicated: boolean } {
  initializeOrders();

  if (!restaurantExists(params.restaurantSlug)) {
    throw new Error('Restaurante não encontrado.');
  }
  // V9 PLUS ULTRA 01: pausa também vale para pedidos de mesa feitos pelo cliente (QR).
  // Vale só para o restaurante informado; a equipe continua podendo lançar.
  if (!actor.isStaff) {
    const rest = getRestaurant(params.restaurantSlug);
    if (rest?.isActive === false) throw new Error('Este restaurante não está recebendo pedidos.');
    assertCanAcceptNewOrder(params.restaurantSlug, false);
    if (rest?.isOpen === false) {
      throw new Error('Restaurante temporariamente fechado para novos pedidos.');
    }
  }
  if (!Number.isInteger(params.tableNumber) || params.tableNumber < 1 || params.tableNumber > 999) {
    throw new Error('Número de mesa inválido.');
  }
  assertTableNotAwaitingPayment(params.restaurantSlug, params.tableNumber);

  // Idempotência obrigatória para operações de mesa: retries/reloads com a mesma chave
  // devem devolver exatamente o mesmo resultado sem acrescentar itens novamente.
  if (params.idempotencyKey) {
    const existingByKey = findOrderByDeliveryKey(params.idempotencyKey);
    if (existingByKey && existingByKey.restaurantSlug === params.restaurantSlug) {
      // CORREÇÃO: retry/reload com a mesma chave não pode REIMPRIMIR a comanda.
      return { order: existingByKey, isNew: false, addedItems: [], deduplicated: true };
    }
  }

  // Look for active open order on this table
  const activeStatuses: OrderStatus[] = [
    'recebido',
    'aceito',
    'em_producao',
    'em_preparo',
    'parcialmente_pronto',
    'pronto',
  ];
  const existingIdx = ordersCache.findIndex(
    (o) =>
      o.orderType === 'mesa' &&
      o.tableNumber === params.tableNumber &&
      o.restaurantSlug === params.restaurantSlug &&
      activeStatuses.includes(o.status)
  );

  if (existingIdx !== -1) {
    // Append items to existing table order
    const existingOrder = ordersCache[existingIdx];
    const nowIso = new Date().toISOString();

    const sanitizedNewItems: OrderItem[] = priceOrderItems(params.restaurantSlug, params.items, actor).items;

    const combinedItems = [...existingOrder.items, ...sanitizedNewItems];
    const newSubtotal = Number(combinedItems.reduce((sum, it) => sum + it.totalPrice, 0).toFixed(2));
    const newTotal = Number((newSubtotal - (existingOrder.discount || 0)).toFixed(2));

    // Update stations
    const updatedStations = { ...(existingOrder.stations || {}) };
    for (const newItem of sanitizedNewItems) {
      const st = newItem.station || 'cozinha';
      if (!updatedStations[st]) {
        updatedStations[st] = {
          station: st,
          status: 'recebido',
          itemsCount: 0,
        };
      }
      updatedStations[st]!.itemsCount += newItem.quantity;
      if (updatedStations[st]!.status === 'pedido_feito') {
        updatedStations[st]!.status = 'recebido';
      }
    }

    let newStatus = existingOrder.status;
    if (newStatus === 'pronto') {
      newStatus = 'em_producao';
    }

    const updatedHistory: StatusHistoryEntry[] = [
      ...existingOrder.statusHistory,
      {
        status: newStatus,
        timestamp: 'Agora mesmo',
        note: `+${sanitizedNewItems.length} item(s) adicionados à mesa ${params.tableNumber}${params.waiterName ? ` por ${params.waiterName}` : ' pelo cliente'}`,
      },
    ];

    const updatedOrder: Order = {
      ...existingOrder,
      items: combinedItems,
      stations: updatedStations,
      subtotal: newSubtotal,
      total: newTotal,
      status: newStatus,
      statusHistory: updatedHistory,
      waiterName: params.waiterName || existingOrder.waiterName,
      // CORREÇÃO: guarda a chave desta operação. Antes só a chave de criação do pedido era
      // lembrada, então um retry (rede lenta, toque duplo) ADICIONAVA os itens de novo.
      appliedOperationKeys: params.idempotencyKey
        ? [...(existingOrder.appliedOperationKeys || []), params.idempotencyKey].slice(-50)
        : existingOrder.appliedOperationKeys,
      updatedAt: nowIso,
    };

    ordersCache[existingIdx] = updatedOrder;
    persistOrdersSync();

    return { order: updatedOrder, isNew: false, addedItems: sanitizedNewItems, deduplicated: false };
  }

  // Otherwise, create new order for table (preços recalculados dentro de createOrderTransactional)
  const newOrderResult = createOrderTransactional(
    {
      orderType: 'mesa',
      tableNumber: params.tableNumber,
      tableSessionId: params.tableSessionId,
      waiterName: params.waiterName,
      restaurantSlug: params.restaurantSlug,
      restaurantName: params.restaurantName || 'Restaurante',
      customerName: params.customerName || `Mesa ${String(params.tableNumber).padStart(2, '0')}`,
      customerPhone: params.customerPhone || '',
      paymentMethod: 'pix',
      items: params.items as any,
      idempotencyKey: params.idempotencyKey,
    },
    actor
  );

  return {
    order: newOrderResult.order,
    isNew: true,
    addedItems: newOrderResult.order.items,
    deduplicated: Boolean((newOrderResult as any).deduplicated),
  };
}

export function updateOrderItemTransactional(params: {
  orderId: string;
  itemId: string;
  quantity: number;
  selectedOptions?: OrderItemOption[];
  notes?: string;
  actor?: OrderActor;
  idempotencyKey?: string;
}): Order {
  initializeOrders();
  const idx = ordersCache.findIndex((o) => o.id === params.orderId);
  if (idx === -1) throw new Error(`Pedido com ID "${params.orderId}" não encontrado.`);
  const order = ordersCache[idx];
  if (order.status === 'finalizado' || order.status === 'cancelado') {
    throw new Error('Não é possível editar um pedido encerrado ou cancelado.');
  }
  const itemIndex = order.items.findIndex((i) => i.id === params.itemId);
  if (itemIndex === -1) throw new Error('Item do pedido não encontrado.');
  const current = order.items[itemIndex];
  const qty = Math.min(MAX_QTY_PER_ITEM, Math.max(1, Math.floor(Number(params.quantity) || 1)));
  const priced = priceOrderItems(order.restaurantSlug, [{
    id: current.id,
    name: current.name,
    quantity: qty,
    unitPrice: current.unitPrice,
    selectedOptions: params.selectedOptions ?? current.selectedOptions,
    notes: params.notes ?? current.notes,
    station: current.station,
  }], params.actor || { isStaff: true });
  const replacement = { ...priced.items[0], id: current.id };
  const items = [...order.items];
  items[itemIndex] = replacement;
  const subtotal = Number(items.reduce((sum, it) => sum + it.totalPrice, 0).toFixed(2));
  const total = Number(Math.max(0, subtotal - (order.discount || 0) + (order.deliveryFee || 0)).toFixed(2));
  const updated: Order = { ...order, items, subtotal, total, updatedAt: new Date().toISOString() };
  ordersCache[idx] = updated;
  persistOrdersSync();
  return updated;
}

/**
 * V9.2 — EXCLUIR ITEM: remove SOMENTE a quantidade informada do item selecionado.
 * - quantity < quantidade do item  → reduz a quantidade (recalcula preço/total);
 * - quantity >= quantidade do item → remove a linha do item;
 * - nunca apaga o pedido, cliente, mesa ou histórico; se sobrar zero itens, recusa
 *   (para isso existe cancelar pedido, com suas próprias regras).
 * Registra a operação no histórico do pedido (auditoria).
 */
export function removeOrderItemQuantityTransactional(params: {
  orderId: string;
  itemId: string;
  quantity: number;
  operatorName?: string;
  reason?: string;
}): { order: Order; removedQty: number; removedValue: number; removedName: string; lineRemoved: boolean } {
  initializeOrders();
  const idx = ordersCache.findIndex((o) => o.id === params.orderId);
  if (idx === -1) throw new Error(`Pedido com ID "${params.orderId}" não encontrado.`);
  const order = ordersCache[idx];
  if (order.status === 'finalizado' || order.status === 'cancelado') {
    throw new Error('Não é possível excluir item de um pedido encerrado ou cancelado.');
  }
  if (order.paymentDetails?.paid) {
    throw new Error('Pedido já pago: exclusão de item bloqueada. Use estorno/cancelamento pelo caixa.');
  }
  const itemIndex = order.items.findIndex((i) => i.id === params.itemId);
  if (itemIndex === -1) throw new Error('Item do pedido não encontrado.');
  const current = order.items[itemIndex];
  const wanted = Math.floor(Number(params.quantity));
  if (!Number.isFinite(wanted) || wanted < 1) throw new Error('Informe uma quantidade válida (mínimo 1).');
  const removedQty = Math.min(wanted, current.quantity);
  const remaining = current.quantity - removedQty;
  if (remaining === 0 && order.items.length === 1) {
    throw new Error('Este é o único item do pedido. Para removê-lo, cancele o pedido.');
  }

  let items = [...order.items];
  let removedValue: number;
  if (remaining === 0) {
    removedValue = current.totalPrice;
    items.splice(itemIndex, 1);
  } else {
    const priced = priceOrderItems(order.restaurantSlug, [{
      id: current.id,
      name: current.name,
      quantity: remaining,
      unitPrice: current.unitPrice,
      selectedOptions: current.selectedOptions,
      notes: current.notes,
      station: current.station,
    }], { isStaff: true });
    const replacement = { ...priced.items[0], id: current.id, printStations: current.printStations };
    removedValue = Number((current.totalPrice - replacement.totalPrice).toFixed(2));
    items[itemIndex] = replacement;
  }

  const subtotal = Number(items.reduce((sum, it) => sum + it.totalPrice, 0).toFixed(2));
  const total = Number(Math.max(0, subtotal - (order.discount || 0) + (order.deliveryFee || 0)).toFixed(2));
  const nowIso = new Date().toISOString();
  const updated: Order = {
    ...order,
    items,
    subtotal,
    total,
    statusHistory: [
      ...order.statusHistory,
      {
        status: order.status,
        timestamp: 'Agora mesmo',
        note: `ITEM EXCLUÍDO: ${removedQty}x ${current.name} (R$ ${removedValue.toFixed(2)})${params.reason ? ` — motivo: ${params.reason}` : ''}${params.operatorName ? ` — por ${params.operatorName}` : ''}.`,
      },
    ],
    updatedAt: nowIso,
  };
  ordersCache[idx] = updated;
  persistOrdersSync();
  return { order: updated, removedQty, removedValue, removedName: current.name, lineRemoved: remaining === 0 };
}

/**
 * V8 PRO — "FECHAR MESA ≠ PAGAR MESA".
 * Marca a(s) comanda(s) ativas de uma mesa como "conta fechada, aguardando
 * pagamento" — o garçom/cliente pediu a conta, mas o caixa ainda não
 * recebeu o pagamento. Não altera status nem paymentDetails.paid; é só um
 * sinalizador visual/operacional para diferenciar das mesas ainda em
 * consumo. A confirmação do pagamento continua sendo feita por
 * closeTableOrderTransactional (que grava paid=true e status='finalizado').
 */
/**
 * V9 ULTRA-CORREÇÃO: trava de segurança usada tanto na criação de pedido
 * (createOrderTransactional, orderType 'mesa') quanto no lançamento
 * incremental (appendItemsToTableOrderTransactional). Enquanto a mesa está
 * em AGUARDANDO PAGAMENTO (awaitingPayment=true numa comanda ativa), nenhum
 * item novo pode ser lançado — a conta só volta a aceitar lançamentos após
 * REABRIR CONTA (reopenTableOrderTransactional) ou depois de finalizada via
 * PAGAMENTO.
 */
function assertTableNotAwaitingPayment(restaurantSlug: string, tableNumber?: number): void {
  if (!Number.isInteger(tableNumber)) return;
  const blocking = ordersCache.find(
    (o) =>
      o.restaurantSlug === restaurantSlug &&
      o.orderType === 'mesa' &&
      o.tableNumber === tableNumber &&
      o.status !== 'finalizado' &&
      o.status !== 'cancelado' &&
      o.awaitingPayment
  );
  if (blocking) {
    throw new Error(
      `Mesa ${tableNumber} está em FECHAMENTO (aguardando pagamento) e não aceita novos itens. Reabra a conta para lançar novos pedidos.`
    );
  }
}

export function requestTableBillTransactional(params: {
  tableNumber: number;
  restaurantSlug: string;
  operatorName?: string;
}): Order[] {
  initializeOrders();
  const nowIso = new Date().toISOString();
  const affected: Order[] = [];

  ordersCache.forEach((order, idx) => {
    if (
      order.restaurantSlug === params.restaurantSlug &&
      order.orderType === 'mesa' &&
      order.tableNumber === params.tableNumber &&
      order.status !== 'finalizado' &&
      order.status !== 'cancelado'
    ) {
      const updated: Order = {
        ...order,
        awaitingPayment: true,
        billRequestedAt: nowIso,
        statusHistory: [
          ...order.statusHistory,
          {
            status: order.status,
            timestamp: 'Agora mesmo',
            note: `Conta solicitada${params.operatorName ? ` por ${params.operatorName}` : ''} — aguardando pagamento no caixa.`,
          },
        ],
        updatedAt: nowIso,
      };
      ordersCache[idx] = updated;
      affected.push(updated);
    }
  });

  if (affected.length > 0) persistOrdersSync();
  return affected;
}

/**
 * V9 ULTRA-CORREÇÃO — "REABRIR CONTA".
 * Desfaz o FECHAMENTO temporário (awaitingPayment=true) sem tocar em itens,
 * valores ou status do pedido: a mesa volta para EM USO e passa a aceitar
 * novos lançamentos de novo. Nunca mexe em comandas já finalizadas/pagas —
 * essa função não reverte um PAGAMENTO, só um pedido de conta.
 */
export function reopenTableOrderTransactional(params: {
  tableNumber: number;
  restaurantSlug: string;
  operatorName?: string;
}): Order[] {
  initializeOrders();
  const nowIso = new Date().toISOString();
  const affected: Order[] = [];

  ordersCache.forEach((order, idx) => {
    if (
      order.restaurantSlug === params.restaurantSlug &&
      order.orderType === 'mesa' &&
      order.tableNumber === params.tableNumber &&
      order.status !== 'finalizado' &&
      order.status !== 'cancelado' &&
      order.awaitingPayment
    ) {
      const updated: Order = {
        ...order,
        awaitingPayment: false,
        statusHistory: [
          ...order.statusHistory,
          {
            status: order.status,
            timestamp: 'Agora mesmo',
            note: `Conta reaberta${params.operatorName ? ` por ${params.operatorName}` : ''} — mesa voltou para EM USO, novos itens liberados.`,
          },
        ],
        updatedAt: nowIso,
      };
      ordersCache[idx] = updated;
      affected.push(updated);
    }
  });

  if (affected.length > 0) persistOrdersSync();
  return affected;
}

export function closeTableOrderTransactional(params: {
  orderId: string;
  tableNumber: number;
  paymentMethod: string;
  discount?: number;
  serviceFee?: number;
  total?: number;
  splitCount?: number;
  operatorName?: string;
  waiterNotes?: string;
  receiptType?: 'fiscal' | 'comum';
}): Order {
  initializeOrders();
  const idx = ordersCache.findIndex((o) => o.id === params.orderId);
  if (idx === -1) {
    throw new Error(`Pedido com ID "${params.orderId}" não encontrado para fechamento.`);
  }

  const currentOrder = ordersCache[idx];

  // Segurança (item 8 do checklist de fechamento): impede fechamento
  // duplicado. Sem esta trava no backend, dois cliques no botão de fechar
  // (ou duas abas/dispositivos fechando a mesma comanda) reabririam o
  // fluxo de pagamento sobre uma conta já paga e gerariam duplicidade no
  // histórico/auditoria mesmo com a trava de UI (disabled) do frontend.
  if (currentOrder.status === 'finalizado' && currentOrder.paymentDetails?.paid) {
    throw new Error(
      `Esta conta (Mesa ${params.tableNumber}, pedido ${currentOrder.shortCode}) já foi fechada e paga anteriormente. Abra uma nova comanda para a mesa.`
    );
  }

  const nowIso = new Date().toISOString();
  const discount = Math.max(0, Number(params.discount) || 0);
  // Taxa de serviço de 10% (EXCLUSIVA de mesa). Se o cliente não informou o campo
  // (undefined), vale o padrão do sistema (10% incluída). Se informou 0, foi
  // DESATIVADA de propósito pelo operador e é respeitada.
  const feeDefaultOn = getSystemSettings().serviceFeeDefaultOn !== false;
  const serviceFee =
    params.serviceFee === undefined || params.serviceFee === null
      ? feeDefaultOn && currentOrder.orderType === 'mesa'
        ? Number(((currentOrder.subtotal - discount) * 0.1).toFixed(2))
        : 0
      : Math.max(0, Number(params.serviceFee) || 0);
  const finalTotal = Number(
    (params.total !== undefined ? params.total : Math.max(0, currentOrder.subtotal - discount + serviceFee)).toFixed(2)
  );

  const splitCount = Math.max(1, Math.floor(params.splitCount || 1));
  const splitPerPerson = Number((finalTotal / splitCount).toFixed(2));

  const receiptType: 'fiscal' | 'comum' = params.receiptType === 'fiscal' ? 'fiscal' : 'comum';
  const receiptLabel = receiptType === 'fiscal' ? 'Nota Fiscal' : 'Cupom Comum';

  const closeNote = `Conta da Mesa ${params.tableNumber} fechada via ${params.paymentMethod.toUpperCase()} (${receiptLabel})${
    discount > 0 ? ` (Desconto: R$ ${discount.toFixed(2)})` : ''
  }${serviceFee > 0 ? ` (Taxa Serviço: R$ ${serviceFee.toFixed(2)})` : ''}${
    splitCount > 1 ? ` (Dividido em ${splitCount}x R$ ${splitPerPerson.toFixed(2)})` : ''
  }${params.waiterNotes ? ` - Obs: ${params.waiterNotes}` : ''}${
    params.operatorName ? ` por ${params.operatorName}` : ''
  }`;

  const updatedHistory: StatusHistoryEntry[] = [
    ...currentOrder.statusHistory,
    {
      status: 'finalizado',
      timestamp: 'Agora mesmo',
      note: closeNote,
    },
  ];

  const updatedOrder: Order = {
    ...currentOrder,
    // BUG CORRIGIDO: o fechamento da mesa gravava status 'entregue', mas
    // todos os filtros de "mesa com conta pendente" (Caixa, Kanban, Salão)
    // só consideram a mesa paga/fechada quando status === 'finalizado'.
    // Com 'entregue' a mesa nunca saía da lista de pendentes mesmo já paga.
    status: 'finalizado',
    awaitingPayment: false,
    paymentMethod: params.paymentMethod,
    discount,
    // CORREÇÃO: a taxa de serviço tem campo próprio. Antes era gravada no campo
    // `deliveryFee`, e o cupom/relatório a rotulava como "Taxa de entrega".
    // `deliveryFee` fica como estava no pedido (0 em mesa).
    serviceFee,
    total: finalTotal,
    paymentDetails: {
      ...(currentOrder.paymentDetails || {}),
      paid: true,
      receiptType,
    },
    statusHistory: updatedHistory,
    updatedAt: nowIso,
  };

  ordersCache[idx] = updatedOrder;
  persistOrdersSync();

  // Expira imediatamente a senha/QR do cliente para esta mesa: a partir daqui
  // qualquer pedido novo nessa mesa exige uma nova senha emitida pela equipe.
  markTableSessionClosed(currentOrder.restaurantSlug, params.tableNumber);

  console.log(`[TABLE CLOSED] Mesa ${params.tableNumber} fechada com sucesso. Pedido ${updatedOrder.shortCode} finalizado/entregue.`);
  return updatedOrder;
}


// ---------------------------------------------------------------------------
// VISÕES DE PEDIDO (o que cada perfil pode enxergar)
// ---------------------------------------------------------------------------

/** Remove segredos internos antes de enviar para colaboradores. */
export function toStaffView(order: Order): Omit<Order, 'trackingToken'> {
  const { trackingToken, ...rest } = order;
  return rest;
}

/** Visão do cliente dono do pedido (sem chaves internas). */
export function toCustomerView(order: Order) {
  const { idempotencyKey, appliedOperationKeys, printStatus, ...rest } = order;
  return rest;
}

/**
 * Rastreio público: exige id/código do pedido + token secreto recebido na
 * criação. Sem o token não há como consultar nada.
 */
export function getOrderForTracking(idOrCode: string, token: string): Order | undefined {
  initializeOrders();
  if (!token || token.length < 10) return undefined;
  const order = ordersCache.find((o) => o.id === idOrCode || o.shortCode.toLowerCase() === idOrCode.toLowerCase());
  if (!order || !order.trackingToken) return undefined;
  const a = Buffer.from(order.trackingToken);
  const b = Buffer.from(token);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return undefined;
  return order;
}
