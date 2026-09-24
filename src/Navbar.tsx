import React from 'react';
import { useStore } from '../context/StoreContext';
import {
  ShoppingBag,
  Clock,
  User,
} from 'lucide-react';
import { useCustomerAuth } from '../context/CustomerAuthContext';

interface NavbarProps {
  currentView?: 'home' | 'menu';
  setCurrentView?: (view: 'home' | 'menu') => void;
  onOpenCart?: () => void;
  onOpenTracker?: () => void;
  onNavigateHome?: () => void;
  onOpenAuth?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView = 'home',
  setCurrentView,
  onOpenCart,
  onOpenTracker,
  onNavigateHome,
  onOpenAuth,
}) => {
  const {
    restaurants,
    activeRestaurantSlug,
    cart,
    setIsCartOpen,
    orders,
  } = useStore();

  const { customer, isAuthenticated } = useCustomerAuth();

  const handleGoHome = () => {
    if (onNavigateHome) onNavigateHome();
    if (setCurrentView) setCurrentView('home');
  };

  // O logo apenas leva à página inicial. Não existe nenhuma porta para áreas internas aqui.
  const handleLogoClick = () => {
    handleGoHome();
  };

  const handleOpenCart = () => {
    if (onOpenCart) onOpenCart();
    else setIsCartOpen(true);
  };

  const currentRestaurant =
    restaurants[activeRestaurantSlug] ||
    restaurants.japones ||
    Object.values(restaurants)[0] ||
    null;
  const cartItemCount = cart.reduce((acc, item) => acc + item.quantity, 0);
  const cartTotal = cart.reduce((acc, item) => acc + item.subtotal, 0);

  // Active pending orders count
  const activeOrdersCount = orders.filter(
    (o) => o.status !== 'entregue' && o.status !== 'cancelado'
  ).length;

  return (
    <header className="safe-top sticky top-0 z-40 bg-[#0B0907]/95 backdrop-blur-xl border-b border-[#C5A880]/25 shadow-[0_8px_30px_rgba(0,0,0,0.85)]">
      {/* Main Navbar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex items-center justify-between gap-3">
        {/* Breadcrumb do Cardápio — sem ícone/nome de marca no topo, conforme solicitado */}
        <div className="flex items-center gap-3 min-h-[44px]">
          {currentView === 'menu' && (
            <button
              onClick={handleLogoClick}
              className="flex items-center gap-1.5 text-left focus:outline-none"
              title="Página Inicial - Todos os Restaurantes"
            >
              <span className="text-xs text-stone-400">Cardápio:</span>
              <span className="text-xs font-bold text-[#C5A880] flex items-center gap-1 bg-black/60 px-2.5 py-1 rounded-lg border border-[#C5A880]/30">
                {currentRestaurant ? currentRestaurant.name : 'Cardápio'}
              </span>
            </button>
          )}
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-2">
          {/* Customer Account Button */}
          {onOpenAuth && (
            <button
              onClick={onOpenAuth}
              className="relative min-h-[44px] px-3 py-2 rounded-xl bg-stone-900/90 hover:bg-stone-800 text-stone-200 text-xs font-semibold border border-stone-800 hover:border-[#C5A880]/50 flex items-center gap-1.5 transition-colors"
              title={isAuthenticated ? `Minha Conta (${customer?.name})` : 'Entrar ou Cadastrar'}
            >
              <User className="w-4 h-4 text-[#C5A880]" />
              <span className="hidden sm:inline max-w-[90px] truncate">
                {isAuthenticated ? customer?.name.split(' ')[0] : 'Entrar'}
              </span>
            </button>
          )}

          {/* Order Tracking Button */}
          {onOpenTracker && (
            <button
              onClick={onOpenTracker}
              className="relative min-h-[44px] px-3 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-stone-200 text-xs font-medium border border-stone-700 flex items-center gap-1.5 transition-colors"
              title="Acompanhar Meus Pedidos"
            >
              <Clock className="w-4 h-4 text-[#C5A880]" />
              <span className="hidden sm:inline">Rastrear</span>
              {activeOrdersCount > 0 && (
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping absolute top-1 right-1" />
              )}
            </button>
          )}

          {/* Cart Button */}
          <button
            onClick={handleOpenCart}
            className="min-h-[44px] relative px-4 py-2 rounded-xl bg-gradient-to-r from-[#C5A880] via-[#B85D3B] to-[#7D3F27] hover:brightness-110 text-white font-black text-xs sm:text-sm flex items-center gap-2 shadow-[0_0_20px_rgba(197,168,128,0.3)] transition-all transform hover:scale-[1.02] active:scale-[0.98]"
          >
            <ShoppingBag className="w-4 h-4" />
            <span className="hidden sm:inline">
              {cartItemCount > 0 ? `R$ ${cartTotal.toFixed(2)}` : 'Carrinho'}
            </span>
            {cartItemCount > 0 && (
              <span className="bg-black/70 text-[#C5A880] text-xs px-2 py-0.5 rounded-full font-black min-w-[20px] text-center border border-[#C5A880]/40">
                {cartItemCount}
              </span>
            )}
          </button>
        </div>
      </div>

    </header>
  );
};

