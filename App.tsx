import React, { useState, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './utils/index.css';
import { StoreProvider, useStore } from './context/StoreContext';
import { Navbar } from './components/Navbar';
import { HomeHub } from './components/HomeHub';
import { RestaurantHeader } from './components/RestaurantHeader';
import { MenuSection } from './components/MenuSection';
import { ProductModal } from './components/ProductModal';
import { CartDrawer } from './components/CartDrawer';
import { CheckoutModal } from './components/CheckoutModal';
import { OrderTrackerModal } from './components/OrderTrackerModal';
import { SplashScreen } from './components/SplashScreen';
import { AdminLayout } from './components/AdminLayout';
import { MenuItem, Order, RestaurantSlug } from './types/restaurant';
import { ShoppingBag, Clock, Home, Utensils, ShieldCheck, Sparkles, User, Bike } from 'lucide-react';
import { CustomerAuthModal } from './components/CustomerAuthModal';
import { CustomerAiConciergeModal } from './components/CustomerAiConciergeModal';
import { CourierPortal } from './components/CourierPortal';
import { PwaInstallationBanner } from './components/PwaInstallationBanner';
import { TesterFloatingBar } from './components/TesterFloatingBar';
import { BRAND_CONFIG, BRAND_NAME, BRAND_SHORT_NAME } from './config/brand';
import { AuthProvider, useAuth } from './context/AuthContext';
import { OperacaoRouter } from './components/OperacaoRouter';

function AdminLoginScreen({
  onLogin,
  loading,
  error,
}: {
  onLogin: (username: string, password: string) => Promise<any>;
  loading: boolean;
  error: string | null;
}) {
  const [username, setUsername] = React.useState('admin');
  const [password, setPassword] = React.useState('');

  return (
    <div className="min-h-screen bg-[#07090E] text-white flex items-center justify-center p-4">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          await onLogin(username.trim(), password);
        }}
        className="w-full max-w-sm space-y-4 rounded-2xl border border-white/10 bg-[#0E121B] p-6"
      >
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <ShieldCheck size={20} /> Super Admin
        </h1>
        <p className="text-xs text-slate-400">Acesso administrativo por usuário e senha.</p>
        <input
          type="text"
          required
          autoComplete="username"
          placeholder="Nome de usuário"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2.5 text-sm"
        />
        <input
          type="password"
          required
          autoComplete="current-password"
          placeholder="Senha"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2.5 text-sm"
        />
        {error && <p className="text-rose-400 text-sm">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-white text-black py-2.5 text-sm font-semibold disabled:opacity-50"
        >
          {loading ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}

function AdminAuthGate({ children }: { children: React.ReactNode }) {
  // Super Admin usa a autenticação administrativa interna (username/senha),
  // separada do Supabase Auth usado por equipe/clientes.
  const { currentUser, loginUser, logoutUser } = useStore();
  const [loading, setLoading] = React.useState(false);
  const [authError, setAuthError] = React.useState<string | null>(null);

  const handleAdminLogin = async (username: string, password: string) => {
    setLoading(true);
    setAuthError(null);
    const result = await loginUser(username, password);
    setLoading(false);
    if (!result.success) setAuthError(result.error || 'Usuário ou senha incorretos.');
    return result;
  };

  const isAuthenticated = Boolean(currentUser);
  const isSuperAdmin = currentUser?.role === 'super_admin';

  if (loading) {
    return (
      <div className="min-h-screen bg-[#07090E] flex items-center justify-center text-white">
        Carregando…
      </div>
    );
  }
  if (!isAuthenticated) {
    return <AdminLoginScreen onLogin={handleAdminLogin} loading={loading} error={authError} />;
  }
  if (!isSuperAdmin) {
    return (
      <div className="min-h-screen bg-[#07090E] text-white flex items-center justify-center p-6 text-center">
        <div>
          <p className="mb-4">Somente o Super Admin pode acessar esta área.</p>
          <button onClick={() => logoutUser()} className="underline text-white/60 text-sm">Sair</button>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}

function AppContent() {
  const {
    currentRestaurant,
    setActiveRestaurantSlug,
    cart,
    cartItemCount,
    cartTotal,
  } = useStore();

  // FASE 3 — rotas reais (não mais um único painel com atalho de teclado):
  // /operacao, /garcom e /pedidos usam sessão real do Supabase Auth + RBAC
  // do banco, e substituem completamente o antigo hack de Alt+A para essas
  // interfaces operacionais (garçom, caixa, cozinha, sushibar, motoboy).
  const pathname = typeof window !== 'undefined' ? window.location.pathname : '/';
  const isSuperAdminRoute =
    pathname === '/operacao' || pathname.startsWith('/operacao/');
  const isStaffOperationRoute = pathname === '/garcom' || pathname === '/pedidos';

  // /operacao é a entrada do Super Admin e usa o login interno por usuário/senha.
  // /garcom e /pedidos continuam usando Supabase Auth para a equipe operacional.
  if (isSuperAdminRoute) {
    return (
      <AdminAuthGate>
        <div className="pb-16 min-h-screen bg-[#07090E]">
          <AdminLayout onBackToApp={() => { window.location.href = '/'; }} initialTab="dashboard" />
        </div>
      </AdminAuthGate>
    );
  }

  if (isStaffOperationRoute) {
    return (
      <AuthProvider>
        <OperacaoRouter />
      </AuthProvider>
    );
  }

  // Navigation View: 'home' | 'menu' | 'admin' | 'courier'
  const [view, setView] = useState<'home' | 'menu' | 'admin' | 'courier'>(() => {
    if (typeof window !== 'undefined') {
      const search = window.location.search;
      const hash = window.location.hash;
      if (search.includes('admin') || hash.includes('admin') || search.includes('painel')) {
        return 'admin';
      }
      if (search.includes('courier') || search.includes('entregador') || hash.includes('entregador')) {
        return 'courier';
      }
    }
    return 'home';
  });

  const [adminInitialTab, setAdminInitialTab] = useState<any>('dashboard');

  // Listen to keyboard shortcut (Alt+A or Ctrl+Shift+A) or hash changes for administrator access
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.altKey && e.key.toLowerCase() === 'a') || (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'a')) {
        e.preventDefault();
        setView((prev) => (prev === 'admin' ? 'home' : 'admin'));
      }
    };
    const handleHashChange = () => {
      if (window.location.hash.includes('admin')) {
        setView('admin');
      } else if (window.location.hash.includes('entregador')) {
        setView('courier');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('hashchange', handleHashChange);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []);

  // Modals state
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<MenuItem | null>(null);
  const [isTrackerOpen, setIsTrackerOpen] = useState(false);
  const [trackedOrderId, setTrackedOrderId] = useState<string | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isConciergeOpen, setIsConciergeOpen] = useState(false);

  // Splash Screen control
  const [showSplash, setShowSplash] = useState(false);

  const handleSelectRestaurantFromHome = (slug: RestaurantSlug) => {
    setActiveRestaurantSlug(slug);
    setView('menu');
    // If the restaurant has splash enabled and not dismissed this session, show it
    const dismissed = sessionStorage.getItem(`splash_dismissed_${slug}`);
    if (!dismissed) {
      setShowSplash(true);
    }
  };

  const handleOrderCreated = (order: Order) => {
    // Open order tracker automatically for the newly placed order
    setTrackedOrderId(order.id);
    setIsTrackerOpen(true);
  };

  // If viewing Super-Admin
  if (view === 'admin') {
    return (
      <AdminAuthGate>
        <div className="pb-16 min-h-screen bg-[#07090E]">
            <AdminLayout
              onBackToApp={() => setView('home')}
              initialTab={adminInitialTab}
            />
            <TesterFloatingBar
              currentView={view}
              onNavigateView={(nextView, tab) => {
                if (tab) setAdminInitialTab(tab);
                setView(nextView);
              }}
            />
        </div>
      </AdminAuthGate>
    );
  }

  // If viewing Courier Portal
  if (view === 'courier') {
    return (
      <div className="pb-16 min-h-screen bg-[#07090E]">
        <CourierPortal onBackToHome={() => setView('home')} />
        <TesterFloatingBar
          currentView={view}
          onNavigateView={(nextView, tab) => {
            if (tab) setAdminInitialTab(tab);
            setView(nextView);
          }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-matte-black text-slate-100 flex flex-col font-sans selection:bg-amber-500 selection:text-black">
      {/* Top Navbar */}
      <Navbar
        onOpenCart={() => setIsCartOpen(true)}
        onOpenAdmin={() => setView('admin')}
        onOpenTracker={() => {
          setTrackedOrderId(null);
          setIsTrackerOpen(true);
        }}
        onNavigateHome={() => setView('home')}
      />

      {/* PWA Installation & 15% OFF Bonus Banner */}
      <PwaInstallationBanner
        onClaimSuccess={(phone, code) => {
          alert(`Parabéns! Cupom de instalação "${code}" liberado para ${phone}!`);
        }}
      />

      {/* Main App Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {view === 'home' ? (
          <HomeHub
            onSelectRestaurant={handleSelectRestaurantFromHome}
            onOpenTracker={() => {
              setTrackedOrderId(null);
              setIsTrackerOpen(true);
            }}
            onOpenAdmin={() => setView('admin')}
          />
        ) : (
          <div className="space-y-6">
            {/* Restaurant Profile & Modality Switcher */}
            <RestaurantHeader />

            {/* Menu Items with Categories & Search */}
            <MenuSection onSelectProduct={(item) => setSelectedProduct(item)} />
          </div>
        )}
      </main>

      {/* Floating AI Concierge / Sommelier Button */}
      <button
        onClick={() => setIsConciergeOpen(true)}
        className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-30 p-3 sm:px-4 sm:py-3 rounded-2xl bg-gradient-to-r from-[#E3BD6A] via-[#C99C3D] to-[#8F6A1E] text-slate-950 font-black text-xs sm:text-sm shadow-[0_0_25px_rgba(227,189,106,0.5)] flex items-center gap-2 hover:scale-105 active:scale-95 transition-all border border-[#E3BD6A]/50"
        title="Falar com o Atendente Virtual IA"
      >
        <Sparkles className="w-5 h-5 animate-spin" />
        <span className="hidden sm:inline">IA Atendente / Sommelier</span>
      </button>

      {/* Floating Luxury Cart Bar (Mobile Sticky) */}
      {cartItemCount > 0 && !isCartOpen && !isCheckoutOpen && (
        <div className="fixed bottom-4 left-4 right-4 z-40 max-w-md mx-auto">
          <button
            onClick={() => setIsCartOpen(true)}
            className="w-full py-3.5 px-5 bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black text-sm rounded-2xl shadow-[0_0_30px_rgba(245,158,11,0.5)] flex items-center justify-between border border-amber-300 backdrop-blur-md transition-all transform hover:scale-[1.02] active:scale-[0.98]"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-slate-950 text-amber-300 flex items-center justify-center font-black text-xs shadow-inner border border-amber-500/40">
                {cartItemCount}
              </div>
              <span className="tracking-tight">Ver Carrinho de Pedidos</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-base font-black">
                R$ {cartTotal.toFixed(2)}
              </span>
              <ShoppingBag className="w-5 h-5" />
            </div>
          </button>
        </div>
      )}

      {/* Mobile Native App Bottom Bar (Docked when cart bar is not shown) */}
      {cartItemCount === 0 && !isCartOpen && !isCheckoutOpen && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-[#0c0c10]/95 backdrop-blur-xl border-t border-amber-500/20 px-3 py-2 flex items-center justify-around shadow-[0_-10px_25px_rgba(0,0,0,0.8)]">
          <button
            onClick={() => setView('home')}
            className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all ${
              view === 'home' ? 'text-amber-400 font-bold' : 'text-slate-400'
            }`}
          >
            <Home className="w-5 h-5" />
            <span className="text-[10px]">Início</span>
          </button>

          <button
            onClick={() => setView('menu')}
            className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all ${
              view === 'menu' ? 'text-amber-400 font-bold' : 'text-slate-400'
            }`}
          >
            <Utensils className="w-5 h-5" />
            <span className="text-[10px]">Cardápio</span>
          </button>

          <button
            onClick={() => {
              setTrackedOrderId(null);
              setIsTrackerOpen(true);
            }}
            className="flex flex-col items-center gap-1 py-1 px-3 rounded-xl text-slate-400 hover:text-white transition-all"
          >
            <Clock className="w-5 h-5" />
            <span className="text-[10px]">Pedidos</span>
          </button>

          <button
            onClick={() => setIsAuthModalOpen(true)}
            className="flex flex-col items-center gap-1 py-1 px-3 rounded-xl text-slate-400 hover:text-[#E3BD6A] transition-all"
          >
            <User className="w-5 h-5" />
            <span className="text-[10px]">Entrar</span>
          </button>

          <button
            onClick={() => setIsCartOpen(true)}
            className="flex flex-col items-center gap-1 py-1 px-3 rounded-xl text-slate-400 hover:text-white transition-all relative"
          >
            <ShoppingBag className="w-5 h-5" />
            <span className="text-[10px]">Sacola</span>
          </button>
        </div>
      )}

      {/* Overlays and Modals */}
      {/* 1. Splash Screen */}
      {showSplash && currentRestaurant.splashEnabled && (
        <SplashScreen
          restaurant={currentRestaurant}
          onClose={() => {
            setShowSplash(false);
            sessionStorage.setItem(`splash_dismissed_${currentRestaurant.slug}`, 'true');
          }}
        />
      )}

      {/* 2. Product Detail & Variations Modal */}
      {selectedProduct && (
        <ProductModal
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
        />
      )}

      {/* 3. Cart Slide-in Drawer */}
      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        onProceedToCheckout={() => {
          setIsCartOpen(false);
          setIsCheckoutOpen(true);
        }}
      />

      {/* 4. Complete Checkout Modal (PIX, Address, Table, WhatsApp) */}
      {isCheckoutOpen && (
        <CheckoutModal
          onClose={() => setIsCheckoutOpen(false)}
          onOrderPlaced={handleOrderCreated}
        />
      )}

      {/* 5. V7 Realtime Order Tracker */}
      {isTrackerOpen && (
        <OrderTrackerModal
          defaultOrderId={trackedOrderId}
          onClose={() => {
            setIsTrackerOpen(false);
            setTrackedOrderId(null);
          }}
        />
      )}

      {/* 6. Customer Auth & PWA Bonus Modal */}
      {isAuthModalOpen && (
        <CustomerAuthModal
          restaurantSlug={currentRestaurant.slug}
          onClose={() => setIsAuthModalOpen(false)}
          onSuccess={(cust) => {
            alert(`Bem-vindo, ${cust.name || cust.phone}!`);
            setIsAuthModalOpen(false);
          }}
        />
      )}

      {/* 7. Customer AI Concierge Modal */}
      {isConciergeOpen && (
        <CustomerAiConciergeModal
          restaurantSlug={currentRestaurant.slug}
          restaurantName={currentRestaurant.name}
          onClose={() => setIsConciergeOpen(false)}
          onAddToCart={(item) => {
            // Cart interaction
            setIsConciergeOpen(false);
            setSelectedProduct(item);
          }}
        />
      )}

      {/* Subdued Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/80 py-8 text-center text-xs text-slate-500 space-y-2 mt-auto pb-24">
        <p className="font-semibold text-slate-400">
          {BRAND_NAME} • {BRAND_CONFIG.tagline}
        </p>
        <p className="text-[11px] text-slate-600">
          Sakura Sushi House • Cantina Bella Vista • Forno D&apos;Oro Pizzeria • Burger Craft &amp; Beer
        </p>
      </footer>

      {/* Floating Testing Toolbar for quick testing */}
      <TesterFloatingBar
        currentView={view}
        onNavigateView={(nextView, tab) => {
          if (tab) setAdminInitialTab(tab);
          setView(nextView);
        }}
      />
    </div>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <AppContent />
    </StoreProvider>
  );
}

const rootElement = typeof document !== 'undefined' ? document.getElementById('root') : null;
if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}
