import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { normalizePhone } from './phoneUtils';
import { getRestaurant, getCoupon, priceLine, restaurantExists, assertCanAcceptNewOrder } from './catalogService';
import { secureToken } from './security';
import { markTableSessionClosed } from './tableAccessService';

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
    complement?: string;
  };
  items: OrderItem[];
  stations?: Partial<Record<ProductionStation, StationProductionRecord>>;
  subtotal: number;
  deliveryFee: number;
  discount: number;
  couponCode?: string;
  total: number;
  paymentMethod: string;
  paymentDetails?: {
    cashChangeFor?: number;
    cardBrand?: string;
    pixCode?: string;
    paid: boolean;
  };
  notes?: string;
  status: OrderStatus;
  statusHistory: StatusHistoryEntry[];
  printStatus: 'pendente' | 'imprimindo' | 'impresso';
  idempotencyKey?: string;
  /** Token secreto entregue só a quem criou o pedido; permite acompanhar sem login. */
  trackingToken?: string;
  createdAt: string;
  updatedAt: string;
}

// Automatic item classification into kitchen, sushibar or bar stations
export function resolveItemStation(name: string, explicitStation?: string): ProductionStation {
  if (explicitStation === 'cozinha' || explicitStation === 'sushibar' || explicitStation === 'bar') {
    return explicitStation;
  }
  const lower = (name || '').toLowerCase();
  // Bar & Drinks Station keywords
  if (
    lower.includes('drink') ||
    lower.includes('cerveja') ||
    lower.includes('chopp') ||
    lower.includes('refrigerante') ||
    lower.includes('suco') ||
    lower.includes('água') ||
    lower.includes('agua') ||
    lower.includes('mojito') ||
    lower.includes('caipirinha') ||
    lower.includes('gin') ||
    lower.includes('vinho') ||
    lower.includes('coquetel') ||
    lower.includes('café') ||
    lower.includes('cafe') ||
    lower.includes('sake') ||
    lower.includes('saquê') ||
    lower.includes('saque') ||
    lower.includes('chá') ||
    lower.includes('cha') ||
    lower.includes('coca') ||
    lower.includes('guaraná') ||
    lower.includes('guarana') ||
    lower.includes('cocktail') ||
    lower.includes('whisky') ||
    lower.includes('whiskey') ||
    lower.includes('vodka') ||
    lower.includes('energético') ||
    lower.includes('energetico') ||
    lower.includes('red bull') ||
    lower.includes('tônica') ||
    lower.includes('tonica') ||
    lower.includes('aperol') ||
    lower.includes('heineken') ||
    lower.includes('stella') ||
    lower.includes('corona') ||
    lower.includes('bebida') ||
    lower.includes('dose') ||
    lower.includes('long neck') ||
    lower.includes('lata') ||
    lower.includes('garrafa') ||
    lower.includes('sangria') ||
    lower.includes('soda') ||
    lower.includes('limonada') ||
    lower.includes('prosecco') ||
    lower.includes('espumante') ||
    lower.includes('tequila') ||
    lower.includes('rum') ||
    lower.includes('licor')
  ) {
    return 'bar';
  }
  // Sushibar Station keywords
  if (
    lower.includes('sushi') ||
    lower.includes('sashimi') ||
    lower.includes('temaki') ||
    lower.includes('uramaki') ||
    lower.includes('hossomaki') ||
    lower.includes('niguiri') ||
    lower.includes('nigiri') ||
    lower.includes('gunkan') ||
    lower.includes('combinado') ||
    lower.includes('hot roll') ||
    lower.includes('ceviche') ||
    lower.includes('tataki') ||
    lower.includes('sunomono') ||
    lower.includes('edamame') ||
    lower.includes('carpaccio de salmão') ||
    lower.includes('carpaccio salmão') ||
    lower.includes('joy') ||
    lower.includes('djou') ||
    lower.includes('poke')
  ) {
    return 'sushibar';
  }
  // Default is kitchen (cozinha) for all hot meals, burgers, pizzas, pastas, desserts, portions
  return 'cozinha';
}

import { DATA_DIR } from './dataDir'; // Caminho configurável via env DATA_DIR (ver server/dataDir.ts)
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
      shortCode: '#TK-4821',
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
      shortCode: '#TK-4822',
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
  return ordersCache.find((o) => o.idempotencyKey === key);
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
    complement?: string;
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
  const deliveryFee =
    canonicalOrderType === 'delivery' ? Number(Number(restaurant.deliveryFee ?? 0).toFixed(2)) : 0;
  const calculatedTotal = Number(Math.max(0, calculatedSubtotal - calculatedDiscount + deliveryFee).toFixed(2));

// 4. Generate Unique IDs & Codes
  const randomSuffix = crypto.randomInt(1000, 10000);
  const shortCode = `#TK-${randomSuffix}`;
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
            complement: cleanText(payload.deliveryAddress.complement, 80) || undefined,
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
}, actor: OrderActor = {}): { order: Order; isNew: boolean } {
  initializeOrders();

  if (!restaurantExists(params.restaurantSlug)) {
    throw new Error('Restaurante não encontrado.');
  }
  if (!Number.isInteger(params.tableNumber) || params.tableNumber < 1 || params.tableNumber > 999) {
    throw new Error('Número de mesa inválido.');
  }

  // Idempotência obrigatória para operações de mesa: retries/reloads com a mesma chave
  // devem devolver exatamente o mesmo resultado sem acrescentar itens novamente.
  if (params.idempotencyKey) {
    const existingByKey = findOrderByDeliveryKey(params.idempotencyKey);
    if (existingByKey && existingByKey.restaurantSlug === params.restaurantSlug) {
      return { order: existingByKey, isNew: false };
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
      updatedAt: nowIso,
    };

    ordersCache[existingIdx] = updatedOrder;
    persistOrdersSync();

    return { order: updatedOrder, isNew: false };
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

  return { order: newOrderResult.order, isNew: true };
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
}): Order {
  initializeOrders();
  const idx = ordersCache.findIndex((o) => o.id === params.orderId);
  if (idx === -1) {
    throw new Error(`Pedido com ID "${params.orderId}" não encontrado para fechamento.`);
  }

  const currentOrder = ordersCache[idx];
  const nowIso = new Date().toISOString();
  const discount = Math.max(0, Number(params.discount) || 0);
  const serviceFee = Math.max(0, Number(params.serviceFee) || 0);
  const finalTotal = Number(
    (params.total !== undefined ? params.total : Math.max(0, currentOrder.subtotal - discount + serviceFee)).toFixed(2)
  );

  const splitCount = Math.max(1, Math.floor(params.splitCount || 1));
  const splitPerPerson = Number((finalTotal / splitCount).toFixed(2));

  const closeNote = `Conta da Mesa ${params.tableNumber} fechada via ${params.paymentMethod.toUpperCase()}${
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
    paymentMethod: params.paymentMethod,
    discount,
    deliveryFee: serviceFee, // service fee recorded in fee slot or final total
    total: finalTotal,
    paymentDetails: {
      ...(currentOrder.paymentDetails || {}),
      paid: true,
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
  const { idempotencyKey, printStatus, ...rest } = order;
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
