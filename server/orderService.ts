import fs from 'fs';
import path from 'path';

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
}

export type OrderStatus =
  | 'recebido'
  | 'em_preparo'
  | 'pronto'
  | 'saiu_para_entrega'
  | 'entregue'
  | 'cancelado';

export interface StatusHistoryEntry {
  status: OrderStatus;
  timestamp: string;
  note?: string;
}

export interface Order {
  id: string;
  shortCode: string;
  restaurantSlug: string;
  restaurantName: string;
  customerName: string;
  customerPhone: string;
  orderType: 'delivery' | 'retirada' | 'mesa' | 'balcao';
  tableNumber?: number;
  pickupNumber?: number;
  deliveryAddress?: {
    street: string;
    number: string;
    neighborhood: string;
    city: string;
    complement?: string;
  };
  items: OrderItem[];
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
  createdAt: string;
  updatedAt: string;
}

const DATA_DIR = path.join(process.cwd(), 'data');
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
    if (fs.existsSync(ORDERS_FILE)) {
      const raw = fs.readFileSync(ORDERS_FILE, 'utf-8');
      ordersCache = JSON.parse(raw);
      console.log(`[ORDER STORAGE] Carregados ${ordersCache.length} pedidos persistidos do arquivo.`);
    } else {
      ordersCache = getInitialSampleOrders();
      persistOrdersSync();
      console.log(`[ORDER STORAGE] Inicializado banco de pedidos com dados padrão.`);
    }
  } catch (err) {
    console.error('[ORDER STORAGE ERROR] Erro ao carregar arquivo de pedidos, usando fallback:', err);
    ordersCache = getInitialSampleOrders();
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
  customerName: string;
  customerPhone: string;
  restaurantSlug: string;
  restaurantName: string;
  orderType: 'delivery' | 'retirada' | 'mesa' | 'balcao';
  tableNumber?: number;
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

const RESTAURANT_DELIVERY_FEES: Record<string, number> = {
  japones: 7.5,
  italiano: 6.9,
  pizza: 5.9,
  hamburgueria: 6.0,
};

const RESTAURANT_NAMES: Record<string, string> = {
  japones: 'Sakura Sushi House',
  italiano: 'Cantina Bella Vista',
  pizza: "Forno D'Oro Pizzeria",
  hamburgueria: 'Burger Craft & Beer',
};

const VALID_COUPONS: Record<string, { type: 'percent' | 'fixed'; value: number; minSubtotal?: number }> = {
  BEMVINDO10: { type: 'percent', value: 10, minSubtotal: 30 },
  TOKIO5: { type: 'fixed', value: 5, minSubtotal: 25 },
  PRIMEIRACOMPRA: { type: 'percent', value: 15, minSubtotal: 40 },
};

export function createOrderTransactional(payload: CreateOrderPayload): { order: Order; deduplicated: boolean } {
  initializeOrders();

  console.log(`[ORDER] Recebendo pedido de ${payload.customerName} (${payload.customerPhone})`);
  console.log(`[ORDER] Idempotency Key: ${payload.idempotencyKey || 'N/A'}`);
  console.log(`[ORDER] Restaurante: ${payload.restaurantSlug}`);

  // 1. Idempotency Check: Prevent duplicate orders
  if (payload.idempotencyKey) {
    const existing = findOrderByDeliveryKey(payload.idempotencyKey);
    if (existing) {
      console.log(`[ORDER DEDUPLICATED] Pedido já existente encontrado com chave ${payload.idempotencyKey}. ID: ${existing.id}`);
      return { order: existing, deduplicated: true };
    }
  }

  // 2. Validate payload
  if (!payload.customerName || !payload.customerPhone) {
    throw new Error('Nome e telefone do cliente são obrigatórios.');
  }

  if (!payload.items || payload.items.length === 0) {
    throw new Error('O pedido deve conter pelo menos 1 item.');
  }

  const validSlugs = ['japones', 'italiano', 'pizza', 'hamburgueria'];
  const slug = validSlugs.includes(payload.restaurantSlug) ? payload.restaurantSlug : 'japones';
  const restaurantName = RESTAURANT_NAMES[slug] || payload.restaurantName;

  // 3. Server-side Recalculation & Validation of Items and Totals
  let calculatedSubtotal = 0;
  const sanitizedItems: OrderItem[] = payload.items.map((it, idx) => {
    const qty = Math.max(1, Math.floor(it.quantity || 1));
    const baseUnit = Math.max(0, Number(it.unitPrice) || 0);
    const optionsTotal = (it.selectedOptions || []).reduce((acc, opt) => acc + (Number(opt.price) || 0), 0);
    const unitPrice = Number((baseUnit + optionsTotal).toFixed(2));
    const itemTotal = Number((unitPrice * qty).toFixed(2));

    calculatedSubtotal += itemTotal;

    return {
      id: it.id || `item-${Date.now()}-${idx}`,
      name: it.name || 'Item do Cardápio',
      quantity: qty,
      unitPrice,
      totalPrice: itemTotal,
      selectedOptions: it.selectedOptions || [],
      notes: it.notes?.trim() || undefined,
    };
  });

  calculatedSubtotal = Number(calculatedSubtotal.toFixed(2));

  // Validate coupon discount
  let calculatedDiscount = 0;
  if (payload.couponCode) {
    const cleanCoupon = payload.couponCode.trim().toUpperCase();
    const couponDef = VALID_COUPONS[cleanCoupon];
    if (couponDef) {
      if (!couponDef.minSubtotal || calculatedSubtotal >= couponDef.minSubtotal) {
        if (couponDef.type === 'percent') {
          calculatedDiscount = Number(((calculatedSubtotal * couponDef.value) / 100).toFixed(2));
        } else {
          calculatedDiscount = couponDef.value;
        }
      }
    }
  }
  calculatedDiscount = Math.min(calculatedDiscount, calculatedSubtotal);

  // Delivery fee calculation
  const deliveryFee = payload.orderType === 'delivery' ? (RESTAURANT_DELIVERY_FEES[slug] ?? 7.0) : 0;
  const calculatedTotal = Number(Math.max(0, calculatedSubtotal - calculatedDiscount + deliveryFee).toFixed(2));

  // 4. Generate Unique IDs & Codes
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const shortCode = `#TK-${randomSuffix}`;
  const orderId = `ord-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const nowIso = new Date().toISOString();

  // 5. Build strict order object (ALWAYS 'recebido' - NEVER auto 'pronto')
  const newOrder: Order = {
    id: orderId,
    shortCode,
    restaurantSlug: slug,
    restaurantName,
    customerName: payload.customerName.trim(),
    customerPhone: payload.customerPhone.trim(),
    orderType: payload.orderType,
    tableNumber: payload.orderType === 'mesa' ? payload.tableNumber : undefined,
    pickupNumber:
      payload.orderType === 'balcao' || payload.orderType === 'retirada'
        ? payload.pickupNumber
        : undefined,
    deliveryAddress:
      payload.orderType === 'delivery' && payload.deliveryAddress
        ? {
            street: payload.deliveryAddress.street.trim(),
            number: payload.deliveryAddress.number.trim(),
            neighborhood: payload.deliveryAddress.neighborhood.trim(),
            city: payload.deliveryAddress.city.trim(),
            complement: payload.deliveryAddress.complement?.trim() || undefined,
          }
        : undefined,
    items: sanitizedItems,
    subtotal: calculatedSubtotal,
    deliveryFee,
    discount: calculatedDiscount,
    couponCode: payload.couponCode?.trim().toUpperCase() || undefined,
    total: calculatedTotal,
    paymentMethod: payload.paymentMethod,
    paymentDetails: payload.paymentDetails,
    notes: payload.notes?.trim() || undefined,
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
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  console.log(`[ORDER] ID gerado: ${newOrder.id} (${newOrder.shortCode})`);
  console.log(`[ORDER] Status inicial: NOVO (recebido)`);
  console.log(`[ORDER] Salvando pedido...`);

  // 6. Prepend to in-memory cache and commit to disk
  ordersCache.unshift(newOrder);
  persistOrdersSync();

  console.log(`[ORDER] Pedido salvo com sucesso`);
  console.log(`[ORDER] Notificando painel: Pedido ${newOrder.shortCode} disponível`);

  return { order: newOrder, deduplicated: false };
}

// Order Status Transitions - Enforces strict order lifecycle:
// recebido -> em_preparo -> pronto -> saiu_para_entrega -> entregue
const ALLOWED_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  recebido: ['em_preparo', 'cancelado'],
  em_preparo: ['pronto', 'cancelado'],
  pronto: ['saiu_para_entrega', 'cancelado'],
  saiu_para_entrega: ['entregue', 'cancelado'],
  entregue: [],
  cancelado: [],
};

const DEFAULT_STATUS_NOTES: Record<OrderStatus, string> = {
  recebido: 'Pedido registrado no sistema',
  em_preparo: 'Iniciado preparo na cozinha',
  pronto: 'Pronto e embalado com sucesso na expedição',
  saiu_para_entrega: 'Saiu para entrega com entregador',
  entregue: 'Pedido entregue e concluído com sucesso',
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
