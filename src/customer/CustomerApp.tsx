import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../context/StoreContext';
import { Navbar } from '../components/Navbar';
import { HomeHub } from '../components/HomeHub';
import { RestaurantHeader } from '../components/RestaurantHeader';
import { MenuSection } from '../components/MenuSection';
import { ProductModal } from '../components/ProductModal';
import { CartDrawer } from '../components/CartDrawer';
import { CheckoutModal } from '../components/CheckoutModal';
import { OrderTrackerModal } from '../components/OrderTrackerModal';
import { SplashScreen } from '../components/SplashScreen';
import { CustomerAuthModal } from '../components/CustomerAuthModal';
import { CustomerAiConciergeModal } from '../components/CustomerAiConciergeModal';
import { PwaInstallationBanner } from '../components/PwaInstallationBanner';
import { ClienteModule } from '../modules/cliente/ClienteModule';
import { MenuItem, Order, RestaurantSlug } from '../types/restaurant';
import { getRestaurantPath, resolveRestaurantFromUrlPath, updateBrowserUrl } from '../utils/urlRouting';
import { BRAND_CONFIG, BRAND_NAME } from '../config/brand';
import { ShoppingBag, Clock, Utensils, Sparkles, User } from 'lucide-react';

/**
 * CARDÁPIO DO CLIENTE
 * Aplicativo público, totalmente separado do painel do restaurante.
 * Não importa nenhum componente de administração, KDS, PDV, caixa ou entregador,
 * e não exibe nenhum atalho, botão ou link para essas áreas.
 */

type CustomerView = 'home' | 'menu' | 'client_table';

// Primeiros segmentos de caminho que NÃO são restaurantes
const RESERVED_SEGMENTS = new Set(['login', 'cadastro', 'minha-conta', 'meus-pedidos', 'pedido', 'mesa', 'restaurantes', 'cliente', 'api', 'assets']);

function parseTableFromLocation(): { table: number; restaurantSegment?: string; accessToken?: string } | null {
  if (typeof window === 'undefined') return null;
  const path = window.location.pathname;
  const pathMatch = path.match(/^\/(?:([^/]+)\/)?mesa\/(\d+)/i);
  if (pathMatch) {
    const table = parseInt(pathMatch[2], 10);
    if (table > 0) {
      try {
        const token = new URLSearchParams(window.location.search).get('mesa_token') || undefined;
        return { table, restaurantSegment: pathMatch[1], accessToken: token };
      } catch {
        return { table, restaurantSegment: pathMatch[1] };
      }
    }
  }
  try {
    const params = new URLSearchParams(window.location.search);
    const val = params.get('mesa') || params.get('table');
    if (val) {
      const num = parseInt(val, 10);
      if (!isNaN(num) && num > 0) return { table: num, restaurantSegment: params.get('r') || undefined, accessToken: params.get('mesa_token') || undefined };
    }
  } catch {
    /* ignore */
  }
  const hashMatch = window.location.hash.toLowerCase().match(/(?:mesa|table)[=/](\d+)/);
  if (hashMatch) return { table: parseInt(hashMatch[1], 10), accessToken: undefined };
  return null;
}

