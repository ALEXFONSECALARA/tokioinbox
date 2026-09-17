import React, { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from 'react';
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
} from '../types/restaurant';
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
  }) => Promise<{ success: boolean; order?: Order; isNew?: boolean; error?: string }>;
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
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

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
};

const DEFAULT_PRINTER_SETTINGS: PrinterSettings = {
  paperWidth: '80mm',
  autoPrintOnNewOrder: true,
  soundAlert: true,
  showQrCode: true,
  numberOfCopies: 1,
  headerCustomNote: 'VIA DA COZINHA / EXPEDIÇÃO',
};

export const StoreProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [restaurants, setRestaurants] = useState<Record<string, RestaurantConfig>>(() => {
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
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.MENU_ITEMS);
      if (!saved) return INITIAL_MENU_ITEMS;
      const parsed: MenuItem[] = JSON.parse(saved);
      const existingItemIds = new Set(parsed.map((i) => i.id));
      const missingItems = INITIAL_MENU_ITEMS.filter((i) => !existingItemIds.has(i.id));
      return [...parsed, ...missingItems];
    } catch {
      return INITIAL_MENU_ITEMS;
    }
  });

  const [orders, setOrders] = useState<Order[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.ORDERS);
      return saved ? JSON.parse(saved) : INITIAL_SAMPLE_ORDERS;
    } catch {
      return INITIAL_SAMPLE_ORDERS;
    }
  });

  const [customers, setCustomers] = useState<CustomerRecord[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.CUSTOMERS);
      return saved ? JSON.parse(saved) : INITIAL_CUSTOMERS;
    } catch {
      return INITIAL_CUSTOMERS;
    }
  });

  const [printerSettings, setPrinterSettings] = useState<PrinterSettings>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.PRINTER_SETTINGS);
      return saved ? JSON.parse(saved) : DEFAULT_PRINTER_SETTINGS;
    } catch {
      return DEFAULT_PRINTER_SETTINGS;
    }
  });

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

  const [delaySettings, setDelaySettings] = useState<DelayAlertSettings>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.DELAY_SETTINGS);
      return saved ? JSON.parse(saved) : DEFAULT_DELAY_SETTINGS;
    } catch {
      return DEFAULT_DELAY_SETTINGS;
    }
  });

  const [currentUser, setCurrentUser] = useState<UserAccount | null>(() => {
    try {
      const saved = sessionStorage.getItem('tokio_current_user_v25');
      if (saved === 'logged_out') return null;
      if (saved) return JSON.parse(saved);
      // Pre-authenticated super admin for seamless test environment
      return {
        id: 'usr-superadmin',
        name: 'Super Administrador (Modo Teste)',
        username: 'admin',
        passwordHash: '',
        passwordSalt: '',
        role: 'super_admin',
        restaurantSlug: 'all',
        isActive: true,
        permissions: {
          can_view_orders: true,
          can_create_orders: true,
          can_edit_orders: true,
          can_cancel_orders: true,
          can_change_status: true,
          can_view_menu: true,
          can_edit_menu: true,
          can_change_prices: true,
          can_manage_categories: true,
          can_manage_users: true,
          can_manage_permissions: true,
          can_configure_alerts: true,
          can_connect_devices: true,
          can_view_reports: true,
          can_configure_restaurant: true,
          can_manage_notifications: true,
        },
        createdAt: new Date().toISOString(),
      };
    } catch {
      return null;
    }
  });

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

  // Delivery Personnel
  const [deliveryStaff, setDeliveryStaff] = useState<DeliveryPersonnel[]>([
    {
      id: 'mot-1',
      name: 'Carlos Oliveira (Moto 01)',
      phone: '(11) 98711-2233',
      vehicle: 'moto',
      status: 'disponivel',
      activeOrders: [],
      totalDeliveries: 142,
      commissionRate: 7.5,
      rating: 4.9,
    },
    {
      id: 'mot-2',
      name: 'Matheus Santos (Moto 02)',
      phone: '(11) 97654-3321',
      vehicle: 'moto',
      status: 'em_entrega',
      activeOrders: ['ord-102'],
      totalDeliveries: 98,
      commissionRate: 7.5,
      rating: 4.8,
    },
    {
      id: 'mot-3',
      name: 'Lucas Ferreira (Bike Flash)',
      phone: '(11) 99123-4567',
      vehicle: 'bike',
      status: 'disponivel',
      activeOrders: [],
      totalDeliveries: 65,
      commissionRate: 6.0,
      rating: 5.0,
    },
    {
      id: 'mot-4',
      name: 'Rafael Lima (Moto 03)',
      phone: '(11) 98234-9988',
      vehicle: 'moto',
      status: 'offline',
      activeOrders: [],
      totalDeliveries: 210,
      commissionRate: 7.5,
      rating: 4.9,
    },
  ]);

  // Cash Register Shift (Caixa)
  const [cashShift, setCashShift] = useState<CashRegisterShift>({
    id: `shift-${new Date().toISOString().slice(0, 10)}`,
    openedAt: 'Hoje às 11:30',
    initialAmount: 150.0,
    isClosed: false,
    movements: [
      {
        id: 'mov-1',
        type: 'suprimento',
        amount: 150.0,
        description: 'Fundo de troco inicial de caixa',
        timestamp: '11:30',
        operator: 'Caixa Principal',
      },
    ],
  });

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
    try {
      localStorage.setItem(STORAGE_KEYS.RESTAURANTS, JSON.stringify(restaurants));
    } catch (e) {
      console.warn('Storage error', e);
    }
  }, [restaurants]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(categories));
    } catch (e) {
      console.warn('Storage error', e);
    }
  }, [categories]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.MENU_ITEMS, JSON.stringify(menuItems));
    } catch (e) {
      console.warn('Storage error', e);
    }
  }, [menuItems]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(orders));
    } catch (e) {
      console.warn('Storage error', e);
    }
  }, [orders]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(customers));
    } catch (e) {
      console.warn('Storage error', e);
    }
  }, [customers]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.PRINTER_SETTINGS, JSON.stringify(printerSettings));
    } catch (e) {
      console.warn('Storage error', e);
    }
  }, [printerSettings]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.SOUND_SETTINGS, JSON.stringify(soundSettings));
    } catch (e) {
      console.warn('Storage error', e);
    }
  }, [soundSettings]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.DELAY_SETTINGS, JSON.stringify(delaySettings));
    } catch (e) {
      console.warn('Storage error', e);
    }
  }, [delaySettings]);

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
  }, [soundSettings]);

  // Network Listeners & Adaptive Background Polling (Tab Visibility Aware)
  useEffect(() => {
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

    const setupSSE = () => {
      if (typeof window === 'undefined' || typeof EventSource === 'undefined') return;

      try {
        if (eventSource) {
          eventSource.close();
        }

        eventSource = new EventSource('/api/orders/stream');

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
      }
    };

    setupSSE();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (timerId) clearTimeout(timerId);
      if (sseRetryTimer) clearTimeout(sseRetryTimer);
      if (eventSource) eventSource.close();
    };
  }, [fetchOrdersFromServer]);

  // Repeating Sound Alert for Pending Orders
  useEffect(() => {
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
      setCurrentUser(data.user);
      sessionStorage.setItem('tokio_current_user_v25', JSON.stringify(data.user));
      sessionStorage.setItem('tokio_admin_auth', 'true');
      return { success: true };
    } catch (e: any) {
      return { success: false, error: 'Erro de conexão com o servidor' };
    }
  };

  const logoutUser = () => {
    if (currentUser) {
      logAction(`Logout do usuário @${currentUser.username}`, 'user');
    }
    setCurrentUser(null);
    sessionStorage.setItem('tokio_current_user_v25', 'logged_out');
    sessionStorage.removeItem('tokio_admin_auth');
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
    refreshDevices();
    refreshAuditLogs();
  }, [refreshDevices, refreshAuditLogs]);

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
      name: c.menuItem.name,
      quantity: c.quantity,
      unitPrice: c.menuItem.price,
      totalPrice: c.subtotal,
      selectedOptions: c.selectedOptions,
      notes: c.notes,
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
    } catch (networkErr: any) {
      console.warn('[NETWORK RECOVERY] Verificando se pedido foi gravado antes da oscilação de rede:', networkErr);
      try {
        const checkRes = await fetch(`/api/orders/check-idempotency/${encodeURIComponent(finalKey)}`);
        if (checkRes.ok) {
          const checkData = await checkRes.json();
          if (checkData.exists && checkData.order) {
            console.log('[RECOVERY SUCCESS] Pedido recuperado com segurança no servidor:', checkData.order.id);
            confirmedOrder = checkData.order;
          } else {
            throw networkErr;
          }
        } else {
          throw networkErr;
        }
      } catch {
        throw new Error(
          networkErr.message ||
            'Falha ao confirmar pedido com o restaurante. Verifique sua conexão e tente novamente.'
        );
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

    // Auto-sync customer to Customers database
    const nowIso = new Date().toISOString();
    setCustomers((prevCustomers) => {
      const phoneClean = orderData.customerPhone.replace(/\D/g, '');
      const existingIdx = prevCustomers.findIndex(
        (c) => c.phone.replace(/\D/g, '') === phoneClean || (phoneClean && c.phone === orderData.customerPhone)
      );

      if (existingIdx >= 0) {
        const existing = prevCustomers[existingIdx];
        const updatedAddresses = [...(existing.addresses || [])];
        if (orderData.deliveryAddress) {
          const addrExists = updatedAddresses.some(
            (a) =>
              a.street.toLowerCase() === orderData.deliveryAddress!.street.toLowerCase() &&
              a.number === orderData.deliveryAddress!.number
          );
          if (!addrExists) {
            updatedAddresses.unshift(orderData.deliveryAddress);
          }
        }

        const updated: CustomerRecord = {
          ...existing,
          name: orderData.customerName || existing.name,
          addresses: updatedAddresses,
          totalOrders: existing.totalOrders + 1,
          totalSpent: existing.totalSpent + confirmedOrder.total,
          lastOrderAt: nowIso,
          preferredRestaurant: activeRestaurantSlug,
        };

        const list = [...prevCustomers];
        list[existingIdx] = updated;
        return list;
      } else {
        const newCustomer: CustomerRecord = {
          id: `cust-${Date.now()}`,
          name: orderData.customerName,
          phone: orderData.customerPhone,
          addresses: orderData.deliveryAddress ? [orderData.deliveryAddress] : [],
          totalOrders: 1,
          totalSpent: confirmedOrder.total,
          lastOrderAt: nowIso,
          createdAt: nowIso,
          preferredRestaurant: activeRestaurantSlug,
          notes: orderData.notes ? `Nota recente: ${orderData.notes}` : undefined,
        };
        return [newCustomer, ...prevCustomers];
      }
    });

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
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
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

      const res = await fetch(`/api/orders/${orderId}/station-status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
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
  }): Promise<{ success: boolean; order?: Order; isNew?: boolean; error?: string }> => {
    try {
      const restSlug = params.restaurantSlug || activeRestaurantSlug || 'japones';
      const restName = params.restaurantName || restaurants[restSlug]?.name || 'Restaurante';

      const res = await fetch('/api/orders/table/append', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
      await fetch(`/api/orders/${orderId}`, {
        method: 'DELETE',
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
      await fetch('/api/orders/clear-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
    const res = await fetch('/api/orders/master-reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        confirmation,
        operatorName: currentUser?.name || 'Super Admin',
        operatorRole: currentUser?.role || 'super_admin',
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
        name: c.menuItem.name,
        quantity: c.quantity,
        unitPrice: c.menuItem.price,
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
    setOrders((prev) => [...created, ...prev]);

    // Save customer record
    const nowIso = new Date().toISOString();
    setCustomers((prevCustomers) => {
      const phoneClean = orderData.customerPhone.replace(/\D/g, '');
      const existingIdx = prevCustomers.findIndex(
        (c) => c.phone.replace(/\D/g, '') === phoneClean || (phoneClean && c.phone === orderData.customerPhone)
      );
      const totalBatch = created.reduce((s, o) => s + o.total, 0);
      if (existingIdx >= 0) {
        const existing = prevCustomers[existingIdx];
        const updated: CustomerRecord = {
          ...existing,
          name: orderData.customerName || existing.name,
          totalOrders: existing.totalOrders + created.length,
          totalSpent: existing.totalSpent + totalBatch,
          lastOrderAt: nowIso,
        };
        const list = [...prevCustomers];
        list[existingIdx] = updated;
        return list;
      } else {
        const newCustomer: CustomerRecord = {
          id: `cust-${Date.now()}`,
          name: orderData.customerName,
          phone: orderData.customerPhone,
          addresses: orderData.deliveryAddress ? [orderData.deliveryAddress] : [],
          totalOrders: created.length,
          totalSpent: totalBatch,
          lastOrderAt: nowIso,
          createdAt: nowIso,
        };
        return [newCustomer, ...prevCustomers];
      }
    });

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
  const addCashMovement = (type: CashRegisterMovement['type'], amount: number, description: string) => {
    const newMovement: CashRegisterMovement = {
      id: `mov-${Date.now()}`,
      type,
      amount,
      description,
      timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      operator: currentUser?.name || 'Caixa',
    };
    setCashShift((prev) => ({
      ...prev,
      movements: [newMovement, ...prev.movements],
    }));
  };

  const closeCashShift = () => {
    const dinheiro = cashShift.movements
      .filter((m) => m.type === 'venda_dinheiro' || m.type === 'suprimento')
      .reduce((s, m) => s + m.amount, 0);
    const sangria = cashShift.movements
      .filter((m) => m.type === 'sangria')
      .reduce((s, m) => s + m.amount, 0);
    const pix = cashShift.movements
      .filter((m) => m.type === 'venda_pix')
      .reduce((s, m) => s + m.amount, 0);
    const cartao = cashShift.movements
      .filter((m) => m.type === 'venda_cartao')
      .reduce((s, m) => s + m.amount, 0);

    setCashShift((prev) => ({
      ...prev,
      isClosed: true,
      closedAt: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      closedBy: currentUser?.name || 'Operador de Caixa',
      finalTotals: {
        dinheiro,
        pix,
        cartao,
        sangriaTotal: sangria,
        suprimentoTotal: cashShift.initialAmount,
        faturamentoTotal: dinheiro + pix + cartao - cashShift.initialAmount,
        saldoGaveta: dinheiro - sangria,
      },
    }));
  };

  const resetToDefaultData = () => {
    setRestaurants(INITIAL_RESTAURANTS);
    setCategories(INITIAL_CATEGORIES);
    setMenuItems(INITIAL_MENU_ITEMS);
    setOrders(INITIAL_SAMPLE_ORDERS);
    setCustomers(INITIAL_CUSTOMERS);
    setPrinterSettings(DEFAULT_PRINTER_SETTINGS);
    setCart([]);
    setAppliedCoupon(null);
    localStorage.removeItem(STORAGE_KEYS.RESTAURANTS);
    localStorage.removeItem(STORAGE_KEYS.CATEGORIES);
    localStorage.removeItem(STORAGE_KEYS.MENU_ITEMS);
    localStorage.removeItem(STORAGE_KEYS.ORDERS);
    localStorage.removeItem(STORAGE_KEYS.CUSTOMERS);
    localStorage.removeItem(STORAGE_KEYS.PRINTER_SETTINGS);
    localStorage.removeItem(STORAGE_KEYS.CART);
  };

  const currentRestaurant = restaurants[activeRestaurantSlug] || restaurants.japones;
  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartSubtotal = cart.reduce((sum, item) => sum + item.totalPrice, 0);
  const cartDiscount = appliedCoupon
    ? appliedCoupon.type === 'percent'
      ? (cartSubtotal * appliedCoupon.value) / 100
      : appliedCoupon.value
    : 0;
  const cartDeliveryFee = orderType === 'delivery' ? (currentRestaurant?.deliveryFee || 0) : 0;
  const cartTotal = Math.max(0, cartSubtotal - cartDiscount + cartDeliveryFee);

  return (
    <StoreContext.Provider
      value={{
        restaurants,
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
        updateStationStatus,
        appendItemsToTableOrder,
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
