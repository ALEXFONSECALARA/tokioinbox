export type RestaurantSlug =
  | 'japones'
  | 'italiano'
  | 'pizza'
  | 'hamburgueria'
  | 'risotos'
  | 'grelhados'
  | 'vegano'
  | (string & {});

export type OrderType = 'mesa' | 'balcao' | 'delivery' | 'retirada' | 'online';

export function normalizeOrderType(raw: string | undefined | null): OrderType {
  if (!raw) return 'mesa';
  const clean = raw.toLowerCase().trim().replace(/ã/g, 'a').replace(/ç/g, 'c');
  if (clean === 'dine_in' || clean === 'mesa' || clean.includes('mesa')) return 'mesa';
  if (clean === 'counter' || clean === 'balcao' || clean.includes('balcao')) return 'balcao';
  if (clean === 'delivery' || clean.includes('entrega')) return 'delivery';
  if (clean === 'retirada' || clean === 'takeaway' || clean.includes('retirada')) return 'retirada';
  if (clean === 'online' || clean.includes('web')) return 'online';
  return 'mesa';
}

export interface SalesChannelConfig {
  id: 'mesa' | 'balcao' | 'delivery' | 'online' | 'retirada';
  orderType: OrderType;
  name: string;
  enabled: boolean;
  color: string; // Admin-configurable color
  textColor?: string;
  allowQrCodeCustomerOrder?: boolean;
  autoPrintReceipt?: boolean;
  productionStations: ProductionStation[];
  acceptedPaymentMethods: PaymentMethod[];
  operationalHours?: string;
  minOrderValue?: number;
  description?: string;
}

export type PaymentMethod = 'pix' | 'cartao_credito' | 'cartao_debito' | 'dinheiro';

// Operational flow: Recebido -> Aceito -> Em produção -> Parcialmente pronto -> Pronto -> Saiu para entrega / Entregue -> Finalizado (or Cancelado)
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

export interface RecipeIngredient {
  id: string;
  name: string;
  quantity: number;
  unit: 'g' | 'kg' | 'ml' | 'l' | 'un' | 'fatia';
  unitCost: number;
  totalCost: number;
}

export interface TechnicalSheet {
  itemId: string;
  yieldServings: number;
  prepTimeMinutes?: number;
  ingredients: RecipeIngredient[];
  packagingCost: number;
  laborCost: number;
  totalProductionCost: number;
  recommendedPrice: number;
  targetMarginPercent: number;
  notes?: string;
}

export interface MenuItem {
  id: string;
  restaurantSlug: RestaurantSlug;
  categoryId: string;
  name: string;
  description: string;
  price: number;
  promoPrice?: number;
  cmvCost?: number;
  technicalSheet?: TechnicalSheet;
  image: string;
  available: boolean;
  code?: string; // Código/SKU curto exibido em telas compactas (Balcão Touch)
  station?: ProductionStation; // Optional explicit station override ('cozinha' | 'sushibar' | 'bar')
  tags?: ('mais_vendido' | 'promocao' | 'vegetariano' | 'destaque')[];
  optionGroups?: MenuItemOptionGroup[];
  // Dados Fiscais para SEFAZ (NFC-e / NF-e)
  ncm?: string;
  cest?: string;
  cfop?: string;
  origem?: number;
  csosn?: string;
  cstIcms?: string;
  isMonofasico?: boolean;
  isSubstituicaoTributaria?: boolean;
  aliquotaIcms?: number;
}

export interface MenuCategory {
  id: string;
  restaurantSlug: RestaurantSlug;
  name: string;
  icon?: string;
  order: number;
}

export interface RestaurantPromo {
  id: string;
  title: string;
  badge: string;
  discountText: string;
  description: string;
  couponCode?: string;
  highlight?: boolean;
}

export interface RestaurantReviewItem {
  author: string;
  stars: number;
  date: string;
  comment: string;
  dishTag: string;
}

export interface RestaurantReviewsData {
  score: number;
  count: number;
  fiveStarsPercent: number;
  items: RestaurantReviewItem[];
}

export interface RestaurantSocials {
  instagram: string;
  whatsapp: string;
  phone: string;
  address: string;
  mapUrl?: string;
}

export interface RestaurantThemeStyle {
  badge: string;
  accentHex: string;
  tag: string;
  gradient: string;
  aura: string;
}

