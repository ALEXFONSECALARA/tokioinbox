import React, { useState } from 'react';
import { ClientTableView } from '../../components/ClientTableView';
import { RestaurantHeader } from '../../components/RestaurantHeader';
import { MenuSection } from '../../components/MenuSection';
import { CartDrawer } from '../../components/CartDrawer';
import { CheckoutModal } from '../../components/CheckoutModal';
import { ProductModal } from '../../components/ProductModal';
import { OrderTrackerModal } from '../../components/OrderTrackerModal';
import { useStore } from '../../context/StoreContext';
import { MenuItem, Order } from '../../types/restaurant';
import { ShoppingBag, ArrowLeft, Utensils, QrCode } from 'lucide-react';

interface ClienteModuleProps {
  tableNumber?: number | null;
  onExitToHome?: () => void;
  onSwitchToTableMode?: (table: number) => void;
}

/**
 * MÓDULO 2: CLIENTE / QR CODE DA MESA / CARDÁPIO DIGITAL
 * Ambiente 100% focado na experiência do consumidor final.
 */
export const ClienteModule: React.FC<ClienteModuleProps> = ({
  tableNumber,
  onExitToHome,
}) => {
  const { currentRestaurant, cartItemCount, cartTotal } = useStore();

  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<MenuItem | null>(null);
  const [isTrackerOpen, setIsTrackerOpen] = useState(false);
  const [trackedOrderId, setTrackedOrderId] = useState<string | null>(null);
  const [manualTableNumber, setManualTableNumber] = useState<number | null>(tableNumber || null);

  // Se estiver associado a uma mesa física (QR Code)
  if (manualTableNumber) {
    return (
      <div className="min-h-screen bg-[#07090E]">
        <ClientTableView
          tableNumber={manualTableNumber}
          onExit={onExitToHome || (() => setManualTableNumber(null))}
        />
      </div>
    );
  }

  // Cardápio público / delivery online
  return (
    <div className="min-h-screen bg-[#07090E] text-white flex flex-col selection:bg-amber-500 selection:text-slate-950 pb-24">
      {/* Top Navbar */}
      <header className="sticky top-0 z-30 bg-[#090D16]/90 backdrop-blur-md border-b border-slate-800/80 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {onExitToHome && (
            <button
              onClick={onExitToHome}
              className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors"
              title="Voltar ao início"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div className="flex items-center gap-2">
            <span className="text-2xl">{currentRestaurant?.emoji || '🍣'}</span>
            <div>
              <h1 className="text-sm font-black tracking-tight text-white uppercase">
                {currentRestaurant?.name || 'Cardápio Digital'}
              </h1>
              <p className="text-[11px] text-slate-400">Cardápio Oficial para Pedidos</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setManualTableNumber(4)}
            className="px-3 py-1.5 rounded-xl bg-slate-900 border border-amber-500/30 text-amber-300 text-xs font-bold flex items-center gap-1.5 hover:bg-amber-500/10 transition-colors"
          >
            <QrCode className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Simular Mesa QR</span>
          </button>

          <button
            onClick={() => setIsCartOpen(true)}
            className="relative px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-lg shadow-amber-500/20"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>R$ {cartTotal.toFixed(2)}</span>
            {cartItemCount > 0 && (
              <span className="w-5 h-5 rounded-full bg-slate-950 text-white text-[10px] font-black flex items-center justify-center">
                {cartItemCount}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Restaurant Header */}
      <RestaurantHeader />

      {/* Main Menu Section */}
      <main className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 flex-1">
        <MenuSection onSelectProduct={(item) => setSelectedProduct(item)} />
      </main>

      {/* Modals */}
      {selectedProduct && (
        <ProductModal
          item={selectedProduct}
          onClose={() => setSelectedProduct(null)}
        />
      )}

      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        onCheckout={() => {
          setIsCartOpen(false);
          setIsCheckoutOpen(true);
        }}
      />

      <CheckoutModal
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        onOrderCreated={(order: Order) => {
          setIsCheckoutOpen(false);
          setTrackedOrderId(order.id);
          setIsTrackerOpen(true);
        }}
      />

      {isTrackerOpen && (
        <OrderTrackerModal
          isOpen={isTrackerOpen}
          onClose={() => setIsTrackerOpen(false)}
          orderId={trackedOrderId}
        />
      )}
    </div>
  );
};
