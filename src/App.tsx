import React, { useState, useEffect, useMemo } from 'react';
import { 
  MenuItem, 
  Category, 
  CartItem, 
  Order, 
  RestaurantConfig, 
  DietaryTag,
  DeliveryAddress,
  CustomerAccount,
  SavedAddress
} from './types';
import { 
  INITIAL_CATEGORIES, 
  INITIAL_MENU_ITEMS, 
  INITIAL_RESTAURANT_CONFIG 
} from './data/initialData';
import { fetchMenu, createOrder, fetchOrder, fetchOperationalStatus, fetchCustomerProfile, subscribeToOrderEvents } from './utils/api';
import { isPushSubscribed, subscribeToPush, unsubscribeFromPush } from './utils/push';
import { formatCurrency, playSoundEffect, COUPONS } from './utils/helpers';
import { SplashScreen } from './components/SplashScreen';
import { Header } from './components/Header';
import { CategoryNav } from './components/CategoryNav';
import { ProductCard } from './components/ProductCard';
import { ProductModal } from './components/ProductModal';
import { CartDrawer } from './components/CartDrawer';
import { CheckoutModal } from './components/CheckoutModal';
import { OrderStatusModal } from './components/OrderStatusModal';
import { DeliveryAddressModal } from './components/DeliveryAddressModal';
import { FavoritesModal } from './components/FavoritesModal';
import { CustomerAccountModal } from './components/CustomerAccountModal';
import { AssistantChat } from './components/AssistantChat';
import { InstallPrompt } from './components/InstallPrompt';
import { 
  ShoppingBag, 
  Bike,
  ChefHat, 
  MapPin,
  Clock,
  Percent,
  X
} from 'lucide-react';

// Tema visual por restaurante. Prioridade: cor cadastrada pelo próprio
// restaurante em Configurações → Aparência (config.color/secondaryColor) —
// vem primeiro, é a identidade real dele. Sem isso, cai no mapa fixo antigo
// (hoje só o "japones" tem tema próprio) e, por fim, no dourado padrão.
// Isso é só a cor — nenhuma lógica de cardápio/checkout/pedido muda aqui.
const DEFAULT_THEME = {
  brand: '#F59E0B',
  brandLight: '#FBBF24',
  brandDark: '#D97706',
  brandTint: '#FFFBEB',
  accentRed: '#F43F5E',
};

const RESTAURANT_THEMES: Record<string, typeof DEFAULT_THEME> = {
  japones: {
    brand: '#C9A227', // dourado
    brandLight: '#E0B94D',
    brandDark: '#8A6D1D',
    brandTint: '#FBF3D9',
    accentRed: '#B91C1C', // vermelho tradicional
  },
};

// Clareia/escurece um hex simples (sem libs extras) pra derivar brandLight/
// brandDark a partir da única cor que o restaurante configurou.
function shadeHex(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const r = Math.min(255, Math.max(0, (num >> 16) + amt));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00ff) + amt));
  const b = Math.min(255, Math.max(0, (num & 0x0000ff) + amt));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

function getThemeStyle(slug: string, config?: RestaurantConfig | null): React.CSSProperties {
  let theme = RESTAURANT_THEMES[slug] || DEFAULT_THEME;
  if (config?.color) {
    try {
      theme = {
        brand: config.color,
        brandLight: shadeHex(config.color, 18),
        brandDark: shadeHex(config.color, -18),
        brandTint: shadeHex(config.color, 92),
        accentRed: config.secondaryColor || theme.accentRed,
      };
    } catch {
      // hex inválido (raro, ex. campo salvo de forma inesperada) — mantém o tema padrão
      theme = RESTAURANT_THEMES[slug] || DEFAULT_THEME;
    }
  }
  return {
    ['--brand' as any]: theme.brand,
    ['--brand-light' as any]: theme.brandLight,
    ['--brand-dark' as any]: theme.brandDark,
    ['--brand-tint' as any]: theme.brandTint,
    ['--accent-red' as any]: theme.accentRed,
  };
}

interface AppProps {
  // Identifica qual restaurante esta loja representa (ex: 'japones', 'pizza').
  // Cada restaurante tem seu próprio cardápio, carrinho e pedidos isolados.
  restaurantSlug: string;
  onExit?: () => void;
}