export interface RestaurantConfig {
  slug: RestaurantSlug;
  customUrlPath?: string; // Dedicated HTTP path alias, e.g. "SakuraSushiHouse", "CantinaBellaVista", "FornoDOro", "BurgerCraftBeer"
  customDomain?: string; // Dedicated base domain, e.g. "https://tokioinbox.onrender.com"
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
  freeDeliveryThreshold?: number;
  minOrderValue: number;
  phone: string;
  whatsapp: string;
  address: string;
  openingHours: string;
  isOpen: boolean;
  isActive?: boolean;
  pixKey: string;
  pixReceiverName: string;
  splashEnabled: boolean;
  splashSlides: {
    image: string;
    title: string;
    subtitle: string;
  }[];
  activeTables: number[];
  instagram?: string;
  socials?: RestaurantSocials;
  promotions?: RestaurantPromo[];
  reviewsInfo?: RestaurantReviewsData;
  themeStyle?: RestaurantThemeStyle;
  // Vitrine Principal Controls
  isActiveInVitrine?: boolean;
  vitrineStatus?: 'ATIVO' | 'OCULTO' | 'FECHADO_TEMPORARIAMENTE';
  vitrineOrder?: number;
  vitrineBadge?: string;
  vitrineCoverImage?: string;
  vitrineCallout?: string;
  vitrineLayoutTheme?: 'moderno_premium' | 'rustico_acolhedor' | 'clean_minimalista' | 'dark_elegante';
  serviceAreaKm?: number;
  bannerImage?: string;
  deliveryTime?: string;
  // V7: slide editável do carrossel "Promoções & Rodízios em Destaque" da
  // Home pública — antes fixo no código (LuxuryPromoSlider.tsx), agora
  // editado pelo super_admin em Vitrine Principal e salvo por restaurante.
  heroPromoSlide?: {
    enabled: boolean;
    badge: string;
    badgeIcon: string;
    title: string;
    highlightText: string;
    description: string;
    offerTag: string;
    image: string;
    ctaText: string;
  };
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
  station?: ProductionStation; // 'cozinha' | 'sushibar' | 'bar'
  stationStatus?: StationItemStatus; // 'recebido' | 'em_preparo' | 'pedido_feito'
}

export interface Order {
  id: string;
  /** Token secreto de rastreio (só o cliente que criou o pedido recebe). */
  trackingToken?: string;
  shortCode: string; // e.g. #TK-4821
  restaurantSlug: RestaurantSlug;
  restaurantName: string;
  customerName: string;
  customerPhone: string;
  orderType: OrderType;
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
  items: OrderItemRecord[];
  stations?: Partial<Record<ProductionStation, StationProductionRecord>>;
  stationsStatus?: Partial<Record<ProductionStation, StationItemStatus>>;
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
  printStatus: 'pendente' | 'imprimindo' | 'impresso' | 'falha';
  idempotencyKey?: string;
  createdAt: string;
  updatedAt: string;
}

export type OrderSoundType = 'sound1' | 'sound2' | 'sound3' | 'sound4' | 'sound5';

export interface SoundSettings {
  enabled: boolean;
  soundType: OrderSoundType;
  volume: number; // 0 to 1
  repeatUntilAcknowledged: boolean;
  vibrationEnabled?: boolean;
  alertOnDelay?: boolean;
  delayThresholdMinutes?: number;
  delayRepeatMinutes?: number;
  alertOnMobile?: boolean;
  alertOnPanel?: boolean;
}

export interface DelayAlertSettings {
  enabled: boolean;
  thresholdMinutes: number; // 10, 15, 20, 30
  repeatIntervalMinutes: number; // 1, 3, 5, 10
  silencedOrderIds: string[];
}

export type UserRole =
  | 'super_admin'
  | 'administrador'
  | 'admin'
  | 'admin_master'
  | 'caixa'
  | 'cozinha'
  | 'sushi_bar'
  | 'bar'
  | 'entrega'
  | 'garcom'
  | 'gerente';

export type TableStatus = 'livre' | 'ocupada' | 'preparando' | 'conta_solicitada';

export interface PhysicalTable {
  id: number;
  label: string;
  capacity: number;
  status: TableStatus;
  openedAt?: string;
  customerName?: string;
  peopleCount?: number;
  notes?: string;
}

