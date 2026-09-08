export type RestaurantSlug = 'japones' | 'italiano' | 'pizza' | 'hamburgueria';

export type OrderType = 'delivery' | 'retirada' | 'mesa';

export type PaymentMethod = 'pix' | 'cartao_credito' | 'cartao_debito' | 'dinheiro';

// V7 Operational flow: Recebido -> Em preparo -> Pronto -> Saiu para entrega -> Entregue (or Cancelado)
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

export interface MenuItemOption {
  id: string;
  name: string;
  price: number;
}

export interface MenuItemOptionGroup {
  id: string;
  title: string;
  required: boolean;
  maxSelections?: number;
  options: MenuItemOption[];
}

export interface MenuItem {
  id: string;
  restaurantSlug: RestaurantSlug;
  categoryId: string;
  name: string;
  description: string;
  price: number;
  promoPrice?: number;
  image: string;
  available: boolean;
  tags?: ('mais_vendido' | 'promocao' | 'vegetariano' | 'destaque')[];
  optionGroups?: MenuItemOptionGroup[];
}

export interface MenuCategory {
  id: string;
  restaurantSlug: RestaurantSlug;
  name: string;
  icon?: string;
  order: number;
}

export interface RestaurantConfig {
  slug: RestaurantSlug;
  name: string;
  tagline: string;
  cuisine: string;
  emoji: string;
  color: string; // Tailwind color class or hex
  accentColor: string;
  logo: string;
  banner: string;
  rating: number;
  reviewCount: number;
  estimatedTimeMin: number;
  estimatedTimeMax: number;
  deliveryFee: number;
  minOrderValue: number;
  phone: string;
  whatsapp: string;
  address: string;
  openingHours: string;
  isOpen: boolean;
  pixKey: string;
  pixReceiverName: string;
  splashEnabled: boolean;
  splashSlides: {
    image: string;
    title: string;
    subtitle: string;
  }[];
  activeTables: number[];
  printerSettings?: PrinterSettings;
}

export interface CartItemOptionSelected {
  groupId: string;
  groupTitle: string;
  optionId: string;
  name: string;
  price: number;
}

export interface CartItem {
  id: string; // unique cart item id
  menuItem: MenuItem;
  quantity: number;
  selectedOptions: CartItemOptionSelected[];
  notes?: string;
  unitTotalPrice: number;
  subtotal: number;
}

export interface OrderItemRecord {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  selectedOptions?: CartItemOptionSelected[];
  notes?: string;
}

export interface Order {
  id: string;
  shortCode: string; // e.g. #TK-4821
  restaurantSlug: RestaurantSlug;
  restaurantName: string;
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
  items: OrderItemRecord[];
  subtotal: number;
  deliveryFee: number;
  discount: number;
  couponCode?: string;
  total: number;
  paymentMethod: PaymentMethod;
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
  createdAt: string;
  updatedAt: string;
}

export interface CustomerRecord {
  id: string;
  name: string;
  phone: string;
  email?: string;
  addresses?: {
    street: string;
    number: string;
    neighborhood: string;
    city: string;
    complement?: string;
  }[];
  totalOrders: number;
  totalSpent: number;
  lastOrderAt: string;
  createdAt: string;
  preferredRestaurant?: RestaurantSlug;
  favoriteRestaurantSlug?: RestaurantSlug;
  notes?: string;
}

export interface SmartTicketAIAnalysis {
  stationRouting: string[];
  allergyWarnings: string[];
  preparationSequence: string[];
  estimatedPrepMinutes: number;
  chefMessage: string;
  fallback?: boolean;
}

export interface PrinterSettings {
  paperWidth: '80mm' | '58mm';
  autoPrintOnNewOrder: boolean;
  soundAlert: boolean;
  showQrCode: boolean;
  numberOfCopies: number;
  headerCustomNote?: string;
  enableSmartTicketAI?: boolean;
  defaultPrinterName?: string;
}

