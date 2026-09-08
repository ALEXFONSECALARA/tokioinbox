import React from 'react';
import { useStore } from '../../context/StoreContext';
import { RestaurantSlug, OrderType } from '../../types/restaurant';
import {
  ShoppingBag,
  Clock,
  MapPin,
  Utensils,
  ChevronRight,
  ShieldCheck,
  Search,
} from 'lucide-react';

interface NavbarProps {
  currentView?: 'home' | 'menu' | 'admin';
  setCurrentView?: (view: 'home' | 'menu' | 'admin') => void;
  onOpenCart?: () => void;
  onOpenAdmin?: () => void;
  onOpenTracker?: () => void;
  onNavigateHome?: () => void;
  independent?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView = 'home',
  setCurrentView,
  onOpenCart,
  onOpenAdmin,
  onOpenTracker,
  onNavigateHome,
  independent = false,
}) => {
  const {
    restaurants,
    activeRestaurantSlug,
    setActiveRestaurantSlug,
    cart,
    setIsCartOpen,
    orders,
  } = useStore();

  const handleGoHome = () => {
    if (onNavigateHome) onNavigateHome();
    if (setCurrentView) setCurrentView('home');
  };

  const handleGoAdmin = () => {
    if (onOpenAdmin) onOpenAdmin();
    if (setCurrentView) setCurrentView('admin');
  };

  const handleOpenCart = () => {
    if (onOpenCart) onOpenCart();
    else setIsCartOpen(true);
  };

  const currentRestaurant = restaurants[activeRestaurantSlug] || restaurants.japones;
  const cartItemCount = cart.reduce((acc, item) => acc + item.quantity, 0);
  const cartTotal = cart.reduce((acc, item) => acc + item.subtotal, 0);

  // Active pending orders count
  const activeOrdersCount = orders.filter(
    (o) => o.status !== 'entregue' && o.status !== 'cancelado'
  ).length;

  const slugs: RestaurantSlug[] = ['japones', 'italiano', 'pizza', 'hamburgueria'];

  return (
    <header className="sticky top-0 z-40 bg-[#09090d]/95 backdrop-blur-xl border-b border-amber-500/20 shadow-[0_8px_30px_rgba(0,0,0,0.8)]">
      {/* Top Banner Bar */}
      {!independent && <div className="bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-600 text-slate-950 text-xs font-black px-4 py-1 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap">
          <span className="bg-black/80 text-amber-300 px-2 py-0.5 rounded-md text-[10px] font-black tracking-widest uppercase">
            TOKIO INBOX • 4K LUXURY
          </span>
          <span className="text-[11px] sm:text-xs text-slate-950 font-bold">
            Alta Gastronomia • 4 Cozinhas em 1 Pedido Único
          </span>
        </div>
        <div className="hidden sm:flex items-center gap-4 text-slate-950">
          <span className="flex items-center gap-1 text-xs font-extrabold">
            <Clock className="w-3.5 h-3.5" /> Entregas em 30 a 45 min
          </span>
          <button
            onClick={handleGoAdmin}
            className="hover:underline flex items-center gap-1 font-black text-xs min-h-[32px] px-2"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            Super-Admin {activeOrdersCount > 0 && `(${activeOrdersCount})`}
          </button>
        </div>
      </div>}

      {/* Main Navbar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex items-center justify-between gap-3">
        {/* Brand / Logo */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleGoHome}
            className="flex items-center gap-2 group text-left focus:outline-none min-h-[44px]"
            title="Página Inicial - Todos os Restaurantes"
          >
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-400 via-amber-500 to-yellow-500 flex items-center justify-center text-xl shadow-[0_0_15px_rgba(245,158,11,0.4)] group-hover:scale-105 transition-transform">
              🍱
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-black text-lg sm:text-xl text-white tracking-tight">
                  Tokio<span className="text-gold-gradient">inBox</span>
                </span>
                <span className="gold-badge text-[10px] font-black px-1.5 py-0.5 rounded-md uppercase">
                  LUXURY
                </span>
              </div>
              <p className="text-[10px] text-slate-400 hidden sm:block">
                4 cozinhas especializadas integradas
              </p>
            </div>
          </button>

          {/* Breadcrumb in Menu View */}
          {currentView === 'menu' && (
            <div className="hidden md:flex items-center gap-1.5 ml-4 pl-4 border-l border-slate-800">
              <span className="text-xs text-slate-400">Cardápio:</span>
              <span className="text-xs font-bold text-amber-300 flex items-center gap-1 bg-black/60 px-2.5 py-1 rounded-lg border border-amber-500/30">
                {currentRestaurant.emoji} {currentRestaurant.name}
              </span>
            </div>
          )}
        </div>

        {/* Restaurant Quick Tabs (Desktop) */}
        {!independent && <div className="hidden lg:flex items-center gap-1 bg-black/80 p-1 rounded-2xl border border-amber-500/20 backdrop-blur-md">
          <button
            onClick={handleGoHome}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              currentView === 'home'
                ? 'bg-slate-800 text-white font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            🏠 Início
          </button>
          {slugs.map((slug) => {
            const rest = restaurants[slug];
            if (!rest) return null;
            const isSelected = currentView === 'menu' && activeRestaurantSlug === slug;
            return (
              <button
                key={slug}
                onClick={() => {
                  setActiveRestaurantSlug(slug);
                  if (setCurrentView) setCurrentView('menu');
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-bold shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <span>{rest.emoji}</span>
                <span>{rest.name.split(' ')[0]}</span>
              </button>
            );
          })}
        </div>}

        {/* Right actions */}
        <div className="flex items-center gap-2">
          {/* Order Tracking Button */}
          {onOpenTracker && (
            <button
              onClick={onOpenTracker}
              className="relative min-h-[44px] px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 flex items-center gap-1.5 transition-colors"
              title="Acompanhar Meus Pedidos"
            >
              <Clock className="w-4 h-4 text-amber-400" />
              <span className="hidden sm:inline">Rastrear</span>
              {activeOrdersCount > 0 && (
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping absolute top-1 right-1" />
              )}
            </button>
          )}

          {/* Admin Direct Button */}
          {!independent && <button
            onClick={handleGoAdmin}
            className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-medium border transition-colors flex items-center gap-1.5 ${
              currentView === 'admin'
                ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
            }`}
            title="Painel de Cozinha e Gerenciamento"
          >
            <ShieldCheck className="w-4 h-4 text-amber-400" />
            <span className="hidden md:inline">Admin</span>
          </button>}

          {/* Cart Button */}
          <button
            onClick={handleOpenCart}
            className="min-h-[44px] relative px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black text-xs sm:text-sm flex items-center gap-2 shadow-[0_0_20px_rgba(245,158,11,0.35)] transition-all transform hover:scale-[1.02] active:scale-[0.98]"
          >
            <ShoppingBag className="w-4 h-4" />
            <span className="hidden sm:inline">
              {cartItemCount > 0 ? `R$ ${cartTotal.toFixed(2)}` : 'Carrinho'}
            </span>
            {cartItemCount > 0 && (
              <span className="bg-slate-950 text-amber-300 text-xs px-2 py-0.5 rounded-full font-black min-w-[20px] text-center border border-amber-400/40">
                {cartItemCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Mobile Restaurant Horizontal Selector */}
      {!independent && <div className="lg:hidden px-3 py-2 bg-[#09090d] border-t border-amber-500/20 flex items-center gap-2 overflow-x-auto no-scrollbar">
        <button
          onClick={handleGoHome}
          className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap shrink-0 transition-colors flex items-center gap-1 ${
            currentView === 'home'
              ? 'bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 shadow-md'
              : 'bg-black/60 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          🏠 Início
        </button>
        {slugs.map((slug) => {
          const rest = restaurants[slug];
          if (!rest) return null;
          const isSelected = currentView === 'menu' && activeRestaurantSlug === slug;
          return (
            <button
              key={slug}
              onClick={() => {
                setActiveRestaurantSlug(slug);
                if (setCurrentView) setCurrentView('menu');
              }}
              className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap shrink-0 transition-colors flex items-center gap-1.5 ${
                isSelected
                  ? 'bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 font-bold shadow'
                  : 'bg-black/60 text-slate-300 hover:text-white border border-slate-800'
              }`}
            >
              <span>{rest.emoji}</span>
              <span>{rest.name}</span>
            </button>
          );
        })}
      </div>}
    </header>
  );
};