export default function App({ restaurantSlug, onExit }: AppProps) {
  // Chaves do localStorage isoladas por restaurante, pra não misturar carrinho/pedidos
  // de lojas diferentes no mesmo navegador.
  const storageKey = (name: string) => `cardapio_${restaurantSlug}_${name}`;

  // Cardápio (categorias, itens, config do restaurante) agora vem do backend (/api/:slug/menu).
  // Os valores INITIAL_* servem só de fallback enquanto carrega ou se a API falhar.
  const [menuItems, setMenuItems] = useState<MenuItem[]>(INITIAL_MENU_ITEMS);
  const [categories, setCategories] = useState<Category[]>(INITIAL_CATEGORIES);
  const [restaurantConfig, setRestaurantConfig] = useState<RestaurantConfig>(INITIAL_RESTAURANT_CONFIG);
  const [isMenuLoading, setIsMenuLoading] = useState(true);
  const [menuLoadError, setMenuLoadError] = useState<string | null>(null);
  const isMenuHydrated = React.useRef(false);

  const [cartItems, setCartItems] = useState<CartItem[]>(() => {
    const saved = localStorage.getItem(storageKey('cart'));
    return saved ? JSON.parse(saved) : [];
  });

  const [orders, setOrders] = useState<Order[]>(() => {
    const saved = localStorage.getItem(storageKey('orders'));
    return saved ? JSON.parse(saved) : [];
  });

  const [favorites, setFavorites] = useState<string[]>(() => {
    const saved = localStorage.getItem(storageKey('favorites'));
    return saved ? JSON.parse(saved) : [];
  });

  // Saved Delivery Address State
  const [deliveryAddress, setDeliveryAddress] = useState<DeliveryAddress | null>(() => {
    const saved = localStorage.getItem(storageKey('delivery_address'));
    return saved ? JSON.parse(saved) : {
      street: 'Av. Paulista',
      number: '1578',
      complement: 'Apt 42B',
      neighborhood: 'Bela Vista',
      city: 'São Paulo',
      state: 'SP',
      cep: '01310-200'
    };
  });

  // Conta do cliente (Fase 4, itens 20-22) — GLOBAL, não isolada por
  // restaurante como o carrinho/pedidos: o mesmo cliente pede em qualquer
  // loja da plataforma com a mesma conta, por isso a chave do localStorage
  // aqui não usa storageKey().
  const CUSTOMER_TOKEN_KEY = 'tokioinbox_customer_token';
  const [customerToken, setCustomerToken] = useState<string | null>(() =>
    localStorage.getItem(CUSTOMER_TOKEN_KEY)
  );
  const [customerAccount, setCustomerAccount] = useState<CustomerAccount | null>(null);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);

  useEffect(() => {
    if (!customerToken) {
      setCustomerAccount(null);
      return;
    }
    fetchCustomerProfile(customerToken)
      .then(setCustomerAccount)
      .catch(() => {
        // Token expirado/inválido — desloga silenciosamente, sem travar o app.
        localStorage.removeItem(CUSTOMER_TOKEN_KEY);
        setCustomerToken(null);
        setCustomerAccount(null);
      });
  }, [customerToken]);

  const handleCustomerLoggedIn = (token: string, account: CustomerAccount) => {
    localStorage.setItem(CUSTOMER_TOKEN_KEY, token);
    setCustomerToken(token);
    setCustomerAccount(account);
  };

  const handleCustomerLoggedOut = () => {
    localStorage.removeItem(CUSTOMER_TOKEN_KEY);
    setCustomerToken(null);
    setCustomerAccount(null);
    setIsAccountModalOpen(false);
  };

  // "Usar este endereço" (item 21) — reaproveita o mesmo estado/persistência
  // de endereço que o checkout já lê via prop `currentAddress`, sem precisar
  // duplicar lógica de preenchimento dentro do CheckoutModal.
  const handleUseSavedAddress = (address: SavedAddress) => {
    const { id, customerId, isDefault, label, ...deliveryFields } = address;
    setDeliveryAddress(deliveryFields);
    setIsAccountModalOpen(false);
  };

  // Notificações push (Fase 4, item 27) — estado só reflete se JÁ existe uma
  // inscrição ativa neste navegador; o pedido de permissão só acontece
  // quando o cliente clica no sino, nunca automaticamente.
  const [isPushOn, setIsPushOn] = useState(false);
  useEffect(() => {
    isPushSubscribed().then(setIsPushOn);
  }, []);

  const handleTogglePush = async () => {
    if (isPushOn) {
      await unsubscribeFromPush(restaurantSlug);
      setIsPushOn(false);
    } else {
      const ok = await subscribeToPush(restaurantSlug, customerToken || undefined);
      setIsPushOn(ok);
    }
  };

  // UI state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<DietaryTag | null>(null);
  const [activeCategoryId, setActiveCategoryId] = useState('all');

  // Splash screen (tela de abertura em tela cheia): mostra uma vez por sessão
  // do navegador, por restaurante, se o admin tiver ativado e cadastrado fotos.
  const [showSplash, setShowSplash] = useState(false);

  // Modals & Drawers
  const [selectedProduct, setSelectedProduct] = useState<MenuItem | null>(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isOrderStatusOpen, setIsOrderStatusOpen] = useState(false);
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [isFavoritesOpen, setIsFavoritesOpen] = useState(false);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(() => {
    // Se o cliente fechar o navegador e voltar, reconecta com o pedido em
    // andamento (nem entregue, nem cancelado) em vez de esquecer dele.
    const saved = localStorage.getItem(storageKey('orders'));
    const savedOrders: Order[] = saved ? JSON.parse(saved) : [];
    const ongoing = savedOrders
      .filter((o) => o.status !== 'entregue' && o.status !== 'cancelado')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return ongoing[0]?.id || null;
  });
  // Controla o banner "Você possui um pedido em andamento" — só é dispensado
  // quando o cliente clica em "Acompanhar Pedido" ou fecha o aviso.
  const [showOngoingOrderBanner, setShowOngoingOrderBanner] = useState(!!activeOrderId);
  const [orderRealtimeState, setOrderRealtimeState] = useState<'connecting'|'online'|'reconnecting'|'offline'>('offline');

  // Coupon state
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);

  // Carrega o cardápio do backend (GET /api/:slug/menu) na primeira renderização
  // e sempre que o restaurante (slug) mudar.
  useEffect(() => {
    let cancelled = false;
    isMenuHydrated.current = false;
    setIsMenuLoading(true);
    (async () => {
      try {
        const data = await fetchMenu(restaurantSlug);
        if (cancelled) return;
        setMenuItems(data.menuItems);
        setCategories(data.categories);
        setRestaurantConfig(data.restaurantConfig);
        setMenuLoadError(null);
      } catch (err: any) {
        console.error('Falha ao buscar cardápio do backend, usando dados locais:', err);
        if (!cancelled) {
          const message = String(err?.message || '');
          setMenuLoadError(
            message.includes('não encontrado')
              ? `Restaurante "${restaurantSlug}" não encontrado.`
              : 'Não foi possível conectar ao servidor do cardápio. Mostrando dados salvos localmente.'
          );
          // Fallback: usa o que estiver salvo no localStorage, se houver
          const savedItems = localStorage.getItem(storageKey('menu_items'));
          const savedConfig = localStorage.getItem(storageKey('restaurant_config'));
          if (savedItems) setMenuItems(JSON.parse(savedItems));
          if (savedConfig) setRestaurantConfig(JSON.parse(savedConfig));
        }
      } finally {
        if (!cancelled) {
          isMenuHydrated.current = true;
          setIsMenuLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [restaurantSlug]);

  useEffect(() => {
    if (isMenuLoading || !restaurantConfig?.name) return;
    // Instalação por restaurante: o manifesto aponta para /r/:slug, então o
    // app instalado abre diretamente aquela loja e não a vitrine multi-restaurantes.
    let link = document.querySelector('link[rel="manifest"]') as HTMLLinkElement | null;
    if (!link) { link=document.createElement('link'); link.rel='manifest'; document.head.appendChild(link); }
    link.href=`/api/pwa/manifest?slug=${encodeURIComponent(restaurantSlug)}`;
    document.title=`${restaurantConfig.name} • Delivery`;
    let apple=document.querySelector('link[rel="apple-touch-icon"]') as HTMLLinkElement | null;
    if(!apple){apple=document.createElement('link');apple.rel='apple-touch-icon';document.head.appendChild(apple)}
    if(restaurantConfig.logo) apple.href=restaurantConfig.logo;
    if('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(()=>{});
  }, [isMenuLoading, restaurantSlug, restaurantConfig?.name, restaurantConfig?.logo]);

  // Decide se mostra a splash screen: só se o admin ativou e cadastrou fotos,
  // e só uma vez por sessão do navegador (não repete a cada nova aba/recarregar
  // fica marcado em sessionStorage — mas volta a aparecer numa sessão nova).
  useEffect(() => {
    if (isMenuLoading) return;
    const splashSeenKey = `cardapio_splash_seen_${restaurantSlug}`;
    const alreadySeen = sessionStorage.getItem(splashSeenKey);
    const hasSplashContent = restaurantConfig.splashEnabled && (restaurantConfig.splashImages?.length || 0) > 0;
    if (hasSplashContent && !alreadySeen) {
      setShowSplash(true);
      sessionStorage.setItem(splashSeenKey, '1');
    }
  }, [isMenuLoading, restaurantSlug, restaurantConfig.splashEnabled, restaurantConfig.splashImages]);

  // Mantém uma cópia local (cache/offline) do cardápio. Quem realmente salva as
  // edições no backend é o painel /admin (AdminPortal), que tem o token de login.
  useEffect(() => {
    localStorage.setItem(storageKey('menu_items'), JSON.stringify(menuItems));
  }, [menuItems]);

  useEffect(() => {
    localStorage.setItem(storageKey('restaurant_config'), JSON.stringify(restaurantConfig));
  }, [restaurantConfig]);

  useEffect(() => {
    localStorage.setItem(storageKey('cart'), JSON.stringify(cartItems));
  }, [cartItems]);

  useEffect(() => {
    localStorage.setItem(storageKey('orders'), JSON.stringify(orders));
  }, [orders]);

  useEffect(() => {
    localStorage.setItem(storageKey('favorites'), JSON.stringify(favorites));
  }, [favorites]);

  useEffect(() => {
    if (deliveryAddress) {
      localStorage.setItem(storageKey('delivery_address'), JSON.stringify(deliveryAddress));
    }
  }, [deliveryAddress]);

  // Canal em tempo real para o cliente: status novo chega no site/app e em
  // qualquer outro dispositivo autenticado sem depender de refresh. O polling
  // abaixo permanece como fallback para redes que bloqueiam SSE.
  useEffect(() => {
    if (!activeOrderId || !customerToken) return;
    const stop = subscribeToOrderEvents(restaurantSlug, customerToken, (event) => {
      if (event.orderId !== activeOrderId) return;
      fetchOrder(restaurantSlug, activeOrderId).then(updated => {
        setOrders(prev => prev.map(o => o.id === updated.id ? updated : o));
      }).catch(() => {});
    }, undefined, 'customer', setOrderRealtimeState);
    return stop;
  }, [activeOrderId, customerToken, restaurantSlug]);

  // Enquanto o pedido do cliente está ativo, consulta o backend a cada poucos
  // segundos pra saber se o admin mudou o status (recebido -> em preparo -> etc).
  useEffect(() => {
    if (!activeOrderId) return;
    const interval = setInterval(async () => {
      try {
        const updated = await fetchOrder(restaurantSlug, activeOrderId);
        setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
      } catch {
        // Backend pode estar indisponível momentaneamente; ignora e tenta de novo depois.
      }
    }, 6000);
    return () => clearInterval(interval);
  }, [activeOrderId, restaurantSlug]);

  // Ajuste operacional em tempo real (Fase 4, itens 14-16): se o restaurante
  // sinalizar "estamos mais devagar hoje" enquanto o cliente tem um pedido
  // aberto, a previsão exibida atualiza sozinha — sem precisar dar refresh —
  // reaproveitando o mesmo mecanismo de polling já usado acima pro status do
  // pedido, só que numa consulta mais leve (2 campos, não o pedido inteiro).
  const [liveOperationalAdjustment, setLiveOperationalAdjustment] = useState(0);
  useEffect(() => {
    if (!activeOrderId) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const status = await fetchOperationalStatus(restaurantSlug);
        if (!cancelled) setLiveOperationalAdjustment(status.operationalAdjustmentMinutes || 0);
      } catch {
        // idem — ignora falha pontual, tenta de novo no próximo ciclo
      }
    };
    poll();
    const interval = setInterval(poll, 6000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [activeOrderId, restaurantSlug]);

  // Some com o aviso de "pedido em andamento" assim que ele for entregue ou cancelado
  useEffect(() => {
    if (!activeOrderId) return;
    const current = orders.find((o) => o.id === activeOrderId);
    if (current && (current.status === 'entregue' || current.status === 'cancelado')) {
      setShowOngoingOrderBanner(false);
    }
  }, [orders, activeOrderId]);

  // Cart operations
  const handleAddToCart = (newItem: CartItem) => {
    setCartItems((prev) => {
      const existingIndex = prev.findIndex(
        (i) =>
          i.menuItem.id === newItem.menuItem.id &&
          JSON.stringify(i.selectedChoices) === JSON.stringify(newItem.selectedChoices) &&
          JSON.stringify(i.selectedExtras) === JSON.stringify(newItem.selectedExtras) &&
          i.specialNotes === newItem.specialNotes
      );

      if (existingIndex > -1) {
        const updated = [...prev];
        const existing = updated[existingIndex];
        const newQty = existing.quantity + newItem.quantity;
        updated[existingIndex] = {
          ...existing,
          quantity: newQty,
          totalPrice: existing.unitPrice * newQty,
        };
        return updated;
      }
      return [...prev, newItem];
    });
  };

  // Usado pelo assistente de IA (Fase 4, item 34) — monta um CartItem básico
  // (sem escolhas/extras, que a IA não tem como saber escolher sozinha) e
  // reaproveita a mesma função de adicionar ao carrinho de sempre.
  const handleAiAddToCart = (item: MenuItem, quantity: number) => {
    handleAddToCart({
      id: `${item.id}-${Date.now()}`,
      menuItem: item,
      quantity,
      selectedChoices: [],
      selectedExtras: [],
      unitPrice: item.price,
      totalPrice: item.price * quantity,
    });
  };

  const handleUpdateCartQuantity = (id: string, delta: number) => {
    setCartItems((prev) => {
      return prev
        .map((item) => {
          if (item.id === id) {
            const newQty = item.quantity + delta;
            if (newQty <= 0) return null;
            return {
              ...item,
              quantity: newQty,
              totalPrice: item.unitPrice * newQty,
            };
          }
          return item;
        })
        .filter(Boolean) as CartItem[];
    });
  };

  const handleRemoveCartItem = (id: string) => {
    setCartItems((prev) => prev.filter((i) => i.id !== id));
  };

  const handleClearCart = () => {
    setCartItems([]);
  };

  const handleApplyCoupon = (code: string): boolean => {
    const coupon = COUPONS[code];
    if (coupon) {
      setAppliedCoupon(code);
      playSoundEffect('beep');
      return true;
    }
    return false;
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
  };

  // Favorites toggle
  const handleToggleFavorite = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavorites((prev) => {
      const isFav = prev.includes(id);
      playSoundEffect('beep');
      if (isFav) {
        return prev.filter((favId) => favId !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  // Order Placement
  const handleOrderPlaced = (order: Order, openWhatsApp: boolean) => {
    setOrders((prev) => [order, ...prev]);
    setActiveOrderId(order.id);
    setShowOngoingOrderBanner(true);
    setCartItems([]);
    if (!openWhatsApp) {
      setIsOrderStatusOpen(true);
    }
    // Envia o pedido pro backend, pra aparecer no painel do admin (super-admin)
    createOrder(restaurantSlug, order, customerToken || undefined).catch((err) => {
      console.error('Não foi possível enviar o pedido ao servidor:', err);
    });
  };

  // Filtered menu items
  const filteredMenuItems = useMemo(() => {
    return menuItems.filter((item) => {
      // Category filter
      if (activeCategoryId !== 'all' && item.categoryId !== activeCategoryId) {
        return false;
      }
      // Tag filter
      if (selectedTag && !item.tags.includes(selectedTag)) {
        return false;
      }
      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = item.name.toLowerCase().includes(q);
        const matchesDesc = item.description.toLowerCase().includes(q);
        const matchesCategory = item.categoryId.toLowerCase().includes(q);
        if (!matchesName && !matchesDesc && !matchesCategory) return false;
      }
      return true;
    });
  }, [menuItems, activeCategoryId, selectedTag, searchQuery]);

  // Counts per category
  const categoryItemCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    categories.forEach((cat) => {
      counts[cat.id] = menuItems.filter((i) => i.categoryId === cat.id).length;
    });
    return counts;
  }, [categories, menuItems]);

  // Categoria oculta pelo admin (Categorias → ocultar, Fase 4) não aparece na
  // navegação nem na listagem agrupada do cliente — mas os produtos dela
  // continuam existindo no cardápio, só sem uma seção visível enquanto isso.
  const visibleCategories = useMemo(() => categories.filter((c) => c.active !== false), [categories]);

  // Cart total math
  const cartSubtotal = cartItems.reduce((acc, item) => acc + item.totalPrice, 0);
  const cartItemCount = cartItems.reduce((acc, item) => acc + item.quantity, 0);

  let discountAmount = 0;
  if (appliedCoupon && COUPONS[appliedCoupon]) {
    const coupon = COUPONS[appliedCoupon];
    if (coupon.discountPercent) {
      discountAmount = (cartSubtotal * coupon.discountPercent) / 100;
    } else if (coupon.fixedDiscount) {
      discountAmount = Math.min(coupon.fixedDiscount, cartSubtotal);
    }
  }

  // Active / in-progress delivery orders count
  const activeOrdersCount = orders.filter(
    (o) => o.status !== 'entregue' && o.status !== 'cancelado'
  ).length;

  const favoriteMenuItems = menuItems.filter((i) => favorites.includes(i.id));

  // Aguarda o carregamento inicial do cardápio (GET /api/menu) antes de renderizar
  if (isMenuLoading) {
    return (
      <div className="min-h-screen bg-stone-100 flex flex-col items-center justify-center gap-3 text-stone-500">
        <div className="w-10 h-10 border-4 border-stone-300 border-t-orange-600 rounded-full animate-spin" />
        <p className="font-medium">Carregando cardápio...</p>
      </div>
    );
  }

  // Render Admin Dashboard
  // (removido: o painel de administração só é acessível de forma protegida
  // por senha em /admin — ver AdminPortal.tsx. O cliente nunca tem esse acesso.)

  // Restaurante desativado pelo super-admin (Fase 4): não aparece mais na
  // vitrine "/", e quem tiver o link direto do cardápio vê este aviso em vez
  // do cardápio — pedidos continuam bloqueados no backend de qualquer forma
  // (ver POST /api/:slug/orders), isto aqui é só a experiência do cliente.
  if (restaurantConfig.active === false) {
    return (
      <div className="min-h-screen bg-stone-100 flex flex-col items-center justify-center gap-3 text-center px-6">
        <span className="text-4xl">😴</span>
        <p className="font-semibold text-stone-800 text-lg">{restaurantConfig.name || 'Este restaurante'} está temporariamente indisponível</p>
        <p className="text-sm text-stone-500 max-w-xs">Não estamos recebendo pedidos por aqui no momento. Volte mais tarde.</p>
        <button onClick={() => window.location.reload()} className="mt-2 text-sm font-semibold text-[#c9a227] hover:text-[#e2c55d]">
          Tentar novamente
        </button>
      </div>
    );
  }

  // Customer Delivery View
  return (
    <div className={`min-h-screen text-[#f4f0e5] flex flex-col font-sans ${restaurantSlug === 'japones' ? 'jpn-premium' : 'bg-stone-100 text-stone-900'}`} style={getThemeStyle(restaurantSlug, restaurantConfig)}>
      {showSplash && (
        <SplashScreen config={restaurantConfig} onFinish={() => setShowSplash(false)} />
      )}
      <InstallPrompt config={restaurantConfig} />
      {menuLoadError && (
        <div className="bg-amber-100 text-amber-800 text-sm text-center py-1.5 px-4">
          {menuLoadError}
        </div>
      )}
      <div className={`flex-1 flex flex-col mx-auto w-full max-w-full ${restaurantSlug === 'japones' ? 'bg-transparent' : 'bg-white'}`}>
        {/* Restaurant Header */}
        <Header
          config={restaurantConfig}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          selectedTag={selectedTag}
          onTagSelect={setSelectedTag}
          currentAddress={deliveryAddress}
          onOpenAddressModal={() => setIsAddressModalOpen(true)}
          activeOrdersCount={activeOrdersCount}
          onOpenOrders={() => setIsOrderStatusOpen(true)}
          favoritesCount={favorites.length}
          onOpenFavorites={() => setIsFavoritesOpen(true)}
          isCustomerLoggedIn={Boolean(customerAccount)}
          onOpenAccount={() => setIsAccountModalOpen(true)}
          isPushOn={isPushOn}
          onTogglePush={handleTogglePush}
          onScrollToMenu={() => document.getElementById('menu-content')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
        />

        {/* "Você possui um pedido em andamento" — reaparece se o cliente
            fechar o navegador e voltar com um pedido ainda não entregue */}
        {showOngoingOrderBanner && activeOrderId && (() => {
          const ongoingOrder = orders.find((o) => o.id === activeOrderId);
          if (!ongoingOrder) return null;
          const statusLabels: Record<string, string> = {
            recebido: 'Pedido recebido',
            em_preparo: 'Preparando',
            pronto: 'Pronto',
            saiu_entrega: 'Saiu para entrega',
          };
          return (
            <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 pt-5">
              <div className="bg-[#0d1212] text-white rounded-2xl p-3 sm:p-4 flex flex-wrap items-center justify-between gap-3 shadow-xl border border-white/10">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[var(--brand)] text-slate-950 flex items-center justify-center flex-shrink-0">
                    <ShoppingBag className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-[11px] text-stone-300 font-semibold">Você possui um pedido em andamento</p>
                    <p className="text-sm font-black">
                      Pedido #{ongoingOrder.orderNumber} — {statusLabels[ongoingOrder.status] || ongoingOrder.status}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {customerToken && <span className={`text-[10px] font-bold px-2 py-1 rounded-lg border ${orderRealtimeState === 'online' ? 'text-emerald-300 border-emerald-400/20 bg-emerald-400/10' : 'text-stone-400 border-white/10'}`}>● {orderRealtimeState === 'online' ? 'Sincronizado' : orderRealtimeState === 'reconnecting' ? 'Reconectando' : 'Atualizando'}</span>}
                  <button
                    onClick={() => setIsOrderStatusOpen(true)}
                    className="px-4 py-2 rounded-xl bg-[var(--brand)] hover:bg-[var(--brand-light)] text-slate-950 text-xs font-black flex items-center gap-1.5"
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>Acompanhar Pedido</span>
                  </button>
                  <button
                    onClick={() => setShowOngoingOrderBanner(false)}
                    className="p-2 rounded-xl text-stone-400 hover:text-white hover:bg-stone-800"
                    title="Dispensar aviso"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Category Navigation Bar */}
        <CategoryNav
          categories={visibleCategories}
          activeCategoryId={activeCategoryId}
          onSelectCategory={setActiveCategoryId}
          categoryItemCounts={categoryItemCounts}
        />

        {/* Banner de Promoções — 100% configurável pelo painel (Dados do
            Restaurante), sem nenhum texto fixo. Some completamente se o
            restaurante não cadastrar nenhuma promoção. */}
        {(restaurantConfig.promoBadges || []).length > 0 && (
          <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 pt-5 space-y-2">
            {(restaurantConfig.promoBadges || []).map((badge) => (
              <div
                key={badge.id}
                className={`${restaurantSlug === 'japones' ? 'bg-[#101716] text-[#f4f0e5] border-[#c9a227]/20' : 'bg-gradient-to-r from-[var(--brand)] via-[var(--brand-light)] to-[var(--brand)] text-slate-950 border-[var(--brand-light)]'} rounded-2xl p-3 sm:p-4 flex flex-wrap items-center justify-between gap-3 shadow-lg border`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-950 text-[var(--brand-light)] flex items-center justify-center flex-shrink-0 text-lg">
                    {badge.icon || <Bike className="w-5 h-5" />}
                  </div>
                  <div>
                    <p className="text-xs sm:text-sm font-black tracking-tight">{badge.title}</p>
                    {badge.subtitle && (
                      <p className="text-[11px] font-semibold text-slate-800">{badge.subtitle}</p>
                    )}
                  </div>
                </div>

                {badge.couponCode && (
                  <button
                    onClick={() => handleApplyCoupon(badge.couponCode!)}
                    className="px-3 py-1.5 bg-slate-950 hover:bg-slate-800 text-[var(--brand-light)] rounded-xl text-xs font-black transition-transform active:scale-95 flex items-center gap-1.5"
                  >
                    <Percent className="w-3.5 h-3.5" />
                    <span>Aplicar Cupom</span>
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Main Menu Grid Content */}
        <main id="menu-content" className={`max-w-7xl mx-auto w-full px-4 sm:px-6 py-8 sm:py-10 flex-1 space-y-8 ${restaurantSlug === 'japones' ? 'jpn-reveal' : ''}`}>
          {/* Active Filter indicator */}
          {(searchQuery || selectedTag || activeCategoryId !== 'all') && (
            <div className="flex items-center justify-between bg-stone-50 p-3 rounded-2xl border border-stone-200 text-xs">
              <span className="text-[#a8aaa2] font-medium">
                Exibindo resultados para:{' '}
                <strong>
                  {searchQuery ? `"${searchQuery}"` : ''}
                  {selectedTag ? ` [Tag: ${selectedTag}]` : ''}
                  {activeCategoryId !== 'all'
                    ? ` [Categoria: ${categories.find((c) => c.id === activeCategoryId)?.name}]`
                    : ''}
                </strong>{' '}
                ({filteredMenuItems.length} encontrados)
              </span>

              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedTag(null);
                  setActiveCategoryId('all');
                }}
                className="text-[#e2c55d] hover:text-white font-bold underline"
              >
                Limpar filtros
              </button>
            </div>
          )}

          {/* Group by category or flat list */}
          {activeCategoryId === 'all' && !searchQuery && !selectedTag ? (
            <div className="space-y-10">
              {visibleCategories.map((cat) => {
                const itemsInCat = menuItems.filter((i) => i.categoryId === cat.id);
                if (itemsInCat.length === 0) return null;

                return (
                  <section key={cat.id} id={`category-section-${cat.id}`} className="space-y-3">
                    <div className="border-b border-white/10 pb-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <h2 className={`${restaurantSlug === 'japones' ? 'jpn-display text-[#f4f0e5]' : 'text-stone-900'} text-xl sm:text-2xl font-semibold tracking-wide`}>
                          {cat.name}
                        </h2>
                        <span className="text-xs bg-white/5 border border-white/10 text-[#a8aaa2] px-2 py-0.5 rounded-full font-bold">
                          {itemsInCat.length}
                        </span>
                      </div>
                      {cat.description && (
                        <p className="text-xs text-[#7f847d] hidden sm:block">{cat.description}</p>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                      {itemsInCat.map((item) => (
                        <ProductCard
                          key={item.id}
                          item={item}
                          onSelect={(dish) => setSelectedProduct(dish)}
                          isFavorite={favorites.includes(item.id)}
                          onToggleFavorite={handleToggleFavorite}
                          restaurantConfig={restaurantConfig}
                        />
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          ) : (
            <div>
              {filteredMenuItems.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-3xl border border-stone-200 shadow-xs">
                  <div className="w-16 h-16 rounded-full bg-stone-100 flex items-center justify-center mx-auto mb-3">
                    <ShoppingBag className="w-8 h-8 text-stone-400" />
                  </div>
                  <h3 className="font-extrabold text-stone-800 text-base">Nenhum prato encontrado</h3>
                  <p className="text-xs text-stone-500 mt-1 max-w-xs mx-auto">
                    Tente buscar por outro termo ou remova os filtros selecionados.
                  </p>
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedTag(null);
                      setActiveCategoryId('all');
                    }}
                    className="mt-4 px-4 py-2 rounded-xl bg-[var(--brand)] hover:bg-[var(--brand-light)] text-slate-950 font-bold text-xs shadow-xs"
                  >
                    Ver Todo o Cardápio
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                  {filteredMenuItems.map((item) => (
                    <ProductCard
                      key={item.id}
                      item={item}
                      onSelect={(dish) => setSelectedProduct(dish)}
                      isFavorite={favorites.includes(item.id)}
                      onToggleFavorite={handleToggleFavorite}
                      restaurantConfig={restaurantConfig}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </main>

        {/* Floating Mobile Cart Trigger Bar */}
        {cartItems.length > 0 && (
          <div className="sticky bottom-3 inset-x-0 z-40 px-4 max-w-md mx-auto pointer-events-auto">
            <button
              id="floating-cart-bar"
              onClick={() => setIsCartOpen(true)}
              className="w-full py-3.5 px-4 rounded-2xl bg-[var(--brand)] hover:bg-[var(--brand-light)] active:scale-[0.98] text-slate-950 font-black text-sm flex items-center justify-between transition-all shadow-xl border border-[var(--brand-light)] ring-4 ring-[var(--brand)]/20"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-slate-950 text-[var(--brand-light)] flex items-center justify-center text-xs font-black">
                  {cartItemCount}
                </div>
                <span>Ver Sacola Delivery</span>
              </div>
              <span className="bg-slate-950 text-[var(--brand-light)] px-3 py-1 rounded-xl text-xs font-black">
                {formatCurrency(cartSubtotal - discountAmount)}
              </span>
            </button>
          </div>
        )}

        {/* Delivery Footer */}
        <footer className={`${restaurantSlug === 'japones' ? 'bg-[#050707] text-[#858a83] border-white/5' : 'bg-stone-900 text-stone-400 border-stone-800'} text-xs py-10 px-4 sm:px-6 border-t mt-14`}>
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
            <div>
              <p className="jpn-display font-semibold text-[#f4f0e5] text-base flex items-center justify-center sm:justify-start gap-2">
                <span>{restaurantConfig.name}</span>
                <span className="text-[9px] uppercase tracking-[.16em] text-[#c9a227] border border-[#c9a227]/20 px-2 py-1 rounded-full">
                  Delivery
                </span>
              </p>
              <p className="text-[11px] text-stone-400 mt-0.5">{restaurantConfig.address}</p>
              <p className="text-[11px] text-stone-500 mt-0.5">
                {restaurantConfig.openingHours} • WhatsApp: {restaurantConfig.phone}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsAddressModalOpen(true)}
                className="px-3 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-semibold flex items-center gap-1"
              >
                <MapPin className="w-3.5 h-3.5 text-[var(--brand)]" />
                <span>Trocar Endereço</span>
              </button>

            </div>
          </div>
        </footer>
      </div>

      {/* Product Customization Modal */}
      <ProductModal
        item={selectedProduct}
        isOpen={!!selectedProduct}
        onClose={() => setSelectedProduct(null)}
        onAddToCart={handleAddToCart}
        restaurantConfig={restaurantConfig}
      />

      {/* Cart Drawer */}
      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        items={cartItems}
        onUpdateQuantity={handleUpdateCartQuantity}
        onRemoveItem={handleRemoveCartItem}
        onClearCart={handleClearCart}
        appliedCoupon={appliedCoupon}
        onApplyCoupon={handleApplyCoupon}
        onRemoveCoupon={handleRemoveCoupon}
        restaurantConfig={restaurantConfig}
        currentAddress={deliveryAddress}
        onOpenAddressModal={() => {
          setIsCartOpen(false);
          setIsAddressModalOpen(true);
        }}
        onProceedToCheckout={() => setIsCheckoutOpen(true)}
      />

      {/* Checkout Modal */}
      <CheckoutModal
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        items={cartItems}
        appliedCoupon={appliedCoupon}
        discountAmount={discountAmount}
        restaurantConfig={restaurantConfig}
        currentAddress={deliveryAddress}
        onOpenAddressModal={() => setIsAddressModalOpen(true)}
        onOrderPlaced={handleOrderPlaced}
      />

      {/* Delivery Address Modal (CEP lookup) */}
      <DeliveryAddressModal
        isOpen={isAddressModalOpen}
        onClose={() => setIsAddressModalOpen(false)}
        currentAddress={deliveryAddress}
        onSaveAddress={(newAddr) => {
          setDeliveryAddress(newAddr);
          playSoundEffect('success');
        }}
        deliveryZones={restaurantConfig.deliveryZones || []}
      />

      {/* Order Status & Real-Time Delivery Tracker */}
      <OrderStatusModal
        isOpen={isOrderStatusOpen}
        onClose={() => setIsOrderStatusOpen(false)}
        orders={orders}
        activeOrderId={activeOrderId}
        onSelectOrder={setActiveOrderId}
        restaurantConfig={restaurantConfig}
        liveOperationalAdjustment={liveOperationalAdjustment}
      />

      {/* Favorites Modal */}
      <FavoritesModal
        isOpen={isFavoritesOpen}
        onClose={() => setIsFavoritesOpen(false)}
        favorites={favoriteMenuItems}
        onSelectDish={(dish) => setSelectedProduct(dish)}
        onRemoveFavorite={(id) =>
          setFavorites((prev) => prev.filter((favId) => favId !== id))
        }
      />

      {/* Minha Conta — login/cadastro, endereços salvos, histórico (Fase 4, itens 20-22) */}
      <CustomerAccountModal
        isOpen={isAccountModalOpen}
        onClose={() => setIsAccountModalOpen(false)}
        token={customerToken}
        customer={customerAccount}
        onLoggedIn={handleCustomerLoggedIn}
        onLoggedOut={handleCustomerLoggedOut}
        onUseAddress={handleUseSavedAddress}
      />

      {/* 🤖 Assistente do Restaurante (Fase 4, itens 32-38) */}
      <AssistantChat
        slug={restaurantSlug}
        restaurantName={restaurantConfig.name}
        customerToken={customerToken}
        activeOrderId={activeOrderId}
        menuItems={menuItems}
        onAddItemToCart={handleAiAddToCart}
      />
    </div>
  );
}