export function CustomerApp() {
  const { restaurants, currentRestaurant, setActiveRestaurantSlug, cartItemCount, cartTotal } = useStore();

  const initialTable = useRef(parseTableFromLocation()).current;
  const hasSignedTableEntry = Boolean(initialTable?.table && initialTable?.accessToken && initialTable?.restaurantSegment);
  // A raiz do domínio é o único endereço público oficial do cardápio online.
  // /cardapio não é mais uma rota pública do cliente.
  const publicMenuEntry = typeof window !== 'undefined' &&
    (window.location.pathname.replace(/\/+$/, '') === '');
  const [view, setView] = useState<CustomerView>(
    hasSignedTableEntry ? 'client_table' : publicMenuEntry ? 'menu' : 'home'
  );
  const [clientTableNumber] = useState<number>(initialTable?.table || 1);
  const [clientTableAccessToken] = useState<string | undefined>(initialTable?.accessToken);

  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<MenuItem | null>(null);
  const [isTrackerOpen, setIsTrackerOpen] = useState(false);
  const [trackedOrderId, setTrackedOrderId] = useState<string | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register' | 'account' | 'recovery'>('login');
  const [isConciergeOpen, setIsConciergeOpen] = useState(false);
  const [showSplash, setShowSplash] = useState(false);

  // Link direto do restaurante (ex.: /SakuraSushiHouse ou /SakuraSushiHouse/mesa/3):
  // resolvido assim que o catálogo do servidor estiver disponível.
  const pendingPathRef = useRef<string | null>(
    (() => {
      if (typeof window === 'undefined') return null;
      const first = window.location.pathname.split('/').filter(Boolean)[0];
      if (initialTable?.restaurantSegment) return initialTable.restaurantSegment;
      if (first && !RESERVED_SEGMENTS.has(first.toLowerCase())) return first;
      return null;
    })()
  );

  // A raiz do domínio é a entrada pública do cardápio.
  // Ela não deve ficar presa na vitrine inicial nem depender de um slug na URL.
  useEffect(() => {
    if (!publicMenuEntry || initialTable) return;
    const available = Object.values(restaurants).find((r) =>
      r && r.isActive !== false && r.vitrineStatus !== 'OCULTO' && r.isActiveInVitrine !== false
    );
    if (available) {
      setActiveRestaurantSlug(available.slug);
      setView('menu');
      if (!sessionStorage.getItem(`splash_dismissed_${available.slug}`)) setShowSplash(true);
    }
  }, [restaurants, publicMenuEntry, initialTable]);

  useEffect(() => {
    const seg = pendingPathRef.current;
    if (!seg) return;
    const rest = resolveRestaurantFromUrlPath(`/${seg}`, restaurants);
    if (rest) {
      pendingPathRef.current = null;
      setActiveRestaurantSlug(rest.slug);
      if (!initialTable) {
        setView('menu');
        const dismissed = sessionStorage.getItem(`splash_dismissed_${rest.slug}`);
        if (!dismissed) setShowSplash(true);
      }
    }
  }, [restaurants]);

  // Rotas de conta e rastreio do cliente
  useEffect(() => {
    const path = window.location.pathname.toLowerCase();
    if (path.startsWith('/login')) {
      setAuthModalMode('login');
      setIsAuthModalOpen(true);
    } else if (path.startsWith('/cadastro')) {
      setAuthModalMode('register');
      setIsAuthModalOpen(true);
    } else if (path.startsWith('/minha-conta') || path.startsWith('/meus-pedidos')) {
      setAuthModalMode('account');
      setIsAuthModalOpen(true);
    } else if (path.startsWith('/pedido/')) {
      const id = window.location.pathname.split('/pedido/')[1]?.split('/')[0]?.split('?')[0];
      if (id) {
        setTrackedOrderId(id);
        setIsTrackerOpen(true);
      }
    }
  }, []);

  const handleSelectRestaurant = (slug: RestaurantSlug) => {
    setActiveRestaurantSlug(slug);
    setView('menu');
    const rest = restaurants[slug];
    if (rest) updateBrowserUrl(getRestaurantPath(rest));
    if (!sessionStorage.getItem(`splash_dismissed_${slug}`)) setShowSplash(true);
    window.scrollTo({ top: 0 });
  };

  const goHome = () => {
    setView('home');
    updateBrowserUrl('/');
  };

  const openTracker = () => {
    setTrackedOrderId(null);
    setIsTrackerOpen(true);
  };

  const handleOrderCreated = (order: Order) => {
    setTrackedOrderId(order.id);
    setIsTrackerOpen(true);
  };

  // Pedido feito pelo QR Code da mesa
  if (view === 'client_table' && hasSignedTableEntry) {
    return <ClienteModule tableNumber={clientTableNumber} tableAccessToken={clientTableAccessToken} onExitToHome={goHome} />;
  }

  return (
    <div className="min-h-screen bg-matte-black text-slate-100 flex flex-col font-sans selection:bg-amber-500 selection:text-black">
      <Navbar
        onOpenCart={() => setIsCartOpen(true)}
        onOpenTracker={openTracker}
        onNavigateHome={goHome}
        onOpenAuth={() => {
          setAuthModalMode('account');
          setIsAuthModalOpen(true);
        }}
        currentView={view === 'menu' ? 'menu' : 'home'}
        setCurrentView={(v) => (v === 'home' ? goHome() : setView('menu'))}
      />

      {/* BUG CORRIGIDO: `onClaimSuccess` não existe no componente (fluxo de
          resgate de cupom foi removido dele em algum momento) — o callback
          nunca era chamado, e o `alert()` de "parabéns" nunca aparecia. A
          única prop real hoje é `onOpenCustomerArea`, que abre a área do
          cliente onde o cupom de boas-vindas pode ser resgatado. */}
      <PwaInstallationBanner
        onOpenCustomerArea={() => {
          setAuthModalMode('account');
          setIsAuthModalOpen(true);
        }}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {view === 'home' ? (
          <HomeHub onSelectRestaurant={handleSelectRestaurant} onOpenTracker={openTracker} />
        ) : (
          currentRestaurant ? (
            <div className="space-y-6">
              <RestaurantHeader restaurant={currentRestaurant} allowTableOrders={hasSignedTableEntry} />
              <MenuSection restaurantSlug={currentRestaurant.slug} onSelectProduct={(item) => setSelectedProduct(item)} />
            </div>
          ) : (
            <div className="min-h-[50vh] flex items-center justify-center">
              <div className="text-center rounded-2xl border border-amber-500/20 bg-black/40 p-8">
                <div className="text-amber-300 font-black text-lg">Carregando cardápio...</div>
                <div className="text-slate-400 text-sm mt-2">Aguarde a conexão com o catálogo do restaurante.</div>
              </div>
            </div>
          )
        )}
      </main>

      {/* Atendente virtual */}
      <button
        onClick={() => setIsConciergeOpen(true)}
        className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-30 p-3 sm:px-4 sm:py-3 rounded-2xl bg-gradient-to-r from-[#E3BD6A] via-[#C99C3D] to-[#8F6A1E] text-slate-950 font-black text-xs sm:text-sm shadow-lg flex items-center gap-2"
        title="Falar com o Atendente Virtual IA"
      >
        <Sparkles className="w-5 h-5" />
        <span className="hidden sm:inline">IA Atendente / Sommelier</span>
      </button>

      {/* Barra do carrinho */}
      {cartItemCount > 0 && !isCartOpen && !isCheckoutOpen && (
        <div className="fixed bottom-4 left-4 right-4 z-40 max-w-md mx-auto">
          <button
            onClick={() => setIsCartOpen(true)}
            className="w-full py-3.5 px-5 bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-400 text-slate-950 font-black text-sm rounded-2xl shadow-lg flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-slate-950 text-amber-300 flex items-center justify-center font-black text-xs border border-amber-500/40">
                {cartItemCount}
              </div>
              <span className="tracking-tight">Ver Carrinho de Pedidos</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-base font-black">R$ {cartTotal.toFixed(2)}</span>
              <ShoppingBag className="w-5 h-5" />
            </div>
          </button>
        </div>
      )}

      {/* Barra inferior (mobile) */}
      {cartItemCount === 0 && !isCartOpen && !isCheckoutOpen && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-[#0c0c10]/95 backdrop-blur-xl border-t border-amber-500/20 px-3 py-2 flex items-center justify-around">
          <button onClick={() => setView('menu')} className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl ${view === 'menu' ? 'text-amber-400 font-bold' : 'text-slate-400'}`}>
            <Utensils className="w-5 h-5" />
            <span className="text-[10px]">Cardápio</span>
          </button>
          <button onClick={openTracker} className="flex flex-col items-center gap-1 py-1 px-3 rounded-xl text-slate-400 hover:text-white">
            <Clock className="w-5 h-5" />
            <span className="text-[10px]">Pedidos</span>
          </button>
          <button
            onClick={() => {
              setAuthModalMode('account');
              setIsAuthModalOpen(true);
            }}
            className="flex flex-col items-center gap-1 py-1 px-3 rounded-xl text-slate-400 hover:text-[#E3BD6A]"
          >
            <User className="w-5 h-5" />
            <span className="text-[10px]">Conta</span>
          </button>
          <button onClick={() => setIsCartOpen(true)} className="flex flex-col items-center gap-1 py-1 px-3 rounded-xl text-slate-400 hover:text-white">
            <ShoppingBag className="w-5 h-5" />
            <span className="text-[10px]">Sacola</span>
          </button>
        </div>
      )}

      {showSplash && currentRestaurant?.splashEnabled && (
        <SplashScreen
          restaurant={currentRestaurant}
          onClose={() => {
            setShowSplash(false);
            sessionStorage.setItem(`splash_dismissed_${currentRestaurant.slug}`, 'true');
          }}
        />
      )}

      {selectedProduct && <ProductModal product={selectedProduct} onClose={() => setSelectedProduct(null)} />}

      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        onProceedToCheckout={() => {
          setIsCartOpen(false);
          setIsCheckoutOpen(true);
        }}
      />

      {isCheckoutOpen && <CheckoutModal onClose={() => setIsCheckoutOpen(false)} onOrderPlaced={handleOrderCreated} />}

      {isTrackerOpen && (
        <OrderTrackerModal
          defaultOrderId={trackedOrderId}
          onClose={() => {
            setIsTrackerOpen(false);
            setTrackedOrderId(null);
          }}
        />
      )}

      {isAuthModalOpen && (
        <CustomerAuthModal
          isOpen={isAuthModalOpen}
          initialMode={authModalMode}
          onClose={() => setIsAuthModalOpen(false)}
          onOrderClick={(orderId) => {
            setTrackedOrderId(orderId);
            setIsTrackerOpen(true);
          }}
        />
      )}

      {isConciergeOpen && currentRestaurant && (
        <CustomerAiConciergeModal
          restaurantSlug={currentRestaurant.slug}
          restaurantName={currentRestaurant.name}
          onClose={() => setIsConciergeOpen(false)}
          onAddToCart={(item) => {
            setIsConciergeOpen(false);
            setSelectedProduct(item);
          }}
        />
      )}

      <footer className="mt-10 border-t border-[#C5A880]/20 bg-[#080808] px-4 py-7 sm:py-9 pb-20">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-center gap-4 text-center sm:text-left">
          <div className="shrink-0" aria-label="NEXORO FOOD SYSTEM">
            <BrandLogo size="md" showTagline={false} />
          </div>
          <div className="space-y-1">
            <div className="text-sm sm:text-base font-black tracking-[0.12em] text-white uppercase">
              NEXORO FOOD SYSTEM
            </div>
            <div className="text-xs sm:text-sm font-semibold text-[#C5A880]">
              MAIS QUE PEDIDOS, UMA EXPERIÊNCIA COMPLETA. • Cozinhas Nobres em Pedido Único
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