export interface UserPermissions {
  can_view_orders: boolean;
  can_create_orders: boolean;
  can_edit_orders: boolean;
  can_cancel_orders: boolean;
  can_change_status: boolean;
  can_view_menu: boolean;
  can_edit_menu: boolean;
  can_change_prices: boolean;
  can_manage_categories: boolean;
  can_manage_users: boolean;
  can_manage_permissions: boolean;
  can_configure_alerts: boolean;
  can_connect_devices: boolean;
  can_view_reports: boolean;
  can_configure_restaurant: boolean;
  can_manage_notifications: boolean;
  can_edit_restaurants?: boolean;
  // BUG CORRIGIDO: a tela Equipe > Usuários (AdminUsers.tsx) já lia/gravava estes
  // dois campos havia tempo, mas eles nunca existiram neste tipo — o toggle na
  // interface era puramente visual e o typecheck do projeto falhava aqui. Ainda
  // NÃO há checagem correspondente no backend: hoje a exclusão definitiva de
  // pedido continua restrita a `super_admin` (ver DELETE /api/orders/:id em
  // server.ts) independentemente deste campo. Se o objetivo é permitir que
  // outros perfis excluam pedidos, o endpoint precisa ser atualizado para usar
  // `requirePermission('can_delete_orders')` — decisão de regra de negócio que
  // não foi alterada aqui.
  can_delete_orders?: boolean;
  can_print_tickets?: boolean;
}

export interface UserAccount {
  id: string;
  name: string;
  username: string;
  role: UserRole;
  restaurantSlug: string;
  restaurantAccess?: string;
  isActive: boolean;
  permissions: UserPermissions;
  createdAt: string;
  lastLoginAt?: string;
  token?: string;
}

export interface ConnectedDevice {
  id: string;
  pairingCode: string;
  deviceName: string;
  platform: 'android' | 'ios' | 'web' | 'other';
  ipAddress?: string;
  soundEnabled: boolean;
  soundType: OrderSoundType;
  volume: number;
  vibrationEnabled: boolean;
  delayAlertsEnabled: boolean;
  delayMinutesThreshold: number;
  delayRepeatMinutes: number;
  status: 'online' | 'offline';
  lastPingAt: string;
  connectedAt: string;
}

export interface AuditActionLog {
  id: string;
  timestamp: string;
  userName: string;
  userRole: string;
  action: string;
  details?: string;
  category: 'order' | 'user' | 'alert' | 'device' | 'system';
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

export interface DeliveryPersonnel {
  id: string;
  name: string;
  phone: string;
  vehicle: 'moto' | 'bike' | 'carro';
  status: 'disponivel' | 'em_entrega' | 'offline';
  activeOrders: string[];
  totalDeliveries: number;
  commissionRate: number; // e.g. 5.00 per delivery
  rating: number;
}

export interface CashRegisterMovement {
  id: string;
  type: 'suprimento' | 'sangria' | 'venda_dinheiro' | 'venda_pix' | 'venda_cartao';
  amount: number;
  description: string;
  timestamp: string;
  operator: string;
}

export interface CashRegisterShift {
  id: string;
  openedAt: string;
  closedAt?: string;
  initialAmount: number;
  movements: CashRegisterMovement[];
  isClosed: boolean;
  closedBy?: string;
  finalTotals?: {
    dinheiro: number;
    pix: number;
    cartao: number;
    sangriaTotal: number;
    suprimentoTotal: number;
    faturamentoTotal: number;
    saldoGaveta: number;
  };
}

export interface CustomerUser {
  id: string;
  name: string;
  phone: string;
  email?: string;
  addresses: {
    id: string;
    title: string;
    street: string;
    number: string;
    neighborhood: string;
    city: string;
    complement?: string;
    isDefault?: boolean;
  }[];
  favoriteProductIds: string[];
}

export interface SystemDiagnosticItem {
  category: 'database' | 'auth' | 'realtime' | 'api' | 'printers' | 'pwa' | 'network';
  title: string;
  status: 'ok' | 'aviso' | 'erro';
  details: string;
  actionGuide?: string;
  lastChecked: string;
}

export interface CmvIngredient {
  id: string;
  name: string;
  unit: 'kg' | 'g' | 'l' | 'ml' | 'un';
  packageCost: number;
  packageQuantity: number;
}

export interface CmvRecipeItem {
  id: string;
  productId: string;
  productName: string;
  restaurantSlug: RestaurantSlug;
  ingredients: {
    ingredientName: string;
    quantityUsed: number;
    unit: string;
    cost: number;
  }[];
  packagingCost: number;
  laborAndOverheadCost: number;
  totalCost: number;
  sellingPrice: number;
  cmvPercent: number; // (totalCost / sellingPrice) * 100
  targetMarginPercent: number;
  suggestedPrice: number;
}

