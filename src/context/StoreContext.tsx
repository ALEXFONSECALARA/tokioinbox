import React, { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from 'react';
import { useServerDoc } from '../painel/useServerDoc';
import {
  RestaurantConfig,
  RestaurantSlug,
  MenuCategory,
  MenuItem,
  Order,
  CartItem,
  CartItemOptionSelected,
  OrderType,
  OrderStatus,
  PaymentMethod,
  CustomerRecord,
  PrinterSettings,
  OrderSoundType,
  SoundSettings,
  DelayAlertSettings,
  UserAccount,
  UserPermissions,
  ConnectedDevice,
  AuditActionLog,
  DeliveryPersonnel,
  CashRegisterMovement,
  CashRegisterShift,
  CustomerUser,
  ProductionStation,
  StationItemStatus,
  SalesChannelConfig,
} from '../types/restaurant';
import {
  getSimulatedOffline,
  enqueueOfflineOperation,
  getOfflineQueue,
  removeOfflineOperation,
} from '../utils/offlineQueueManager';
import {
  INITIAL_RESTAURANTS,
  INITIAL_CATEGORIES,
  INITIAL_MENU_ITEMS,
  INITIAL_SAMPLE_ORDERS,
  INITIAL_CUSTOMERS,
} from '../data/seedData';
import {
  playAlertSound,
  playDelayAlertSound,
  triggerVibrate,
  unlockAudio,
  checkAudioUnlocked,
} from '../utils/audioAlert';
import { ToastItem, ToastType, ToastContainer } from '../components/ToastNotification';

interface Coupon {
  code: string;
  type: 'percent' | 'fixed';
  value: number;
  minSubtotal?: number;
}

const VALID_COUPONS: Coupon[] = [
  { code: 'BEMVINDO10', type: 'percent', value: 10, minSubtotal: 30 },
  { code: 'TOKIO5', type: 'fixed', value: 5, minSubtotal: 25 },
  { code: 'PRIMEIRACOMPRA', type: 'percent', value: 15, minSubtotal: 40 },
];

export const DEFAULT_SOUND_SETTINGS: SoundSettings = {
  enabled: true,
  soundType: 'sound1',
  volume: 0.8,
  repeatUntilAcknowledged: false,
  vibrationEnabled: true,
  alertOnDelay: true,
  delayThresholdMinutes: 15,
  delayRepeatMinutes: 3,
  alertOnMobile: true,
  alertOnPanel: true,
};

export const DEFAULT_DELAY_SETTINGS: DelayAlertSettings = {
  enabled: true,
  thresholdMinutes: 15,
  repeatIntervalMinutes: 3,
  silencedOrderIds: [],
};

interface StoreContextType {
  restaurants: Record<string, RestaurantConfig>;
  categories: MenuCategory[];
  menuItems: MenuItem[];
  orders: Order[];
  customers: CustomerRecord[];
  cart: CartItem[];
  orderType: OrderType;
  selectedTable: number | null;
  activeRestaurantSlug: RestaurantSlug;
  isCartOpen: boolean;
  appliedCoupon: Coupon | null;
  trackingOrderId: string | null;
  currentRestaurant: RestaurantConfig;
  cartItemCount: number;
  cartTotal: number;
  printerSettings: PrinterSettings;
  soundSettings: SoundSettings;
  delaySettings: DelayAlertSettings;
  isAudioUnlocked: boolean;
  isOnline: boolean;
  isSyncing: boolean;
  lastSyncTime: Date;

  // Authentication & RBAC
  currentUser: UserAccount | null;
  loginUser: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logoutUser: () => void;
  checkPermission: (permKey: keyof UserPermissions) => boolean;

  // Connected Mobile Receivers & Devices
  connectedDevices: ConnectedDevice[];
  refreshDevices: () => Promise<void>;

  // Audit Logs
  auditLogs: AuditActionLog[];
  refreshAuditLogs: () => Promise<void>;
  logAction: (action: string, category?: 'order' | 'user' | 'alert' | 'device' | 'system', details?: string) => Promise<void>;

  // Actions
  setActiveRestaurantSlug: (slug: RestaurantSlug) => void;
  setOrderType: (type: OrderType) => void;
  setSelectedTable: (table: number | null) => void;
  setIsCartOpen: (open: boolean) => void;
  setTrackingOrderId: (id: string | null) => void;

  addToCart: (
    item: MenuItem,
    quantity: number,
    selectedOptions: CartItemOptionSelected[],
    notes?: string
  ) => void;
  updateCartItemQuantity: (cartItemId: string, delta: number) => void;
  removeFromCart: (cartItemId: string) => void;
  clearCart: () => void;
  applyCoupon: (code: string) => { success: boolean; message: string };
  removeCoupon: () => void;

  createOrder: (
    orderData: {
      customerName: string;
      customerPhone: string;
      orderType: OrderType;
      tableNumber?: number;
      pickupNumber?: number;
      deliveryAddress?: {
        street: string;
        number: string;
        neighborhood: string;
        city: string;
        complement?: string;
      };
      paymentMethod: PaymentMethod;
      paymentDetails?: {
        cashChangeFor?: number;
        cardBrand?: string;
        pixCode?: string;
        paid: boolean;
      };
      notes?: string;
    },
    idempotencyKey?: string
  ) => Promise<Order>;
  createQuickTestOrder: (orderType?: 'delivery' | 'mesa' | 'balcao') => Promise<Order | void>;
  showToast: (message: string, type?: ToastType, duration?: number) => void;

  updateOrderStatus: (orderId: string, status: OrderStatus, note?: string) => Promise<void>;
  updateOrderItem: (params: { orderId: string; itemId: string; quantity: number; selectedOptions?: any[]; notes?: string; }) => Promise<{ success: boolean; order?: Order; error?: string }>;
  updateStationStatus: (
    orderId: string,
    station: ProductionStation,
    status: StationItemStatus,
    operatorName?: string
  ) => Promise<void>;
  appendItemsToTableOrder: (params: {
    tableNumber: number;
    restaurantSlug?: RestaurantSlug;
    restaurantName?: string;
    items: Array<{
      id?: string;
      name: string;
      quantity: number;
      unitPrice: number;
      selectedOptions?: any[];
      notes?: string;
      station?: ProductionStation;
    }>;
    customerName?: string;
    customerPhone?: string;
    waiterName?: string;
    tableSessionId?: string;
    tableAccessToken?: string;
    idempotencyKey?: string;
  }) => Promise<{ success: boolean; order?: Order; isNew?: boolean; error?: string }>;
  closeTableOrder: (params: {
    orderId: string;
    tableNumber: number;
    paymentMethod: string;
    discount?: number;
    serviceFee?: number;
    total?: number;
    splitCount?: number;
    operatorName?: string;
    waiterNotes?: string;
  }) => Promise<{ success: boolean; order?: Order; error?: string }>;
  updateOrderPrintStatus: (orderId: string, printStatus: 'pendente' | 'imprimindo' | 'impresso') => Promise<void>;
  deleteOrder: (orderId: string) => Promise<void>;
  clearOrdersHistory: (slug?: RestaurantSlug, mode?: 'finished' | 'all') => Promise<void>;
  clearAllOrders: () => void;
  syncOrdersNow: () => Promise<void>;

  // Audio Alerts Management
  updateSoundSettings: (settings: Partial<SoundSettings>) => void;
  updateDelaySettings: (settings: Partial<DelayAlertSettings>) => void;
  silenceOrderDelay: (orderId: string) => void;
  testSound: (type?: OrderSoundType) => void;
  unlockAudioContext: () => void;

  // Customers Management (Separated)
  clearCustomersData: () => void;
  deleteCustomer: (customerId: string) => void;
  addCustomer: (customer: Omit<CustomerRecord, 'id' | 'createdAt'>) => void;
  updateCustomerNotes: (customerId: string, notes: string) => void;

  // Printer Settings
  updatePrinterSettings: (settings: Partial<PrinterSettings>) => void;

  // Menu Management
  updateMenuItem: (item: MenuItem) => void;
  addMenuItem: (item: Omit<MenuItem, 'id'>) => void;
  deleteMenuItem: (itemId: string) => void;
  updateRestaurantConfig: (slug: RestaurantSlug, updates: Partial<RestaurantConfig>) => void;
  addRestaurant: (restaurant: RestaurantConfig) => void;
  deleteRestaurant: (slug: RestaurantSlug) => void;
  resetToDefaultData: () => void;
  addDeliveryStaff: (data: { name: string; phone: string; vehicle: DeliveryPersonnel['vehicle']; commissionRate: number }) => void;
  removeDeliveryStaff: (staffId: string) => void;
  cashShiftHistory: CashRegisterShift[];
  openCashShift: (initialAmount: number) => void;
  appMode: StoreMode;

  // Master Reset & Multi-Restaurant Order Flow
  masterResetOrders: (confirmation: string) => Promise<{ success: boolean; count: number; message: string }>;
  createBatchOrders: (
    orderData: {
      customerName: string;
      customerPhone: string;
      orderType: OrderType;
      tableNumber?: number;
      deliveryAddress?: {
        street: string;
        number: string;
        neighborhood: string;
        city: string;
        complement?: string;
      };
      paymentMethod: PaymentMethod;
      paymentDetails?: {
        cashChangeFor?: number;
        cardBrand?: string;
        pixCode?: string;
        paid: boolean;
      };
      notes?: string;
    },
    baseIdempotencyKey?: string
  ) => Promise<Order[]>;

  // Customer Account
  currentCustomer: CustomerUser | null;
  loginCustomer: (phoneOrEmail: string, name?: string) => void;
  logoutCustomer: () => void;
  updateCustomerProfile: (data: Partial<CustomerUser>) => void;
  addCustomerAddress: (addr: {
    title: string;
    street: string;
    number: string;
    neighborhood: string;
    city: string;
    complement?: string;
    isDefault?: boolean;
  }) => void;

  // Vitrine Manager
  updateVitrineConfig: (slug: string, updates: Partial<RestaurantConfig>) => void;

  // Real-time Delivery Personnel
  deliveryStaff: DeliveryPersonnel[];
  updateDeliveryStaffStatus: (staffId: string, status: DeliveryPersonnel['status']) => void;
  assignOrderToDelivery: (orderId: string, staffId: string) => void;

  // Cash Register / Fechamento de Caixa
  cashShift: CashRegisterShift;
  addCashMovement: (type: CashRegisterMovement['type'], amount: number, description: string) => void;
  closeCashShift: () => void;

  // Sales Channels Configuration (Canais de Venda)
  salesChannels: Record<string, SalesChannelConfig>;
  updateSalesChannel: (channelId: string, updates: Partial<SalesChannelConfig>) => void;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

const EMPTY_CLOSED_SHIFT: CashRegisterShift = {
  id: '',
  openedAt: '',
  initialAmount: 0,
  movements: [],
  isClosed: true,
};

const STORAGE_KEYS = {
  RESTAURANTS: 'tokio_inbox_restaurants_v25',
  CATEGORIES: 'tokio_inbox_categories_v25',
  MENU_ITEMS: 'tokio_inbox_menu_items_v25',
  ORDERS: 'tokio_inbox_orders_v25',
  CUSTOMERS: 'tokio_inbox_customers_v25',
  CART: 'tokio_inbox_cart_v25',
  PRINTER_SETTINGS: 'tokio_inbox_printer_settings_v25',
  SOUND_SETTINGS: 'tokio_inbox_sound_settings_v25',
  DELAY_SETTINGS: 'tokio_inbox_delay_settings_v25',
  SALES_CHANNELS: 'tokio_sales_channels_v25',
};

export const INITIAL_SALES_CHANNELS: Record<string, SalesChannelConfig> = {
  mesa: {
    id: 'mesa',
    orderType: 'mesa',
    name: 'Salão / Mesa (Dine-in)',
    enabled: true,
    color: '#D97706', // COR 2 (Âmbar Ouro)
    allowQrCodeCustomerOrder: true,
    autoPrintReceipt: true,
    productionStations: ['cozinha', 'sushibar', 'bar'],
    acceptedPaymentMethods: ['pix', 'cartao_credito', 'cartao_debito', 'dinheiro'],
    operationalHours: '11:00 às 23:30',
    description: 'Atendimento presencial em mesas via Garçom Touch ou QR Code do cliente',
  },
  balcao: {
    id: 'balcao',
    orderType: 'balcao',
    name: 'Balcão (Counter)',
    enabled: true,
    color: '#0284C7', // COR 1 (Azul Ciano)
    allowQrCodeCustomerOrder: false,
    autoPrintReceipt: true,
    productionStations: ['cozinha', 'sushibar', 'bar'],
    acceptedPaymentMethods: ['pix', 'cartao_credito', 'cartao_debito', 'dinheiro'],
    operationalHours: '11:00 às 23:00',
    description: 'Venda direta rápida com senha de retirada, sem abertura de mesa',
  },
  delivery: {
    id: 'delivery',
    orderType: 'delivery',
    name: 'Delivery (Entrega)',
    enabled: true,
    color: '#059669', // Esmeralda
    allowQrCodeCustomerOrder: false,
    autoPrintReceipt: true,
    productionStations: ['cozinha', 'sushibar'],
    acceptedPaymentMethods: ['pix', 'cartao_credito', 'cartao_debito', 'dinheiro'],
    operationalHours: '18:00 às 23:00',
    minOrderValue: 30.0,
    description: 'Entrega em domicílio com taxa e tempo estimado',
  },
  online: {
    id: 'online',
    orderType: 'online',
    name: 'Cardápio Online Web',
    enabled: true,
    color: '#7C3AED', // COR 3 (Roxo Violeta)
    allowQrCodeCustomerOrder: true,
    autoPrintReceipt: true,
    productionStations: ['cozinha', 'sushibar', 'bar'],
    acceptedPaymentMethods: ['pix', 'cartao_credito', 'dinheiro'],
    operationalHours: '11:00 às 23:30',
    description: 'Acesso via internet com carrinho, escolha de delivery/retirada sem mesa',
  },
  retirada: {
    id: 'retirada',
    orderType: 'retirada',
    name: 'Retirada Takeaway',
    enabled: true,
    color: '#2563EB', // Azul Royal
    allowQrCodeCustomerOrder: false,
    autoPrintReceipt: true,
    productionStations: ['cozinha', 'sushibar'],
    acceptedPaymentMethods: ['pix', 'cartao_credito', 'cartao_debito', 'dinheiro'],
    operationalHours: '11:00 às 23:00',
    description: 'Pedido online ou agendado para o cliente buscar no restaurante',
  },
};

const DEFAULT_PRINTER_SETTINGS: PrinterSettings = {
  paperWidth: '80mm',
  autoPrintOnNewOrder: true,
  soundAlert: true,
  showQrCode: true,
  numberOfCopies: 1,
  headerCustomNote: 'VIA DA COZINHA / EXPEDIÇÃO',
};


// ---------------------------------------------------------------------------
// CRM derivado dos pedidos: totais, último pedido e endereços são RECALCULADOS a partir dos pedidos
// do servidor (idempotente: vários aparelhos chegam ao mesmo resultado, sem contar em duplicidade).
// Campos manuais (e-mail, observações) são preservados.
// ---------------------------------------------------------------------------
const PLACEHOLDER_PHONE_DIGITS = '11999990000';

function mergeCrmFromOrders(prev: CustomerRecord[], orders: Order[]): CustomerRecord[] {
  const groups = new Map<string, Order[]>();
  for (const o of orders) {
    if (o.status === 'cancelado') continue;
    const digits = (o.customerPhone || '').replace(/\D/g, '');
    if (digits.length < 8 || digits === PLACEHOLDER_PHONE_DIGITS) continue;
    const list = groups.get(digits) || [];
    list.push(o);
    groups.set(digits, list);
  }
  if (groups.size === 0) return prev;

  const next = [...prev];
  let changed = false;
  groups.forEach((list, digits) => {
    list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const latest = list[0];
    const totalSpent = Number(list.reduce((t, o) => t + (o.total || 0), 0).toFixed(2));
    const addresses: NonNullable<CustomerRecord['addresses']> = [];
    for (const o of list) {
      const a = o.deliveryAddress;
      if (a && !addresses.some((x) => x.street.toLowerCase() === a.street.toLowerCase() && x.number === a.number)) {
        addresses.push(a);
      }
    }
    const idx = next.findIndex((c) => c.phone.replace(/\D/g, '') === digits);
    if (idx === -1) {
      next.push({
        id: `cust-${digits}`,
        name: latest.customerName,
        phone: latest.customerPhone,
        addresses,
        totalOrders: list.length,
        totalSpent,
        lastOrderAt: latest.createdAt,
        createdAt: list[list.length - 1].createdAt,
        preferredRestaurant: latest.restaurantSlug,
      });
      changed = true;
      return;
    }
    const cur = next[idx];
    const knownAddresses = cur.addresses || [];
    const mergedAddresses = [
      ...addresses,
      ...knownAddresses.filter((k) => !addresses.some((x) => x.street.toLowerCase() === k.street.toLowerCase() && x.number === k.number)),
    ];
    if (
      cur.totalOrders === list.length &&
      cur.totalSpent === totalSpent &&
      cur.lastOrderAt === latest.createdAt &&
      mergedAddresses.length === knownAddresses.length
    ) {
      return;
    }
    next[idx] = {
      ...cur,
      name: cur.name || latest.customerName,
      totalOrders: list.length,
      totalSpent,
      lastOrderAt: latest.createdAt,
      addresses: mergedAddresses,
      preferredRestaurant: latest.restaurantSlug,
    };
    changed = true;
  });
  return changed ? next : prev;
}

export type StoreMode = 'customer' | 'staff';

const PUBLIC_CATALOG_CACHE_KEY = 'nx_public_catalog_v1';
const MY_ORDERS_KEY = 'nx_my_orders_v1';

interface MyOrderRef {
  id: string;
  t: string;
}

function readMyOrders(): MyOrderRef[] {
  try {
    const raw = localStorage.getItem(MY_ORDERS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x) => x && x.id && x.t) : [];
  } catch {
    return [];
  }
}

function rememberMyOrders(orders: Array<{ id: string; trackingToken?: string }>) {
  const withToken = orders.filter((o) => o.trackingToken);
  if (withToken.length === 0) return;
  try {
    const current = readMyOrders().filter((r) => !withToken.some((o) => o.id === r.id));
    const next = [...withToken.map((o) => ({ id: o.id, t: o.trackingToken as string })), ...current].slice(0, 30);
    localStorage.setItem(MY_ORDERS_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event('nx-my-orders-changed'));
  } catch {
    /* storage cheio/bloqueado: rastreio só nesta sessão */
  }
}

function readCachedPublicCatalog(): { restaurants: Record<string, RestaurantConfig>; categories: MenuCategory[]; menuItems: MenuItem[] } | null {
  try {
    const raw = localStorage.getItem(PUBLIC_CATALOG_CACHE_KEY);
    if (!raw) return null;
    const c = JSON.parse(raw);
    if (c && c.restaurants && Array.isArray(c.menuItems) && Array.isArray(c.categories)) return c;
  } catch {
    /* ignore */
  }
  return null;
}

export const StoreProvider: React.FC<{ children: ReactNode; mode?: StoreMode }> = ({ children, mode = 'customer' }) => {
  // 'customer' (padrão, seguro) = cardápio público. 'staff' = painel autenticado da equipe.
  const isStaffMode = mode === 'staff';

  // Ninguém começa autenticado. Somente o painel (mode='staff') restaura a sessão do navegador,
  // e ela é revalidada no servidor (/api/auth/me) logo após carregar.
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(() => {
    if (!isStaffMode) return null;
    try {
      const saved = sessionStorage.getItem('tokio_current_user_v25');
      const token = sessionStorage.getItem('tokio_staff_token');
      if (!saved || saved === 'logged_out' || !token) return null;
      return { ...JSON.parse(saved), token };
    } catch {
      return null;
    }
  });

  // Documentos compartilhados só são lidos/gravados com colaborador logado
  const docsEnabled = isStaffMode && Boolean(currentUser);
  const docError = (msg: string) => {
    // showToast é declarado mais abaixo; usa o evento para não depender da ordem dos hooks
    window.dispatchEvent(new CustomEvent('nx-toast', { detail: { message: msg, type: 'error' } }));
  };

  const [restaurants, setRestaurants] = useState<Record<string, RestaurantConfig>>(() => {
    if (!isStaffMode) {
      const cached = readCachedPublicCatalog();
      if (cached) return cached.restaurants;
      return INITIAL_RESTAURANTS;
    }
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.RESTAURANTS);
      const parsed = saved ? JSON.parse(saved) : {};
      // Ensure all restaurants (including new initial ones) are present and have customUrlPath
      const hydrated: Record<string, RestaurantConfig> = { ...INITIAL_RESTAURANTS, ...parsed };
      for (const [key, rest] of Object.entries(hydrated)) {
        if (!rest.customUrlPath) {
          const defaultPath = INITIAL_RESTAURANTS[key]?.customUrlPath;
          hydrated[key] = {
            ...rest,
            customUrlPath: defaultPath || rest.name.replace(/[^a-zA-Z0-9]/g, '') || rest.slug,
          };
        }
      }
      return hydrated;
    } catch {
      return INITIAL_RESTAURANTS;
    }
  });

  const [categories, setCategories] = useState<MenuCategory[]>(() => {
    if (!isStaffMode) return readCachedPublicCatalog()?.categories || INITIAL_CATEGORIES;
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.CATEGORIES);
      if (!saved) return INITIAL_CATEGORIES;
      const parsed: MenuCategory[] = JSON.parse(saved);
      const existingCatIds = new Set(parsed.map((c) => c.id));
      const missingCats = INITIAL_CATEGORIES.filter((c) => !existingCatIds.has(c.id));
      return [...parsed, ...missingCats];
    } catch {
      return INITIAL_CATEGORIES;
    }
  });

  const [menuItems, setMenuItems] = useState<MenuItem[]>(() => {
    if (!isStaffMode) return readCachedPublicCatalog()?.menuItems || INITIAL_MENU_ITEMS;
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.MENU_ITEMS);
      if (!saved) return INITIAL_MENU_ITEMS;
      const parsed: MenuItem[] = JSON.parse(saved);
      const initialMap = new Map(INITIAL_MENU_ITEMS.map((i) => [i.id, i]));
      const sanitized = parsed.map((item) => {
        if (!item.station) {
          const fromSeed = initialMap.get(item.id);
          const cat = (item.categoryId || '').toLowerCase();
          const fallbackStation = cat.includes('bebida') || cat.includes('vinho') || cat.includes('cerveja') || cat.includes('bar')
            ? 'bar'
            : cat.includes('sushi') || cat.includes('temaki') || cat.includes('combinado')
            ? 'sushibar'
            : 'cozinha';
          return { ...item, station: fromSeed?.station || fallbackStation };
        }
        return item;
      });
      const existingItemIds = new Set(sanitized.map((i) => i.id));
      const missingItems = INITIAL_MENU_ITEMS.filter((i) => !existingItemIds.has(i.id));
      return [...sanitized, ...missingItems];
    } catch {
      return INITIAL_MENU_ITEMS;
    }
  });

  // Pedidos vêm SEMPRE do servidor (equipe: lista completa autenticada; cliente: só os próprios por token).
  // Nada de dados pessoais de pedidos persistidos no navegador.
  const [orders, setOrders] = useState<Order[]>([]);

  // CRM da equipe: documento compartilhado no servidor (não existe mais lista de clientes de exemplo)
  const [customers, setCustomers] = useServerDoc<CustomerRecord[]>('customers', [], { enabled: docsEnabled, onError: docError });

  const [printerSettings, setPrinterSettings] = useServerDoc<PrinterSettings>('printerSettings', DEFAULT_PRINTER_SETTINGS, { enabled: docsEnabled, onError: docError });

  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.CART);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [soundSettings, setSoundSettings] = useState<SoundSettings>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SOUND_SETTINGS);
      return saved ? JSON.parse(saved) : DEFAULT_SOUND_SETTINGS;
    } catch {
      return DEFAULT_SOUND_SETTINGS;
    }
  });

  const [delaySettings, setDelaySettings] = useServerDoc<DelayAlertSettings>('delaySettings', DEFAULT_DELAY_SETTINGS, { enabled: docsEnabled, onError: docError });

  const [salesChannels, setSalesChannels] = useServerDoc<Record<string, SalesChannelConfig>>('salesChannels', INITIAL_SALES_CHANNELS, { enabled: docsEnabled, onError: docError });

  const updateSalesChannel = (channelId: string, updates: Partial<SalesChannelConfig>) => {
    setSalesChannels((prev) => {
      const current = prev[channelId] || INITIAL_SALES_CHANNELS[channelId];
      if (!current) return prev;
      const updated = {
        ...prev,
        [channelId]: { ...current, ...updates },
      };
      return updated;
    });
    showToast(`Canal de venda atualizado com sucesso!`, 'success');
  };

  const [connectedDevices, setConnectedDevices] = useState<ConnectedDevice[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditActionLog[]>([]);

  const [isAudioUnlocked, setIsAudioUnlocked] = useState(false);
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date>(new Date());

  // Ref tracking order IDs that have already triggered an alert
  const alertedOrderIdsRef = useRef<Set<string>>(new Set());
  // ETag cache reference to support HTTP 304 Not Modified bandwidth savings
  const ordersEtagRef = useRef<string | null>(null);

  const [activeRestaurantSlug, setActiveRestaurantSlug] = useState<RestaurantSlug>('japones');
  const [orderType, setOrderType] = useState<OrderType>('delivery');
  const [selectedTable, setSelectedTable] = useState<number | null>(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [trackingOrderId, setTrackingOrderId] = useState<string | null>(null);

  // Customer Account (Client side)
  const [currentCustomer, setCurrentCustomer] = useState<CustomerUser | null>(() => {
    try {
      const saved = localStorage.getItem('tokio_current_customer_v25');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Entregadores: cadastro real, compartilhado entre os aparelhos (sem entregadores de exemplo)
  const [deliveryStaff, setDeliveryStaff] = useServerDoc<DeliveryPersonnel[]>('deliveryStaff', [], { enabled: docsEnabled, onError: docError });

  // Caixa: turno REAL, compartilhado entre os aparelhos. Começa fechado; alguém precisa abrir o caixa
  // informando o troco inicial (antes existia um turno de exemplo "aberto às 11:30" que não persistia).
  const [cashShift, setCashShift] = useServerDoc<CashRegisterShift>('cashShift', EMPTY_CLOSED_SHIFT, { enabled: docsEnabled, onError: docError });
  const [cashShiftHistory, setCashShiftHistory] = useServerDoc<CashRegisterShift[]>('cashShiftHistory', [], { enabled: docsEnabled, onError: docError });

  // Modern Toast Notification State
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, type: ToastType = 'info', duration: number = 3800) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
      setToasts((prev) => [...prev.slice(-4), { id, message, type, duration }]);

      if (duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }
    },
    [removeToast]
  );

  // Sync to localStorage
  useEffect(() => {
    if (!isStaffMode) return;
    try {
      localStorage.setItem(STORAGE_KEYS.RESTAURANTS, JSON.stringify(restaurants));
    } catch (e) {
      console.warn('Storage error', e);
    }
  }, [restaurants]);

  useEffect(() => {
    if (!isStaffMode) return;
    try {
      localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(categories));
    } catch (e) {
      console.warn('Storage error', e);
    }
  }, [categories]);

  useEffect(() => {
    if (!isStaffMode) return;
    try {
      localStorage.setItem(STORAGE_KEYS.MENU_ITEMS, JSON.stringify(menuItems));
    } catch (e) {
      console.warn('Storage error', e);
    }
  }, [menuItems]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.SOUND_SETTINGS, JSON.stringify(soundSettings));
    } catch (e) {
      console.warn('Storage error', e);
    }
  }, [soundSettings]);

  useEffect(() => {
    try {
      if (currentUser) {
        sessionStorage.setItem('tokio_current_user_v25', JSON.stringify(currentUser));
      } else {
        sessionStorage.removeItem('tokio_current_user_v25');
      }
    } catch (e) {
      console.warn('Session storage error', e);
    }
  }, [currentUser]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.CART, JSON.stringify(cart));
    } catch (e) {
      console.warn('Storage error', e);
    }
  }, [cart]);

  // Realtime Sync Function with ETag & 304 Not Modified bandwidth protection
  const fetchOrdersFromServer = useCallback(async (isInitial = false) => {
    if (!isStaffMode) return;
    try {
      setIsSyncing(true);
      const headers: Record<string, string> = {};
      if (ordersEtagRef.current && !isInitial) {
        headers['If-None-Match'] = ordersEtagRef.current;
      }

      const res = await fetch('/api/orders', { headers });

      // HTTP 304 NOT MODIFIED: Zero bytes transferred, server state matches client
      if (res.status === 304) {
        setLastSyncTime(new Date());
        return;
      }

      if (res.status === 401) {
        // Sessão expirada/revogada: volta para a tela de login do painel
        setCurrentUser(null);
        sessionStorage.removeItem('tokio_staff_token');
        sessionStorage.removeItem('tokio_current_user_v25');
        return;
      }

      if (res.ok) {
        const etag = res.headers.get('ETag');
        if (etag) {
          ordersEtagRef.current = etag;
        }

        const data = await res.json();
        if (data.success && Array.isArray(data.orders)) {
          const serverOrders: Order[] = data.orders;

          // Check for newly arrived orders with status === 'recebido'
          if (!isInitial && soundSettings.enabled) {
            const newlyArrived = serverOrders.filter(
              (o) => o.status === 'recebido' && !alertedOrderIdsRef.current.has(o.id)
            );
            if (newlyArrived.length > 0) {
              console.log(`[ALERT] ${newlyArrived.length} novo(s) pedido(s) detectado(s). Tocando som: ${soundSettings.soundType}`);
              playAlertSound(soundSettings.soundType, soundSettings.volume);
            }
          }

          // Register all received orders into alerted set
          serverOrders.forEach((o) => {
            alertedOrderIdsRef.current.add(o.id);
          });

          setOrders(serverOrders);
          setLastSyncTime(new Date());
        }
      }
    } catch (err) {
      console.warn('[SYNC ERROR] Falha ao sincronizar pedidos com o servidor:', err);
    } finally {
      setIsSyncing(false);
    }
  }, [soundSettings, isStaffMode]);

  // Network Listeners & Adaptive Background Polling (Tab Visibility Aware)
  useEffect(() => {
    // Somente o painel autenticado sincroniza a lista completa de pedidos.
    if (!isStaffMode || !currentUser) return undefined;
    let disposed = false;

    const handleOnline = () => {
      console.log('[NETWORK] Conexão restabelecida. Sincronizando pedidos...');
      setIsOnline(true);
      fetchOrdersFromServer();
    };

    const handleOffline = () => {
      console.warn('[NETWORK] Sem conexão com a internet. Modo offline ativado.');
      setIsOnline(false);
    };

    const handleFocus = () => {
      fetchOrdersFromServer();
      setIsAudioUnlocked(checkAudioUnlocked());
    };

    const handleVisibilityChange = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        // Immediate sync and resume polling when tab becomes active again
        fetchOrdersFromServer();
        if (timerId) clearTimeout(timerId);
        scheduleNextPoll();
      } else {
        // Tab is hidden: pause background requests immediately to save bandwidth
        if (timerId) {
          clearTimeout(timerId);
          timerId = null;
        }
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Initial sync
    fetchOrdersFromServer(true);

    // Dynamic Interval: 7s in foreground (with 304 ETag = 0 bytes), paused completely when tab is hidden
    let timerId: any = null;

    const scheduleNextPoll = () => {
      const isVisible = typeof document !== 'undefined' && document.visibilityState === 'visible';
      // Strict Page Visibility API: pause polling if tab is inactive
      if (!isVisible) {
        return;
      }

      timerId = setTimeout(() => {
        if (typeof navigator !== 'undefined' && navigator.onLine) {
          fetchOrdersFromServer().finally(() => {
            scheduleNextPoll();
          });
        } else {
          scheduleNextPoll();
        }
      }, 7000);
    };

    scheduleNextPoll();

    // =========================================================================
    // REAL-TIME SERVER-SENT EVENTS (SSE) STREAM
    // Garante que Cozinha, SushiBar, Bar, PDV/Garçom e Cliente atualizem instantaneamente
    // =========================================================================
    let eventSource: EventSource | null = null;
    let sseRetryTimer: any = null;

    const setupSSE = async () => {
      if (typeof window === 'undefined' || typeof EventSource === 'undefined') return;

      try {
        if (eventSource) {
          eventSource.close();
        }

        // O stream exige um ticket de uso único emitido a um colaborador autenticado
        const tk = await fetch('/api/orders/stream-ticket', { method: 'POST' });
        if (!tk.ok) throw new Error(`ticket HTTP ${tk.status}`);
        const { ticket } = await tk.json();
        if (disposed) return;

        eventSource = new EventSource(`/api/orders/stream?ticket=${encodeURIComponent(ticket)}`);

        eventSource.onopen = () => {
          setIsOnline(true);
        };

        eventSource.onmessage = (event) => {
          if (!event.data || event.data.startsWith(':')) return; // ignore heartbeat comments
          try {
            const parsed = JSON.parse(event.data);
            if (parsed.event === 'connected') {
              return;
            }
            if (parsed.event === 'state_updated') {
              // Outro aparelho alterou caixa/mesas/CRM/configurações: os documentos se atualizam sozinhos
              window.dispatchEvent(new CustomEvent('nx-state-updated', { detail: parsed }));
              return;
            }

            if (parsed.order && parsed.order.id) {
              const incomingOrder: Order = parsed.order;
              // Alerta sonoro imediato para novo pedido
              if (parsed.event === 'order_created' && soundSettings.enabled && !alertedOrderIdsRef.current.has(incomingOrder.id)) {
                alertedOrderIdsRef.current.add(incomingOrder.id);
                playAlertSound(soundSettings.soundType, soundSettings.volume);
              }

              // Atualização instantânea no estado
              setOrders((prev) => {
                const idx = prev.findIndex((o) => o.id === incomingOrder.id);
                if (idx !== -1) {
                  const copy = [...prev];
                  copy[idx] = incomingOrder;
                  return copy;
                }
                return [incomingOrder, ...prev];
              });
              setLastSyncTime(new Date());
            } else {
              // Evento genérico (delete, clear, reset)
              fetchOrdersFromServer();
            }
          } catch (e) {
            console.warn('[SSE PARSE ERROR]:', e);
          }
        };

        eventSource.onerror = () => {
          if (eventSource) {
            eventSource.close();
            eventSource = null;
          }
          if (sseRetryTimer) clearTimeout(sseRetryTimer);
          sseRetryTimer = setTimeout(() => {
            setupSSE();
          }, 4000);
        };
      } catch (err) {
        console.warn('[SSE INIT ERROR]:', err);
        if (!disposed) {
          if (sseRetryTimer) clearTimeout(sseRetryTimer);
          sseRetryTimer = setTimeout(() => setupSSE(), 8000);
        }
      }
    };

    setupSSE();

    return () => {
      disposed = true;
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (timerId) clearTimeout(timerId);
      if (sseRetryTimer) clearTimeout(sseRetryTimer);
      if (eventSource) eventSource.close();
    };
  }, [fetchOrdersFromServer, isStaffMode, currentUser?.id]);

  // Erros vindos de hooks/documentos compartilhados aparecem como aviso na tela
  useEffect(() => {
    const onToast = (e: Event) => {
      const d = (e as CustomEvent).detail;
      if (d?.message) showToast(d.message, d.type || 'info', 7000);
    };
    window.addEventListener('nx-toast', onToast);
    return () => window.removeEventListener('nx-toast', onToast);
  }, [showToast]);

  // ===========================================================================
  // CATÁLOGO (cardápio/restaurantes/categorias): fonte única no SERVIDOR
  //  - cliente: lê /api/public/catalog (sem custos/fiscal) e guarda só um cache local
  //  - painel: lê /api/catalog e grava alterações com PUT (debounce), então todos os
  //    aparelhos enxergam o mesmo cardápio.
  // ===========================================================================
  const [catalogLoaded, setCatalogLoaded] = useState(false);
  const catalogReadyRef = useRef(false);
  const applyingServerCatalogRef = useRef(false);
  const catalogEtagRef = useRef<string | null>(null);
  const pushTimerRef = useRef<any>(null);
  const pushInFlightRef = useRef(false);

  const loadCatalog = useCallback(async () => {
    try {
      const headers: Record<string, string> = {};
      if (catalogEtagRef.current) headers['If-None-Match'] = catalogEtagRef.current;
      const res = await fetch(isStaffMode ? '/api/catalog' : '/api/public/catalog', { headers });
      if (res.status === 304 || !res.ok) return;
      const data = await res.json();
      if (!data?.success || !data.restaurants || !Array.isArray(data.menuItems)) return;
      // Nunca substitui um catálogo válido por uma resposta pública vazia/incompleta.
      // Isso evita que o cardápio cliente fique sem restaurante após deploy/restart.
      const serverRestaurants = Object.values(data.restaurants as Record<string, RestaurantConfig>);
      if (serverRestaurants.length === 0) {
        console.warn('[CATALOG] /api/public/catalog retornou 0 restaurantes; mantendo catálogo local.');
        setCatalogLoaded(true);
        return;
      }
      catalogEtagRef.current = res.headers.get('ETag');
      applyingServerCatalogRef.current = true;
      setRestaurants(data.restaurants);
      setCategories(data.categories || []);
      setMenuItems(data.menuItems);
      catalogReadyRef.current = true;
      setCatalogLoaded(true);
      if (!isStaffMode) {
        try {
          localStorage.setItem(
            PUBLIC_CATALOG_CACHE_KEY,
            JSON.stringify({ restaurants: data.restaurants, categories: data.categories || [], menuItems: data.menuItems })
          );
        } catch {
          /* cache opcional */
        }
      }
    } catch (e) {
      console.warn('[CATALOG] Falha ao carregar do servidor (usando cache local):', e);
    }
  }, [isStaffMode]);

  useEffect(() => {
    if (isStaffMode && !currentUser) {
      catalogReadyRef.current = false;
      catalogEtagRef.current = null;
      return undefined;
    }
    loadCatalog();
    const id = setInterval(() => {
      const visible = typeof document === 'undefined' || document.visibilityState === 'visible';
      // Não sobrescreve edições do painel que ainda não foram enviadas
      if (visible && !pushTimerRef.current && !pushInFlightRef.current) loadCatalog();
    }, isStaffMode ? 30000 : 60000);
    return () => clearInterval(id);
  }, [isStaffMode, currentUser?.id, loadCatalog]);

  // Painel: envia alterações do cardápio ao servidor
  useEffect(() => {
    if (!isStaffMode || !catalogReadyRef.current) return;
    if (applyingServerCatalogRef.current) {
      applyingServerCatalogRef.current = false; // veio do servidor, não é edição local
      return;
    }
    const role = currentUser?.role;
    if (role !== 'super_admin' && role !== 'administrador') return;

    if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
    pushTimerRef.current = setTimeout(async () => {
      pushInFlightRef.current = true;
      try {
        const res = await fetch('/api/catalog', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ restaurants, categories, menuItems }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) {
          showToast(`Não foi possível salvar o cardápio: ${data.error || `erro ${res.status}`}`, 'error', 7000);
          catalogEtagRef.current = null;
          pushTimerRef.current = null;
          pushInFlightRef.current = false;
          loadCatalog(); // volta ao que está salvo no servidor
          return;
        }
        catalogEtagRef.current = `W/"cat-${data.version}"`;
      } catch {
        showToast('Sem conexão: a alteração do cardápio não foi salva no servidor.', 'error', 7000);
      } finally {
        pushInFlightRef.current = false;
        pushTimerRef.current = null;
      }
    }, 1200);
  }, [restaurants, categories, menuItems]);

  // Se o restaurante ativo deixou de existir no servidor, seleciona o primeiro disponível
  useEffect(() => {
    if (!catalogLoaded) return;
    const keys = Object.keys(restaurants);
    if (keys.length > 0 && !restaurants[activeRestaurantSlug]) {
      setActiveRestaurantSlug(keys[0]);
    }
  }, [catalogLoaded, restaurants]);

  // ===========================================================================
  // CLIENTE: acompanha somente os PRÓPRIOS pedidos em tempo real.
  // Usa SSE autenticado por ticket temporário (somente id + token do próprio
  // pedido) e mantém uma consulta lenta como fallback para redes que não
  // suportam SSE. Assim RECEBIDO -> ACEITO -> PREPARO -> PRONTO -> ENTREGA ->
  // ENTREGUE -> FINALIZADO chega ao cliente sem esperar o próximo ciclo.
  useEffect(() => {
    if (isStaffMode) return undefined;
    let stopped = false;
    let pollTimer: any = null;
    let ticketTimer: any = null;
    let customerEventSource: EventSource | null = null;

    const syncMyOrders = async () => {
      const mine = readMyOrders();
      if (mine.length === 0) return;
      try {
        const res = await fetch('/api/public/orders/lookup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: mine }),
        });
        if (!res.ok || stopped) return;
        const data = await res.json();
        if (Array.isArray(data.orders)) {
          setOrders((prev) => {
            const map = new Map<string, Order>(prev.map((o): [string, Order] => [o.id, o]));
            data.orders.forEach((o: Order) => map.set(o.id, o));
            return Array.from(map.values()).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          });
          setLastSyncTime(new Date());
        }
      } catch {
        /* fallback silencioso */
      }
    };

    const openCustomerStream = async () => {
      if (stopped || typeof EventSource === 'undefined') return;
      const mine = readMyOrders();
      if (mine.length === 0) return;

      try {
        if (customerEventSource) customerEventSource.close();
        const ticketRes = await fetch('/api/public/orders/stream-ticket', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: mine }),
        });
        if (!ticketRes.ok || stopped) return;
        const { ticket } = await ticketRes.json();
        if (!ticket || stopped) return;

        customerEventSource = new EventSource(`/api/public/orders/stream?ticket=${encodeURIComponent(ticket)}`);
        customerEventSource.onopen = () => setIsOnline(true);
        customerEventSource.onmessage = (event) => {
          if (!event.data || event.data.startsWith(':')) return;
          try {
            const parsed = JSON.parse(event.data);
            if (parsed.event === 'connected') return;
            if (parsed.order?.id) {
              const incoming = parsed.order as Order;
              setOrders((prev) => {
                const idx = prev.findIndex((o) => o.id === incoming.id);
                if (idx < 0) return [incoming, ...prev];
                const next = [...prev];
                next[idx] = incoming;
                return next;
              });
              setLastSyncTime(new Date());
              window.dispatchEvent(new CustomEvent('nx-my-order-updated', { detail: incoming }));
            }
          } catch {
            /* ignora evento inválido */
          }
        };
        customerEventSource.onerror = () => {
          if (customerEventSource) {
            customerEventSource.close();
            customerEventSource = null;
          }
        };
      } catch {
        /* polling continua ativo */
      }
    };

    const schedulePoll = () => {
      if (pollTimer) clearTimeout(pollTimer);
      if (stopped) return;
      pollTimer = setTimeout(async () => {
        await syncMyOrders();
        schedulePoll();
      }, 20000);
    };

    const refresh = () => {
      if (document.visibilityState === 'visible') {
        syncMyOrders();
        openCustomerStream();
      }
    };

    const restartStream = () => {
      if (ticketTimer) clearTimeout(ticketTimer);
      ticketTimer = setTimeout(() => {
        openCustomerStream();
        restartStream();
      }, 45_000);
    };

    refresh();
    schedulePoll();
    restartStream();
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('nx-my-orders-changed', refresh);

    return () => {
      stopped = true;
      if (pollTimer) clearTimeout(pollTimer);
      if (ticketTimer) clearTimeout(ticketTimer);
      if (customerEventSource) customerEventSource.close();
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('nx-my-orders-changed', refresh);
    };
  }, [isStaffMode]);

  // ===========================================================================
  // PAINEL: revalida no servidor a sessão restaurada do navegador
  // ===========================================================================
  useEffect(() => {
    if (!isStaffMode) return;
    const token = sessionStorage.getItem('tokio_staff_token');
    if (!currentUser || !token) return;
    let cancelled = false;
    fetch('/api/auth/me')
      .then(async (res) => {
        if (cancelled) return;
        if (!res.ok) {
          setCurrentUser(null);
          sessionStorage.removeItem('tokio_staff_token');
          sessionStorage.removeItem('tokio_current_user_v25');
          return;
        }
        const data = await res.json();
        if (data?.user) setCurrentUser((prev) => (prev ? { ...prev, ...data.user, token } : prev));
      })
      .catch(() => {
        /* offline: mantém sessão local até a próxima chamada autenticada */
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStaffMode]);

  // CRM: mantém a base de clientes da equipe em dia a partir dos pedidos reais
  useEffect(() => {
    if (!docsEnabled || orders.length === 0) return;
    setCustomers((prev) => mergeCrmFromOrders(prev, orders));
  }, [orders, docsEnabled]);

  // Ao sair do painel, nenhum pedido/dado fica em memória
  useEffect(() => {
    if (isStaffMode && !currentUser) setOrders([]);
  }, [isStaffMode, currentUser?.id]);

  // Repeating Sound Alert for Pending Orders
  useEffect(() => {
    if (!isStaffMode || !currentUser) return;
    if (!soundSettings.enabled || !soundSettings.repeatUntilAcknowledged) return;

    const repeatInterval = setInterval(() => {
      const hasUnacknowledged = orders.some((o) => o.status === 'recebido');
      if (hasUnacknowledged) {
        console.log('[ALERT REPEAT] Alerta sonoro repetido para pedido pendente na cozinha');
        playAlertSound(soundSettings.soundType, soundSettings.volume);
      }
    }, 25000);

    return () => clearInterval(repeatInterval);
  }, [soundSettings, orders]);

  // Repeating Delay Alert for Overdue Orders
  useEffect(() => {
    if (!isStaffMode || !currentUser) return;
    if (!delaySettings.enabled || !soundSettings.enabled || soundSettings.alertOnDelay === false) return;

    const intervalMs = Math.max(1, delaySettings.repeatIntervalMinutes || 3) * 60 * 1000;
    const delayTimer = setInterval(() => {
      const now = Date.now();
      const thresholdMs = Math.max(5, delaySettings.thresholdMinutes || 15) * 60 * 1000;

      const overdueOrders = orders.filter((o) => {
        if (o.status !== 'recebido' && o.status !== 'em_preparo') return false;
        if (delaySettings.silencedOrderIds.includes(o.id)) return false;
        const createdTime = new Date(o.createdAt).getTime();
        return now - createdTime >= thresholdMs;
      });

      if (overdueOrders.length > 0) {
        console.warn(`[DELAY ALARM] ${overdueOrders.length} pedido(s) em atraso!`);
        if (soundSettings.alertOnPanel !== false) {
          playDelayAlertSound(soundSettings.volume);
        }
        if (soundSettings.vibrationEnabled) {
          triggerVibrate([300, 100, 300, 100, 400]);
        }
      }
    }, intervalMs);

    return () => clearInterval(delayTimer);
  }, [delaySettings, soundSettings, orders]);

  // Audio & Sound controls
  const updateSoundSettings = (updates: Partial<SoundSettings>) => {
    setSoundSettings((prev) => ({ ...prev, ...updates }));
  };

  const updateDelaySettings = (updates: Partial<DelayAlertSettings>) => {
    setDelaySettings((prev) => ({ ...prev, ...updates }));
    logAction('Configurações de alerta de atraso atualizadas', 'alert', JSON.stringify(updates));
  };

  const silenceOrderDelay = (orderId: string) => {
    setDelaySettings((prev) => {
      if (prev.silencedOrderIds.includes(orderId)) return prev;
      return {
        ...prev,
        silencedOrderIds: [...prev.silencedOrderIds, orderId],
      };
    });
    const ord = orders.find((o) => o.id === orderId);
    logAction(`Silenciou alarme de atraso para o pedido ${ord?.shortCode || orderId}`, 'alert');
  };

  const testSound = (type?: OrderSoundType) => {
    unlockAudio();
    setIsAudioUnlocked(true);
    playAlertSound(type || soundSettings.soundType, soundSettings.volume);
  };

  const unlockAudioContext = () => {
    const success = unlockAudio();
    setIsAudioUnlocked(success);
  };

  const syncOrdersNow = async () => {
    if (getSimulatedOffline() || (typeof navigator !== 'undefined' && !navigator.onLine)) {
      console.log('[SYNC CANCELLED] Dispositivo em modo offline.');
      return;
    }

    const queue = getOfflineQueue();
    if (queue.length > 0) {
      console.log(`[SYNC QUEUE] Sincronizando ${queue.length} operação(ões) offline com o servidor...`);
      for (const op of queue) {
        try {
          if (op.type === 'CREATE_ORDER') {
            const syncRes = await fetch('/api/orders', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(op.payload),
            });
            if (syncRes.ok) {
              const synced = await syncRes.json().catch(() => null);
              if (synced?.order && !isStaffMode) rememberMyOrders([synced.order]);
              removeOfflineOperation(op.id);
            } else if (syncRes.status >= 400 && syncRes.status < 500 && syncRes.status !== 401 && syncRes.status !== 429) {
              removeOfflineOperation(op.id); // pedido inválido: não adianta reenviar
            }
          } else if (op.type === 'APPEND_TABLE_ITEMS') {
            await fetch('/api/orders/table/append', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(op.payload),
            });
            removeOfflineOperation(op.id);
          } else if (op.type === 'CLOSE_TABLE') {
            await fetch(`/api/orders/${op.payload.orderId}/close-table`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(op.payload),
            });
            removeOfflineOperation(op.id);
          } else if (op.type === 'UPDATE_STATUS') {
            await fetch(`/api/orders/${op.payload.orderId}/status`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(op.payload),
            });
            removeOfflineOperation(op.id);
          }
        } catch (e) {
          console.warn(`[SYNC FAIL] Falha ao processar operação ${op.type} (${op.id}):`, e);
        }
      }
    }
    await fetchOrdersFromServer();
  };

  // User Authentication & Permissions
  const loginUser = async (username: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Credenciais inválidas' };
      }
      const userWithToken: UserAccount = {
        ...data.user,
        token: data.token,
      };
      setCurrentUser(userWithToken);
      if (userWithToken.restaurantSlug && userWithToken.restaurantSlug !== 'all') {
        setActiveRestaurantSlug(userWithToken.restaurantSlug as RestaurantSlug);
      }
      sessionStorage.setItem('tokio_current_user_v25', JSON.stringify(userWithToken));
      sessionStorage.setItem('tokio_admin_auth', 'true');
      if (data.token) {
        sessionStorage.setItem('tokio_staff_token', data.token);
      }
      return { success: true };
    } catch (e: any) {
      return { success: false, error: 'Erro de conexão com o servidor' };
    }
  };

  const logoutUser = () => {
    if (currentUser) {
      logAction(`Logout do usuário @${currentUser.username}`, 'user');
      const token = currentUser.token || sessionStorage.getItem('tokio_staff_token');
      if (token) {
        fetch('/api/auth/staff-logout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        }).catch(() => {});
      }
    }
    setCurrentUser(null);
    setActiveRestaurantSlug('japones');
    sessionStorage.setItem('tokio_current_user_v25', 'logged_out');
    sessionStorage.removeItem('tokio_admin_auth');
    sessionStorage.removeItem('tokio_staff_token');
  };

  const checkPermission = (permKey: keyof UserPermissions): boolean => {
    if (!currentUser) return false;
    if (currentUser.role === 'super_admin') return true;
    return Boolean(currentUser.permissions?.[permKey]);
  };

  // Connected Devices Management
  const refreshDevices = useCallback(async () => {
    try {
      const res = await fetch('/api/devices');
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.devices)) {
          setConnectedDevices(data.devices);
        }
      }
    } catch (e) {
      console.warn('Could not load devices:', e);
    }
  }, []);

  // Audit Logs Management
  const refreshAuditLogs = useCallback(async () => {
    try {
      const res = await fetch('/api/audit-logs');
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.logs)) {
          setAuditLogs(data.logs);
        }
      }
    } catch (e) {
      console.warn('Could not load audit logs:', e);
    }
  }, []);

  const logAction = async (
    action: string,
    category: 'order' | 'user' | 'alert' | 'device' | 'system' = 'system',
    details?: string
  ) => {
    if (!isStaffMode || !currentUser) return;
    try {
      await fetch('/api/audit-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userName: currentUser?.name || 'Administrador',
          userRole: currentUser?.role || 'staff',
          action,
          details,
          category,
        }),
      });
      refreshAuditLogs();
    } catch {}
  };

  useEffect(() => {
    if (!isStaffMode || !currentUser) return;
    refreshDevices();
    refreshAuditLogs();
  }, [refreshDevices, refreshAuditLogs, isStaffMode, currentUser?.id]);

  // Cart operations
  const addToCart = (
    item: MenuItem,
    quantity: number,
    selectedOptions: CartItemOptionSelected[],
    notes?: string
  ) => {
    // Multi-restaurant cart: Items from different restaurants coexist seamlessly and are grouped visually
    const optionsPrice = selectedOptions.reduce((acc, opt) => acc + opt.price, 0);
    const effectiveBasePrice = item.promoPrice ?? item.price;
    const unitTotalPrice = effectiveBasePrice + optionsPrice;
    const subtotal = unitTotalPrice * quantity;

    const cartItemId = `${item.id}-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;

    const newCartItem: CartItem = {
      id: cartItemId,
      menuItem: item,
      quantity,
      selectedOptions,
      notes,
      unitTotalPrice,
      subtotal,
    };

    setCart((prev) => [...prev, newCartItem]);
    setIsCartOpen(true);
  };

  const updateCartItemQuantity = (cartItemId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.id === cartItemId) {
            const newQty = item.quantity + delta;
            if (newQty <= 0) return null;
            return {
              ...item,
              quantity: newQty,
              subtotal: item.unitTotalPrice * newQty,
            };
          }
          return item;
        })
        .filter((item): item is CartItem => item !== null)
    );
  };

  const removeFromCart = (cartItemId: string) => {
    setCart((prev) => prev.filter((item) => item.id !== cartItemId));
  };

  const clearCart = () => {
    setCart([]);
    setAppliedCoupon(null);
  };

  const applyCoupon = (code: string): { success: boolean; message: string } => {
    const cleanCode = code.trim().toUpperCase();
    const found = VALID_COUPONS.find((c) => c.code === cleanCode);
    if (!found) {
      return { success: false, message: 'Cupom inválido ou expirado.' };
    }

    const currentSubtotal = cart.reduce((acc, item) => acc + item.subtotal, 0);
    if (found.minSubtotal && currentSubtotal < found.minSubtotal) {
      return {
        success: false,
        message: `Este cupom exige pedido mínimo de R$ ${found.minSubtotal.toFixed(2)}.`,
      };
    }

    setAppliedCoupon(found);
    return {
      success: true,
      message:
        found.type === 'percent'
          ? `Cupom aplicado com sucesso! ${found.value}% de desconto.`
          : `Cupom aplicado com sucesso! R$ ${found.value.toFixed(2)} de desconto.`,
    };
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
  };

  // Order creation (Transactional with Idempotency Key & Server-Side Persistence)
  const createOrder = async (
    orderData: {
      customerName: string;
      customerPhone: string;
      orderType: OrderType;
      tableNumber?: number;
      pickupNumber?: number;
      deliveryAddress?: {
        street: string;
        number: string;
        neighborhood: string;
        city: string;
        complement?: string;
      };
      paymentMethod: PaymentMethod;
      paymentDetails?: {
        cashChangeFor?: number;
        cardBrand?: string;
        pixCode?: string;
        paid: boolean;
      };
      notes?: string;
    },
    idempotencyKey?: string
  ): Promise<Order> => {
    const restaurant = restaurants[activeRestaurantSlug] || INITIAL_RESTAURANTS.japones;
    const finalKey =
      idempotencyKey || `order-idem-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    const itemsPayload = cart.map((c) => ({
      id: c.id,
      menuItemId: c.menuItem.id, // o servidor recalcula o preço a partir do cardápio dele
      name: c.menuItem.name,
      quantity: c.quantity,
      unitPrice: c.menuItem.promoPrice ?? c.menuItem.price,
      totalPrice: c.subtotal,
      selectedOptions: c.selectedOptions,
      notes: c.notes,
      // BUG CORRIGIDO: no fallback OFFLINE abaixo, todo item caía sempre em
      // 'cozinha' (station: item.station || 'cozinha') porque este payload
      // nunca carregava a estação do item do cardápio — um prato de sushibar
      // ou bar pedido sem internet seria roteado para a tela errada até
      // sincronizar. Quando online, o servidor já resolve isso corretamente
      // via resolveItemStation(); isto só afeta o fallback local.
      station: c.menuItem.station,
    }));

    const payload = {
      restaurantSlug: activeRestaurantSlug,
      restaurantName: restaurant.name,
      customerName: orderData.customerName,
      customerPhone: orderData.customerPhone,
      orderType: orderData.orderType,
      tableNumber: orderData.tableNumber,
      pickupNumber: orderData.pickupNumber,
      deliveryAddress: orderData.deliveryAddress,
      items: itemsPayload,
      paymentMethod: orderData.paymentMethod,
      paymentDetails: orderData.paymentDetails,
      notes: orderData.notes,
      couponCode: appliedCoupon?.code,
      idempotencyKey: finalKey,
    };

    console.log(`[ORDER DISPATCH] Enviando pedido com chave: ${finalKey}`);

    let confirmedOrder: Order;
    const isOfflineMode = getSimulatedOffline() || (typeof navigator !== 'undefined' && !navigator.onLine);

    if (isOfflineMode) {
      // Offline-First execution: enqueue operation and generate local order
      enqueueOfflineOperation('CREATE_ORDER', payload, finalKey);
      const subtotalCalc = itemsPayload.reduce((acc, i) => acc + i.totalPrice, 0);
      const deliveryFeeCalc = orderData.orderType === 'delivery' ? (restaurant.deliveryFee || 7.0) : 0;
      const totalCalc = Math.max(0, subtotalCalc + deliveryFeeCalc - (appliedCoupon?.value || 0));

      confirmedOrder = {
        id: `off-ord-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        shortCode: `#OFF-${Math.floor(100 + Math.random() * 900)}`,
        restaurantSlug: activeRestaurantSlug,
        restaurantName: restaurant.name,
        customerName: orderData.customerName,
        customerPhone: orderData.customerPhone,
        orderType: orderData.orderType,
        tableNumber: orderData.tableNumber,
        pickupNumber: orderData.pickupNumber,
        deliveryAddress: orderData.deliveryAddress,
        items: itemsPayload.map((item, idx) => ({
          ...item,
          id: item.id || `item-off-${idx}-${Date.now()}`,
          station: item.station || 'cozinha',
          stationStatus: 'recebido',
        })),
        subtotal: subtotalCalc,
        deliveryFee: deliveryFeeCalc,
        discount: appliedCoupon?.value || 0,
        couponCode: appliedCoupon?.code,
        total: totalCalc,
        paymentMethod: orderData.paymentMethod,
        paymentDetails: orderData.paymentDetails,
        notes: orderData.notes,
        status: 'recebido',
        statusHistory: [{ status: 'recebido', timestamp: 'Agora mesmo', note: 'Registrado localmente no PDV Offline' }],
        printStatus: 'pendente',
        idempotencyKey: finalKey,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      showToast(`Pedido #${confirmedOrder.shortCode} salvo localmente no PDV! (Modo Offline)`, 'info');
    } else {
      try {
        const response = await fetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const errJson = await response.json().catch(() => ({}));
          throw new Error(errJson.error || `Erro HTTP ${response.status} ao salvar pedido no servidor`);
        }

        const resData = await response.json();
        confirmedOrder = resData.order;
        rememberMyOrders([confirmedOrder]);
      } catch (networkErr: any) {
        console.warn('[OFFLINE FALLBACK] Falha na rede, enfileirando operação localmente:', networkErr);
        enqueueOfflineOperation('CREATE_ORDER', payload, finalKey);
        const subtotalCalc = itemsPayload.reduce((acc, i) => acc + i.totalPrice, 0);
        const deliveryFeeCalc = orderData.orderType === 'delivery' ? (restaurant.deliveryFee || 7.0) : 0;
        const totalCalc = Math.max(0, subtotalCalc + deliveryFeeCalc - (appliedCoupon?.value || 0));

        confirmedOrder = {
          id: `off-ord-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          shortCode: `#OFF-${Math.floor(100 + Math.random() * 900)}`,
          restaurantSlug: activeRestaurantSlug,
          restaurantName: restaurant.name,
          customerName: orderData.customerName,
          customerPhone: orderData.customerPhone,
          orderType: orderData.orderType,
          tableNumber: orderData.tableNumber,
          pickupNumber: orderData.pickupNumber,
          deliveryAddress: orderData.deliveryAddress,
          items: itemsPayload.map((item, idx) => ({
            ...item,
            id: item.id || `item-off-${idx}-${Date.now()}`,
            station: item.station || 'cozinha',
            stationStatus: 'recebido',
          })),
          subtotal: subtotalCalc,
          deliveryFee: deliveryFeeCalc,
          discount: appliedCoupon?.value || 0,
          couponCode: appliedCoupon?.code,
          total: totalCalc,
          paymentMethod: orderData.paymentMethod,
          paymentDetails: orderData.paymentDetails,
          notes: orderData.notes,
          status: 'recebido',
          statusHistory: [{ status: 'recebido', timestamp: 'Agora mesmo', note: 'Salvo em modo de contingência offline' }],
          printStatus: 'pendente',
          idempotencyKey: finalKey,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        showToast(`Conexão instável: Pedido #${confirmedOrder.shortCode} salvo offline na fila!`, 'info');
      }
    }

    // Server has confirmed and saved the order
    alertedOrderIdsRef.current.add(confirmedOrder.id);
    setOrders((prev) => {
      const filtered = prev.filter((o) => o.id !== confirmedOrder.id);
      return [confirmedOrder, ...filtered];
    });

    setTrackingOrderId(confirmedOrder.id);
    clearCart();

    // Auto-sync customer to Customers database (CRM local: somente no painel)
    const nowIso = new Date().toISOString();


    return confirmedOrder;
  };

  const createQuickTestOrder = async (orderTypeToCreate: 'delivery' | 'mesa' | 'balcao' = 'balcao'): Promise<Order | void> => {
    try {
      const sampleNames = ['Mariana Silva', 'Lucas Ferreira', 'Carlos Andrade', 'Juliana Mendes', 'Beatriz Lima'];
      const randomName = sampleNames[Math.floor(Math.random() * sampleNames.length)];
      const randomPickup = Math.floor(Math.random() * 80) + 10;
      const randomTable = Math.floor(Math.random() * 12) + 1;

      const restSlug = activeRestaurantSlug || 'japones';
      const restName = restaurants[restSlug]?.name || 'Sakura Sushi House';

      const payload = {
        restaurantSlug: restSlug,
        restaurantName: restName,
        customerName: orderTypeToCreate === 'balcao' ? `Retirada #${randomPickup}` : randomName,
        customerPhone: '(11) 99882-1234',
        orderType: orderTypeToCreate,
        tableNumber: orderTypeToCreate === 'mesa' ? randomTable : undefined,
        pickupNumber: orderTypeToCreate === 'balcao' ? randomPickup : undefined,
        deliveryAddress: orderTypeToCreate === 'delivery' ? {
          street: 'Av. Paulista',
          number: '1000',
          neighborhood: 'Bela Vista',
          city: 'São Paulo',
          complement: 'Apto 102',
        } : undefined,
        items: [
          {
            id: `test-item-${Date.now()}-1`,
            name: 'Combinado Degustação Chef (16 Peças)',
            quantity: 1,
            unitPrice: 59.9,
            totalPrice: 59.9,
          },
          {
            id: `test-item-${Date.now()}-2`,
            name: 'Bebida Artesanal Gelada 350ml',
            quantity: 1,
            unitPrice: 9.5,
            totalPrice: 9.5,
          }
        ],
        subtotal: 69.4,
        deliveryFee: orderTypeToCreate === 'delivery' ? 7.0 : 0,
        discount: 0,
        total: orderTypeToCreate === 'delivery' ? 76.4 : 69.4,
        paymentMethod: 'pix',
        paymentDetails: { paid: true },
        notes: `Pedido Teste Instantâneo (${orderTypeToCreate.toUpperCase()})`,
        idempotencyKey: `quick-test-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      };

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success && data.order) {
        // Trigger sound if active
        if (soundSettings.enabled) {
          playAlertSound(soundSettings.soundType, soundSettings.volume);
        }
        await fetchOrdersFromServer();
        const shortCode = data.order.shortCode || '#TEST';
        const typeLabel = orderTypeToCreate === 'mesa' ? `Mesa ${randomTable}` : orderTypeToCreate === 'balcao' ? `Senha #${randomPickup}` : 'Delivery';
        showToast(`Novo pedido teste gerado: ${shortCode} (${typeLabel})`, 'success');
        return data.order;
      }
    } catch (e: any) {
      console.error('Falha ao gerar pedido de teste:', e);
      showToast('Erro ao gerar pedido teste', 'error');
    }
  };

  const updateOrderItem = async (params: { orderId: string; itemId: string; quantity: number; selectedOptions?: any[]; notes?: string }) => {
    try {
      const token = currentUser?.token || sessionStorage.getItem('tokio_staff_token');
      const res = await fetch(`/api/orders/${params.orderId}/items/${params.itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ ...params, idempotencyKey: `edit-${params.orderId}-${params.itemId}-${params.quantity}-${JSON.stringify(params.selectedOptions || [])}-${params.notes || ''}` }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Erro ao editar item do pedido');
      if (data.order) setOrders((prev) => prev.map((o) => (o.id === data.order.id ? data.order : o)));
      return data;
    } catch (error: any) {
      showToast(error.message || 'Erro ao editar item', 'error');
      return { success: false, error: error.message };
    }
  };

  const updateOrderStatus = async (orderId: string, status: OrderStatus, note?: string): Promise<void> => {
    // 1. Optimistic update
    setOrders((prev) =>
      prev.map((order) => {
        if (order.id === orderId) {
          const defaultNotes: Record<OrderStatus, string> = {
            recebido: 'Pedido registrado no sistema',
            aceito: 'Pedido confirmado e aceito pelo restaurante',
            em_producao: 'Pedido em produção nas praças',
            em_preparo: 'Iniciado preparo na cozinha',
            parcialmente_pronto: 'Parte dos itens pronta para montagem',
            pronto: 'Pronto e embalado com sucesso na expedição',
            saiu_para_entrega: 'Saiu para entrega com entregador',
            entregue: 'Pedido entregue e concluído com sucesso',
            finalizado: 'Pedido finalizado',
            cancelado: 'Pedido cancelado',
          };

          const newHistory = [
            ...order.statusHistory,
            {
              status,
              timestamp: 'Agora mesmo',
              note: note || defaultNotes[status],
            },
          ];

          return {
            ...order,
            status,
            statusHistory: newHistory,
            updatedAt: new Date().toISOString(),
          };
        }
        return order;
      })
    );

    // 2. Persist to server
    try {
      const token = currentUser?.token || sessionStorage.getItem('tokio_staff_token');
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          status,
          note,
          operatorName: currentUser?.name || 'Operador',
          operatorRole: currentUser?.role || 'admin',
        }),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        console.error('[STATUS ERROR] Falha ao atualizar status no servidor:', errJson.error);
        fetchOrdersFromServer();
      } else {
        const data = await res.json();
        if (data.order) {
          setOrders((prev) => prev.map((o) => (o.id === data.order.id ? data.order : o)));
        }
      }
    } catch (err) {
      console.warn('[OFFLINE] Status alterado offline, sincronizará ao reconectar:', err);
    }
  };

  const updateStationStatus = async (
    orderId: string,
    station: ProductionStation,
    status: StationItemStatus,
    operatorName?: string
  ): Promise<void> => {
    try {
      const opName = operatorName || currentUser?.name || `Operador ${station.toUpperCase()}`;
      const opRole = currentUser?.role || station;
      const token = currentUser?.token || sessionStorage.getItem('tokio_staff_token');

      const res = await fetch(`/api/orders/${orderId}/station-status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          station,
          status,
          operatorName: opName,
          operatorRole: opRole,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Falha ao atualizar praça');
      }

      const data = await res.json();
      if (data.success && data.order) {
        setOrders((prev) => prev.map((o) => (o.id === data.order.id ? data.order : o)));
        showToast(
          `Praça [${station.toUpperCase()}] atualizada para ${status.replace('_', ' ').toUpperCase()}`,
          'success'
        );
      }
    } catch (err: any) {
      console.error('[STATION ERROR]:', err);
      showToast(err.message || 'Erro ao comunicar com praça', 'error');
    }
  };

  const appendItemsToTableOrder = async (params: {
    tableNumber: number;
    restaurantSlug?: RestaurantSlug;
    restaurantName?: string;
    items: Array<{
      id?: string;
      name: string;
      quantity: number;
      unitPrice: number;
      selectedOptions?: any[];
      notes?: string;
      station?: ProductionStation;
    }>;
    customerName?: string;
    customerPhone?: string;
    waiterName?: string;
    tableSessionId?: string;
    tableAccessToken?: string;
    idempotencyKey?: string;
  }): Promise<{ success: boolean; order?: Order; isNew?: boolean; error?: string }> => {
    try {
      const restSlug = params.restaurantSlug || activeRestaurantSlug || 'japones';
      const restName = params.restaurantName || restaurants[restSlug]?.name || 'Restaurante';
      const token = currentUser?.token || sessionStorage.getItem('tokio_staff_token');

      const res = await fetch('/api/orders/table/append', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          ...params,
          restaurantSlug: restSlug,
          restaurantName: restName,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Erro ao sincronizar mesa');
      }

      // Update in state
      if (data.order) {
        if (!isStaffMode) rememberMyOrders([data.order]);
        setOrders((prev) => {
          const filtered = prev.filter((o) => o.id !== data.order.id);
          return [data.order, ...filtered];
        });
      }

      showToast(
        data.isNew
          ? `Mesa ${params.tableNumber} aberta com sucesso!`
          : `+${params.items.length} item(s) adicionados à Mesa ${params.tableNumber}!`,
        'success'
      );

      return { success: true, order: data.order, isNew: data.isNew };
    } catch (err: any) {
      console.error('[TABLE SYNC ERROR]:', err);
      showToast(err.message || 'Falha ao sincronizar itens da mesa', 'error');
      return { success: false, error: err.message };
    }
  };

  const closeTableOrder = async (params: {
    orderId: string;
    tableNumber: number;
    paymentMethod: string;
    discount?: number;
    serviceFee?: number;
    total?: number;
    splitCount?: number;
    operatorName?: string;
    waiterNotes?: string;
  }): Promise<{ success: boolean; order?: Order; error?: string }> => {
    try {
      const token = currentUser?.token || sessionStorage.getItem('tokio_staff_token');
      const res = await fetch(`/api/orders/${params.orderId}/close-table`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          ...params,
          operatorName: params.operatorName || currentUser?.name || 'Garçom',
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Erro ao fechar conta da mesa');
      }

      if (data.order) {
        setOrders((prev) => prev.map((o) => (o.id === data.order.id ? data.order : o)));
      }

      showToast(`Mesa ${params.tableNumber} fechada e liberada com sucesso!`, 'success');
      return { success: true, order: data.order };
    } catch (err: any) {
      console.error('[CLOSE TABLE ERROR]:', err);
      showToast(err.message || 'Falha ao fechar conta da mesa', 'error');
      return { success: false, error: err.message };
    }
  };

  const updateOrderPrintStatus = async (
    orderId: string,
    printStatus: 'pendente' | 'imprimindo' | 'impresso'
  ): Promise<void> => {
    setOrders((prev) =>
      prev.map((order) => (order.id === orderId ? { ...order, printStatus } : order))
    );

    try {
      await fetch(`/api/orders/${orderId}/print`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ printStatus }),
      });
    } catch (err) {
      console.warn('Erro ao atualizar status de impressão no servidor:', err);
    }
  };

  const deleteOrder = async (orderId: string): Promise<void> => {
    setOrders((prev) => prev.filter((order) => order.id !== orderId));
    try {
      const token = currentUser?.token || sessionStorage.getItem('tokio_staff_token');
      await fetch(`/api/orders/${orderId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
    } catch (err) {
      console.warn('Erro ao deletar pedido no servidor:', err);
    }
  };

  const clearOrdersHistory = async (
    slug?: RestaurantSlug,
    mode: 'finished' | 'all' = 'finished'
  ): Promise<void> => {
    setOrders((prev) =>
      prev.filter((order) => {
        if (mode === 'all') {
          if (slug) return order.restaurantSlug !== slug;
          return false;
        }
        const isFinished = order.status === 'entregue' || order.status === 'cancelado';
        if (!isFinished) return true;
        if (slug) return order.restaurantSlug !== slug;
        return false;
      })
    );

    try {
      const token = currentUser?.token || sessionStorage.getItem('tokio_staff_token');
      await fetch('/api/orders/clear-history', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ slug, mode }),
      });
    } catch (err) {
      console.warn('Erro ao limpar histórico no servidor:', err);
    }
  };

  const clearAllOrders = () => {
    setOrders([]);
    clearOrdersHistory(undefined, 'all');
  };

  // Customers Management (Separated from Orders History)
  const clearCustomersData = () => {
    setCustomers([]);
  };

  const deleteCustomer = (customerId: string) => {
    setCustomers((prev) => prev.filter((c) => c.id !== customerId));
  };

  const addCustomer = (customerData: Omit<CustomerRecord, 'id' | 'createdAt'>) => {
    const newCust: CustomerRecord = {
      ...customerData,
      id: `cust-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    setCustomers((prev) => [newCust, ...prev]);
  };

  const updateCustomerNotes = (customerId: string, notes: string) => {
    setCustomers((prev) =>
      prev.map((c) => (c.id === customerId ? { ...c, notes } : c))
    );
  };

  const updatePrinterSettings = (updates: Partial<PrinterSettings>) => {
    setPrinterSettings((prev) => ({ ...prev, ...updates }));
  };

  // Menu Management
  const updateMenuItem = (updatedItem: MenuItem) => {
    setMenuItems((prev) => prev.map((item) => (item.id === updatedItem.id ? updatedItem : item)));
  };

  const addMenuItem = (itemData: Omit<MenuItem, 'id'>) => {
    const newItem: MenuItem = {
      ...itemData,
      id: `item-${Date.now()}`,
    };
    setMenuItems((prev) => [...prev, newItem]);
  };

  const deleteMenuItem = (itemId: string) => {
    setMenuItems((prev) => prev.filter((item) => item.id !== itemId));
  };

  const updateRestaurantConfig = (slug: RestaurantSlug, updates: Partial<RestaurantConfig>) => {
    setRestaurants((prev) => ({
      ...prev,
      [slug]: {
        ...prev[slug],
        ...updates,
      },
    }));
  };

  const addRestaurant = (newConfig: RestaurantConfig) => {
    setRestaurants((prev) => ({
      ...prev,
      [newConfig.slug]: newConfig,
    }));
  };

  const deleteRestaurant = (slug: RestaurantSlug) => {
    setRestaurants((prev) => {
      const next = { ...prev };
      delete next[slug];
      return next;
    });
  };

  // Vitrine Manager
  const updateVitrineConfig = (slug: string, updates: Partial<RestaurantConfig>) => {
    setRestaurants((prev) => {
      if (!prev[slug]) return prev;
      return {
        ...prev,
        [slug]: {
          ...prev[slug],
          ...updates,
        },
      };
    });
  };

  // Reset Mestre de Pedidos (Super Admin)
  const masterResetOrders = async (confirmation: string): Promise<{ success: boolean; count: number; message: string }> => {
    if (confirmation !== 'RESETAR PEDIDOS') {
      throw new Error('Confirmação inválida. Digite exatamente "RESETAR PEDIDOS".');
    }
    const token = currentUser?.token || sessionStorage.getItem('tokio_staff_token');
    const res = await fetch('/api/orders/master-reset', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        confirmation,
        operatorName: currentUser?.name || 'Super Admin',
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Falha ao executar Reset Mestre no servidor.');
    }
    setOrders([]);
    alertedOrderIdsRef.current.clear();
    logAction(`[RESET MESTRE] Apagou permanentemente todos os ${data.count} pedidos`, 'order');
    return { success: true, count: data.count, message: data.message };
  };

  // Multi-restaurant batch order creator
  const createBatchOrders = async (
    orderData: {
      customerName: string;
      customerPhone: string;
      orderType: OrderType;
      tableNumber?: number;
      deliveryAddress?: {
        street: string;
        number: string;
        neighborhood: string;
        city: string;
        complement?: string;
      };
      paymentMethod: PaymentMethod;
      paymentDetails?: {
        cashChangeFor?: number;
        cardBrand?: string;
        pixCode?: string;
        paid: boolean;
      };
      notes?: string;
    },
    baseIdempotencyKey?: string
  ): Promise<Order[]> => {
    // Group cart items by restaurant slug
    const itemsByRest = cart.reduce((acc, cartItem) => {
      const slug = cartItem.menuItem.restaurantSlug;
      if (!acc[slug]) acc[slug] = [];
      acc[slug].push(cartItem);
      return acc;
    }, {} as Record<string, CartItem[]>);

    const baseKey = baseIdempotencyKey || `batch-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const payloads = (Object.entries(itemsByRest) as [string, CartItem[]][]).map(([slug, items]) => {
      const restConfig = restaurants[slug] || INITIAL_RESTAURANTS[slug] || INITIAL_RESTAURANTS.japones;
      const getCartItemPrice = (c: CartItem) => {
        const optionsTotal = c.selectedOptions?.reduce((sum, opt) => sum + opt.price, 0) || 0;
        return (c.menuItem.price + optionsTotal) * c.quantity;
      };
      const subtotal = items.reduce((sum, item) => sum + getCartItemPrice(item), 0);
      const deliveryFee = orderData.orderType === 'delivery' ? restConfig.deliveryFee : 0;
      const total = subtotal + deliveryFee;

      const itemsPayload = items.map((c) => ({
        id: c.id,
        menuItemId: c.menuItem.id,
        name: c.menuItem.name,
        quantity: c.quantity,
        unitPrice: c.menuItem.promoPrice ?? c.menuItem.price,
        totalPrice: getCartItemPrice(c),
        selectedOptions: c.selectedOptions,
        notes: c.notes,
      }));

      return {
        restaurantSlug: slug,
        restaurantName: restConfig.name,
        customerName: orderData.customerName,
        customerPhone: orderData.customerPhone,
        orderType: orderData.orderType,
        tableNumber: orderData.tableNumber,
        deliveryAddress: orderData.deliveryAddress,
        items: itemsPayload,
        subtotal,
        deliveryFee,
        discount: 0,
        total,
        paymentMethod: orderData.paymentMethod,
        paymentDetails: orderData.paymentDetails,
        notes: orderData.notes,
        idempotencyKey: `${baseKey}-${slug}`,
      };
    });

    const res = await fetch('/api/orders/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ordersPayloads: payloads }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Erro ao criar pedidos multi-restaurante.');
    }

    const data = await res.json();
    const created: Order[] = data.orders || [];

    // Add to local state and alert refs
    created.forEach((ord) => alertedOrderIdsRef.current.add(ord.id));
    rememberMyOrders(created);
    setOrders((prev) => [...created, ...prev]);

    // Save customer record (CRM local: somente no painel)
    const nowIso = new Date().toISOString();


    // Clear cart and coupon
    setCart([]);
    setAppliedCoupon(null);
    return created;
  };

  // Customer Account
  const loginCustomer = (phoneOrEmail: string, name?: string) => {
    const clean = phoneOrEmail.trim();
    const existing = customers.find((c) => c.phone.includes(clean) || (c.email && c.email.includes(clean)));
    const cust: CustomerUser = {
      id: existing?.id || `cust-user-${Date.now()}`,
      name: name || existing?.name || 'Cliente Tokio',
      phone: existing?.phone || clean,
      email: existing?.email || (clean.includes('@') ? clean : undefined),
      addresses: existing?.addresses?.map((a, i) => ({
        id: `addr-${i}`,
        title: i === 0 ? 'Principal' : `Endereço ${i + 1}`,
        street: a.street,
        number: a.number,
        neighborhood: a.neighborhood,
        city: a.city,
        complement: a.complement,
        isDefault: i === 0,
      })) || [],
      favoriteProductIds: [],
    };
    setCurrentCustomer(cust);
    localStorage.setItem('tokio_current_customer_v25', JSON.stringify(cust));
  };

  const logoutCustomer = () => {
    setCurrentCustomer(null);
    localStorage.removeItem('tokio_current_customer_v25');
  };

  const updateCustomerProfile = (data: Partial<CustomerUser>) => {
    setCurrentCustomer((prev) => {
      if (!prev) return null;
      const updated = { ...prev, ...data };
      localStorage.setItem('tokio_current_customer_v25', JSON.stringify(updated));
      return updated;
    });
  };

  const addCustomerAddress = (addr: {
    title: string;
    street: string;
    number: string;
    neighborhood: string;
    city: string;
    complement?: string;
    isDefault?: boolean;
  }) => {
    setCurrentCustomer((prev) => {
      if (!prev) return null;
      const newAddress = {
        ...addr,
        id: `addr-${Date.now()}`,
      };
      const updatedAddresses = addr.isDefault
        ? [newAddress, ...prev.addresses.map((a) => ({ ...a, isDefault: false }))]
        : [...prev.addresses, newAddress];
      const updated = { ...prev, addresses: updatedAddresses };
      localStorage.setItem('tokio_current_customer_v25', JSON.stringify(updated));
      return updated;
    });
  };

  // Delivery Staff
  const updateDeliveryStaffStatus = (staffId: string, status: DeliveryPersonnel['status']) => {
    setDeliveryStaff((prev) =>
      prev.map((s) => (s.id === staffId ? { ...s, status } : s))
    );
  };

  const addDeliveryStaff = (data: { name: string; phone: string; vehicle: DeliveryPersonnel['vehicle']; commissionRate: number }) => {
    const person: DeliveryPersonnel = {
      id: `mot-${Date.now()}`,
      name: data.name.trim(),
      phone: data.phone.trim(),
      vehicle: data.vehicle,
      status: 'disponivel',
      activeOrders: [],
      totalDeliveries: 0,
      commissionRate: Math.max(0, Number(data.commissionRate) || 0),
      rating: 5,
    };
    setDeliveryStaff((prev) => [...prev, person]);
    logAction(`Entregador cadastrado: ${person.name}`, 'user');
    showToast('Entregador cadastrado!', 'success');
  };

  const removeDeliveryStaff = (staffId: string) => {
    setDeliveryStaff((prev) => prev.filter((s) => s.id !== staffId));
    logAction('Entregador removido', 'user');
  };

  const assignOrderToDelivery = (orderId: string, staffId: string) => {
    setDeliveryStaff((prev) =>
      prev.map((s) => {
        if (s.id === staffId) {
          return {
            ...s,
            status: 'em_entrega',
            activeOrders: Array.from(new Set([...s.activeOrders, orderId])),
          };
        }
        return s;
      })
    );
    updateOrderStatus(orderId, 'saiu_para_entrega', 'Atribuído ao entregador');
  };

  // Cash Register
  const nowLabel = () => new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  const openCashShift = (initialAmount: number) => {
    if (!cashShift.isClosed) {
      showToast('Já existe um caixa aberto.', 'error');
      return;
    }
    const amount = Math.max(0, Number(initialAmount) || 0);
    const operator = currentUser?.name || 'Caixa';
    const shift: CashRegisterShift = {
      id: `shift-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}`,
      openedAt: new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }),
      initialAmount: amount,
      isClosed: false,
      movements: [
        {
          id: `mov-${Date.now()}`,
          type: 'suprimento',
          amount,
          description: 'Fundo de troco inicial de caixa',
          timestamp: nowLabel(),
          operator,
        },
      ],
    };
    setCashShift(() => shift);
    logAction(`Caixa aberto com troco inicial de R$ ${amount.toFixed(2)}`, 'system');
    showToast('Caixa aberto com sucesso!', 'success');
  };

  const addCashMovement = (type: CashRegisterMovement['type'], amount: number, description: string) => {
    const newMovement: CashRegisterMovement = {
      id: `mov-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type,
      amount,
      description,
      timestamp: nowLabel(),
      operator: currentUser?.name || 'Caixa',
    };
    // Reaplicado sobre o valor mais novo do servidor se outro aparelho lançou ao mesmo tempo
    setCashShift((prev) => {
      if (prev.isClosed) return prev; // não lança em caixa fechado
      return { ...prev, movements: [newMovement, ...prev.movements] };
    });
  };

  const closeCashShift = () => {
    const closer = currentUser?.name || 'Operador de Caixa';
    const closedAt = nowLabel();
    let closedSnapshot: CashRegisterShift | null = null;
    setCashShift((prev) => {
      if (prev.isClosed) return prev;
      const sum = (types: CashRegisterMovement['type'][]) =>
        prev.movements.filter((m) => types.includes(m.type)).reduce((t, m) => t + m.amount, 0);
      const dinheiro = sum(['venda_dinheiro', 'suprimento']);
      const sangria = sum(['sangria']);
      const pix = sum(['venda_pix']);
      const cartao = sum(['venda_cartao']);
      closedSnapshot = {
        ...prev,
        isClosed: true,
        closedAt,
        closedBy: closer,
        finalTotals: {
          dinheiro,
          pix,
          cartao,
          sangriaTotal: sangria,
          suprimentoTotal: prev.initialAmount,
          faturamentoTotal: dinheiro + pix + cartao - prev.initialAmount,
          saldoGaveta: dinheiro - sangria,
        },
      };
      return closedSnapshot;
    });
    if (closedSnapshot) {
      const snap = closedSnapshot as CashRegisterShift;
      setCashShiftHistory((prev) => [snap, ...prev.filter((h) => h.id !== snap.id)].slice(0, 200));
      logAction('Caixa fechado', 'system');
    }
  };

  // Restaura o CARDÁPIO/RESTAURANTES de demonstração (substitui o catálogo do servidor).
  // Pedidos, clientes e caixa NÃO são tocados.
  const resetToDefaultData = () => {
    setRestaurants(INITIAL_RESTAURANTS);
    setCategories(INITIAL_CATEGORIES);
    setMenuItems(INITIAL_MENU_ITEMS);
    setPrinterSettings(DEFAULT_PRINTER_SETTINGS);
    setCart([]);
    setAppliedCoupon(null);
  };

  const currentRestaurant = restaurants[activeRestaurantSlug] || restaurants.japones || Object.values(restaurants)[0] || INITIAL_RESTAURANTS.japones;
  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartSubtotal = cart.reduce((sum, item) => sum + (item.subtotal || 0), 0);
  const cartDiscount = appliedCoupon
    ? appliedCoupon.type === 'percent'
      ? (cartSubtotal * appliedCoupon.value) / 100
      : appliedCoupon.value
    : 0;
  const cartDeliveryFee = orderType === 'delivery' ? (currentRestaurant?.deliveryFee || 0) : 0;
  const cartTotal = Math.max(0, cartSubtotal - cartDiscount + cartDeliveryFee);

  // Alias não enumerável: componentes antigos que usam `restaurants.japones` como último
  // recurso nunca quebram se esse restaurante for removido do cardápio no servidor.
  const safeRestaurants = React.useMemo(() => {
    if (restaurants.japones) return restaurants;
    const first = Object.values(restaurants)[0];
    if (!first) return restaurants;
    return Object.defineProperty({ ...restaurants }, 'japones', { value: first, enumerable: false });
  }, [restaurants]);

  return (
    <StoreContext.Provider
      value={{
        appMode: mode,
        cashShiftHistory,
        openCashShift,
        addDeliveryStaff,
        removeDeliveryStaff,
        restaurants: safeRestaurants,
        categories,
        menuItems,
        orders,
        customers,
        cart,
        orderType,
        selectedTable,
        activeRestaurantSlug,
        isCartOpen,
        appliedCoupon,
        trackingOrderId,
        currentRestaurant,
        cartItemCount,
        cartTotal,
        printerSettings,
        soundSettings,
        delaySettings,
        isAudioUnlocked,
        isOnline,
        isSyncing,
        lastSyncTime,
        currentUser,
        loginUser,
        logoutUser,
        checkPermission,
        connectedDevices,
        refreshDevices,
        auditLogs,
        refreshAuditLogs,
        logAction,
        setActiveRestaurantSlug,
        setOrderType,
        setSelectedTable,
        setIsCartOpen,
        setTrackingOrderId,
        addToCart,
        updateCartItemQuantity,
        removeFromCart,
        clearCart,
        applyCoupon,
        removeCoupon,
        createOrder,
        createQuickTestOrder,
        updateOrderStatus,
        updateOrderItem,
        updateStationStatus,
        appendItemsToTableOrder,
        closeTableOrder,
        updateOrderPrintStatus,
        deleteOrder,
        clearOrdersHistory,
        clearAllOrders,
        syncOrdersNow,
        updateSoundSettings,
        updateDelaySettings,
        silenceOrderDelay,
        testSound,
        unlockAudioContext,
        clearCustomersData,
        deleteCustomer,
        addCustomer,
        updateCustomerNotes,
        updatePrinterSettings,
        updateMenuItem,
        addMenuItem,
        deleteMenuItem,
        updateRestaurantConfig,
        addRestaurant,
        deleteRestaurant,
        resetToDefaultData,
        updateVitrineConfig,
        masterResetOrders,
        createBatchOrders,
        currentCustomer,
        loginCustomer,
        logoutCustomer,
        updateCustomerProfile,
        addCustomerAddress,
        deliveryStaff,
        updateDeliveryStaffStatus,
        assignOrderToDelivery,
        cashShift,
        addCashMovement,
        closeCashShift,
        salesChannels,
        updateSalesChannel,
        showToast,
      }}
    >
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </StoreContext.Provider>
  );
};

export const useStore = (): StoreContextType => {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error('useStore must be used within a StoreProvider');
  }
  return context;
};
