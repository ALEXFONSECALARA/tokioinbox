import React, { useState } from 'react';
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
import { AdminLayout } from './components/Admin/AdminLayout';
import { MenuItem, Order, RestaurantSlug } from './types/restaurant';
import { ShoppingBag, Clock, Home, Utensils, ShieldCheck } from 'lucide-react';

function AppContent() {
  const publicSlugMap: Record<string, RestaurantSlug> = { 'japones':'japones', 'sakura-sushi-house':'japones', 'italiano':'italiano', 'cantina-bella-vista':'italiano', 'pizza':'pizza', 'forno-doro-pizzeria':'pizza', 'hamburgueria':'hamburgueria', 'burger-craft-beer':'hamburgueria' };
  const routeSlug = typeof window !== 'undefined' ? window.location.pathname.match(/^\/r\/([^/]+)/)?.[1] : undefined;
  const independentPublic = Boolean(routeSlug && publicSlugMap[routeSlug]);
  const {
    currentRestaurant,
    setActiveRestaurantSlug,
    cart,
    cartItemCount,
    cartTotal,
  } = useStore();

  // Navigation View: 'home' | 'menu' | 'admin'
  const [view, setView] = useState<'home' | 'menu' | 'admin'>('home');

  // Modals state
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<MenuItem | null>(null);
  const [isTrackerOpen, setIsTrackerOpen] = useState(false);
  const [trackedOrderId, setTrackedOrderId] = useState<string | null>(null);

  // Splash Screen control
  const [showSplash, setShowSplash] = useState(false);

  React.useEffect(() => { if (independentPublic && routeSlug) { const slug = publicSlugMap[routeSlug]; setActiveRestaurantSlug(slug); setView('menu'); } }, [independentPublic, routeSlug]);

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
    return <AdminLayout onBackToApp={() => setView('menu')} />;
  }

  return (
    <div className="min-h-screen bg-matte-black text-slate-100 flex flex-col font-sans selection:bg-amber-500 selection:text-black">
      {/* Top Navbar */}
      <Navbar
        independent={independentPublic}
        onOpenCart={() => setIsCartOpen(true)}
        onOpenAdmin={() => setView('admin')}
        onOpenTracker={() => {
          setTrackedOrderId(null);
          setIsTrackerOpen(true);
        }}
        onNavigateHome={() => setView('home')}
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
            onClick={() => setView('admin')}
            className="flex flex-col items-center gap-1 py-1 px-3 rounded-xl text-slate-400 hover:text-white transition-all"
          >
            <ShieldCheck className="w-5 h-5" />
            <span className="text-[10px]">Admin</span>
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

      {/* Subdued Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/80 py-8 text-center text-xs text-slate-500 space-y-2 mt-auto">
        <p className="font-semibold text-slate-400">
          Tokio inBox • Plataforma Multicardápio &amp; Gestão de Restaurantes 1.0.0
        </p>
        <p className="text-[11px] text-slate-600">
          Sakura Sushi House • Cantina Bella Vista • Forno D&apos;Oro Pizzeria • Burger Craft &amp; Beer
        </p>
      </footer>
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
