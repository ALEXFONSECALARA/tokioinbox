import React, { useState, useMemo, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { MenuItem, PaymentMethod } from '../types/restaurant';
import { OfflineStatusIndicator } from './OfflineStatusIndicator';
import { OrderOriginBadge } from './OrderOriginBadge';
import {
  Plus,
  Minus,
  Trash2,
  CheckCircle2,
  DollarSign,
  CreditCard,
  QrCode,
  Printer,
  Sparkles,
  ArrowLeft,
  Search,
  Receipt,
  User,
  Phone,
  Clock,
  Store,
} from 'lucide-react';
import { playAlertSound } from '../utils/audioAlert';

interface CounterTouchViewProps {
  onBackToApp?: () => void;
  onOpenAdmin?: () => void;
}

export const CounterTouchView: React.FC<CounterTouchViewProps> = ({ onBackToApp, onOpenAdmin }) => {
  const {
    menuItems,
    categories,
    createOrder,
    orders,
    activeRestaurantSlug,
    restaurants,
    currentUser,
    setActiveRestaurantSlug,
    showToast,
  } = useStore();

  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [cartItems, setCartItems] = useState<Array<{ item: MenuItem; quantity: number; notes?: string }>>([]);
  const [selectedPayment, setSelectedPayment] = useState<PaymentMethod>('cartao_credito');
  const [cashGiven, setCashGiven] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastFinishedOrder, setLastFinishedOrder] = useState<any | null>(null);

  const restaurant = restaurants[activeRestaurantSlug] || Object.values(restaurants)[0];
  useEffect(() => {
    if (currentUser?.restaurantSlug && currentUser.restaurantSlug !== 'all' && currentUser.restaurantSlug !== activeRestaurantSlug) {
      setActiveRestaurantSlug(currentUser.restaurantSlug as any);
      setCartItems([]);
      setSelectedCategory('all');
      setSearchQuery('');
    }
  }, [currentUser?.restaurantSlug, activeRestaurantSlug, setActiveRestaurantSlug]);
  const restaurantMenuItems = useMemo(
    () => menuItems.filter((item) => item.restaurantSlug === restaurant?.slug),
    [menuItems, restaurant?.slug]
  );
  const restaurantCategories = useMemo(
    () => categories.filter((cat) => cat.restaurantSlug === restaurant?.slug),
    [categories, restaurant?.slug]
  );

  // Auto-generate next pickup counter number (e.g., #B-101, #B-102)
  const nextCounterNumber = useMemo(() => {
    const balcaoOrders = orders.filter((o) => o.orderType === 'balcao' && o.restaurantSlug === activeRestaurantSlug);
    return 100 + (balcaoOrders.length % 900) + 1;
  }, [orders, activeRestaurantSlug]);

  // Filter menu items
  const filteredItems = useMemo(() => {
    return restaurantMenuItems.filter((item) => {
      if (item.available === false) return false;
      if (selectedCategory !== 'all' && item.categoryId !== selectedCategory) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return item.name.toLowerCase().includes(q) || item.description?.toLowerCase().includes(q);
      }
      return true;
    });
  }, [restaurantMenuItems, selectedCategory, searchQuery]);

  const addToCart = (item: MenuItem) => {
    setCartItems((prev) => {
      const idx = prev.findIndex((i) => i.item.id === item.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx].quantity += 1;
        return copy;
      }
      return [...prev, { item, quantity: 1 }];
    });
    playAlertSound('sound1', 0.3);
  };

  const updateQuantity = (itemId: string, delta: number) => {
    setCartItems((prev) =>
      prev
        .map((ci) => {
          if (ci.item.id === itemId) {
            const nextQ = ci.quantity + delta;
            return nextQ > 0 ? { ...ci, quantity: nextQ } : null;
          }
          return ci;
        })
        .filter(Boolean) as any
    );
  };

  const removeFromCart = (itemId: string) => {
    setCartItems((prev) => prev.filter((ci) => ci.item.id !== itemId));
  };

  const subtotal = useMemo(() => {
    return cartItems.reduce((acc, ci) => acc + ci.item.price * ci.quantity, 0);
  }, [cartItems]);

  const total = subtotal;

  const cashChange = useMemo(() => {
    const given = parseFloat(cashGiven) || 0;
    return Math.max(0, given - total);
  }, [cashGiven, total]);

  const handleFinishCounterOrder = async () => {
    if (cartItems.length === 0) {
      showToast('Adicione pelo menos 1 item ao pedido do balcão', 'error');
      return;
    }

    setIsProcessing(true);
    try {
      const orderPayload = {
        customerId: undefined,
        customerName: customerName.trim() || `Cliente Balcão #${nextCounterNumber}`,
        customerPhone: customerPhone.trim() || '(Balcão)',
        restaurantSlug: activeRestaurantSlug,
        restaurantName: restaurant?.name || 'Tokio Rest',
        orderType: 'balcao' as const,
        pickupNumber: nextCounterNumber,
        items: cartItems.map((ci) => ({
          name: ci.item.name,
          quantity: ci.quantity,
          unitPrice: ci.item.price,
          totalPrice: ci.item.price * ci.quantity,
          notes: ci.notes || '',
        })),
        paymentMethod: selectedPayment,
        paymentDetails: {
          paid: true,
          cashChangeFor: selectedPayment === 'dinheiro' ? parseFloat(cashGiven) || total : undefined,
        },
        notes: `Pedido de Balcão - Senha #${nextCounterNumber}`,
      };

      const result = await createOrder(orderPayload);
      if (result) {
        setLastFinishedOrder(result);
        setCartItems([]);
        setCustomerName('');
        setCustomerPhone('');
        setCashGiven('');
        playAlertSound('sound1', 0.6);
        showToast(`Pedido #${result.shortCode} criado com sucesso no Balcão!`, 'success');
      }
    } catch (err: any) {
      console.error('Erro no Balcão:', err);
      showToast('Falha ao processar pedido de balcão', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Recent Balcão orders
  const recentBalcaoOrders = useMemo(() => {
    return orders
      .filter((o) => o.orderType === 'balcao' && o.restaurantSlug === activeRestaurantSlug)
      .slice(0, 5);
  }, [orders, activeRestaurantSlug]);

  return (
    <div className="min-h-screen bg-[#07090E] text-slate-100 flex flex-col select-none">
      {/* Top Header */}
      <header className="bg-[#0B0F19] border-b border-slate-800/80 px-4 py-3 flex items-center justify-between gap-4 sticky top-0 z-20">
        <div className="flex items-center gap-3">
          {onBackToApp && (
            <button
              onClick={onBackToApp}
              className="p-2 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl border border-slate-700/60 transition-colors"
              title="Voltar ao Início"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-sky-500/20 border border-sky-400/40 overflow-hidden flex items-center justify-center text-sky-400">
              {restaurant?.logo ? (
                <img src={restaurant.logo} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-xl">{restaurant?.emoji || '🍽️'}</span>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-black tracking-tight text-white uppercase">
                  🚶 BALCÃO — VENDA RÁPIDA
                </h1>
                <span className="px-2 py-0.5 rounded-full bg-sky-500/20 border border-sky-500/50 text-sky-300 text-[10px] font-black uppercase">
                  CARDÁPIO DA CASA
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {restaurant?.name} • Cardápio exclusivo desta casa • Próxima Senha de Retirada:{' '}
                <strong className="text-sky-400 font-mono text-sm">#{nextCounterNumber}</strong>
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onOpenAdmin && (
            <button
              type="button"
              onClick={onOpenAdmin}
              className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/60 text-[11px] font-bold transition-colors"
              title="Abrir painel administrativo"
            >
              ADMIN
            </button>
          )}
          <OfflineStatusIndicator showToggle />
        </div>
      </header>

      {/* Main Screen Layout: 2 Columns */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left Column: Menu Catalog (Touch Optimized) */}
        <div className="flex-1 flex flex-col overflow-hidden border-r border-slate-800/80">
          {/* Categories Bar & Search */}
          <div className="p-3 bg-[#090D16] border-b border-slate-800/60 flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 sm:pb-0">
              <button
                onClick={() => setSelectedCategory('all')}
                className={`px-4 py-2 rounded-xl text-xs font-black uppercase whitespace-nowrap transition-all ${
                  selectedCategory === 'all'
                    ? 'bg-sky-500 text-slate-950 shadow-md shadow-sky-500/30'
                    : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                Todos ({restaurantMenuItems.length})
              </button>
              {restaurantCategories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-4 py-2 rounded-xl text-xs font-black uppercase whitespace-nowrap transition-all ${
                    selectedCategory === cat.id
                      ? 'bg-sky-500 text-slate-950 shadow-md shadow-sky-500/30'
                      : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>

            <div className="relative min-w-[220px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Buscar produto..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-900/80 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>

          {/* Product Grid */}
          <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
            {filteredItems.map((item) => (
              <button
                key={item.id}
                onClick={() => addToCart(item)}
                className="bg-[#0D121F] border border-slate-800/80 hover:border-sky-500/60 rounded-2xl p-3 text-left flex flex-col justify-between transition-all hover:scale-[1.01] active:scale-95 group shadow-sm hover:shadow-sky-500/10"
              >
                <div>
                  <div className="flex items-start justify-between gap-1 mb-1.5">
                    <span className="text-xs font-bold text-slate-100 group-hover:text-sky-300 line-clamp-2 leading-snug">
                      {item.name}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                      {item.code || 'ITEM'}
                    </span>
                  </div>
                  {item.description && (
                    <p className="text-[11px] text-slate-400 line-clamp-2 mb-2 leading-tight">
                      {item.description}
                    </p>
                  )}
                </div>
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-800/60">
                  <span className="text-sm font-black text-emerald-400 font-mono">
                    R$ {item.price.toFixed(2)}
                  </span>
                  <div className="w-7 h-7 rounded-lg bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400 group-hover:bg-sky-500 group-hover:text-slate-950 transition-colors">
                    <Plus className="w-4 h-4" />
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Recent Balcão History Footer */}
          {recentBalcaoOrders.length > 0 && (
            <div className="p-3 bg-[#080B12] border-t border-slate-800/80 flex items-center gap-3 overflow-x-auto no-scrollbar">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-sky-400" /> Últimos do Balcão:
              </span>
              {recentBalcaoOrders.map((o) => (
                <div
                  key={o.id}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs whitespace-nowrap"
                >
                  <span className="font-mono font-bold text-sky-400">
                    Senha #{o.pickupNumber || o.shortCode}
                  </span>
                  <span className="text-slate-400 font-medium">{o.customerName}</span>
                  <span className="font-mono text-emerald-400 font-bold">R$ {o.total.toFixed(2)}</span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-sky-500/15 text-sky-300 font-bold uppercase">
                    {o.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Active Balcão Cart & Quick Checkout */}
        <div className="w-full lg:w-[420px] bg-[#0A0E18] flex flex-col justify-between border-t lg:border-t-0 border-slate-800/80">
          {/* Header of Checkout */}
          <div className="p-4 border-b border-slate-800/80 bg-[#0C101C]">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase text-slate-400">SENHA DO BALCÃO:</span>
                <span className="px-3 py-1 rounded-xl bg-sky-500 text-slate-950 font-black font-mono text-base tracking-wider shadow-md shadow-sky-500/20">
                  #{nextCounterNumber}
                </span>
              </div>
              <button
                onClick={() => setCartItems([])}
                disabled={cartItems.length === 0}
                className="text-xs text-rose-400 hover:text-rose-300 disabled:opacity-40 flex items-center gap-1 font-bold"
              >
                <Trash2 className="w-3.5 h-3.5" /> Limpar
              </button>
            </div>

            {/* Quick Customer Identification (Optional) */}
            <div className="grid grid-cols-2 gap-2">
              <div className="relative">
                <User className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  placeholder="Nome do Cliente (opcional)"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full pl-8 pr-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                />
              </div>
              <div className="relative">
                <Phone className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  placeholder="Telefone (opcional)"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full pl-8 pr-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                />
              </div>
            </div>
          </div>

          {/* Cart Items List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
            {cartItems.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-12 text-slate-500">
                <Store className="w-12 h-12 text-slate-700 mb-2" />
                <p className="font-bold text-sm text-slate-400">Nenhum item no balcão</p>
                <p className="text-xs text-slate-500 mt-1 max-w-[200px]">
                  Toque nos produtos ao lado para montar o pedido rápido de balcão
                </p>
              </div>
            ) : (
              cartItems.map((ci) => (
                <div
                  key={ci.item.id}
                  className="p-3 bg-[#0E1424] border border-slate-800/80 rounded-2xl flex items-center justify-between gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-xs text-slate-100 truncate">{ci.item.name}</p>
                    <p className="text-xs font-mono text-emerald-400 font-bold mt-0.5">
                      R$ {(ci.item.price * ci.quantity).toFixed(2)}{' '}
                      <span className="text-[10px] text-slate-500 font-normal">
                        ({ci.quantity}x R$ {ci.item.price.toFixed(2)})
                      </span>
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => updateQuantity(ci.item.id, -1)}
                      className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-6 text-center font-bold text-xs font-mono text-white">
                      {ci.quantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(ci.item.id, 1)}
                      className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => removeFromCart(ci.item.id)}
                      className="w-7 h-7 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 flex items-center justify-center ml-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Payment & Checkout Panel */}
          <div className="p-4 bg-[#0B0F19] border-t border-slate-800/80 space-y-3">
            {/* Payment Method Selector */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                FORMA DE PAGAMENTO IMEDIATA:
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                <button
                  type="button"
                  onClick={() => setSelectedPayment('pix')}
                  className={`p-2 rounded-xl border text-center transition-all ${
                    selectedPayment === 'pix'
                      ? 'bg-purple-600 text-white border-purple-400 font-black shadow-md'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <QrCode className="w-4 h-4 mx-auto mb-0.5" />
                  <span className="text-[10px] uppercase font-bold block">PIX</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedPayment('dinheiro')}
                  className={`p-2 rounded-xl border text-center transition-all ${
                    selectedPayment === 'dinheiro'
                      ? 'bg-emerald-600 text-white border-emerald-400 font-black shadow-md'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <DollarSign className="w-4 h-4 mx-auto mb-0.5" />
                  <span className="text-[10px] uppercase font-bold block">DINHEIRO</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedPayment('cartao_credito')}
                  className={`p-2 rounded-xl border text-center transition-all ${
                    selectedPayment === 'cartao_credito'
                      ? 'bg-sky-600 text-white border-sky-400 font-black shadow-md'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <CreditCard className="w-4 h-4 mx-auto mb-0.5" />
                  <span className="text-[10px] uppercase font-bold block">CRÉDITO</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedPayment('cartao_debito')}
                  className={`p-2 rounded-xl border text-center transition-all ${
                    selectedPayment === 'cartao_debito'
                      ? 'bg-amber-600 text-white border-amber-400 font-black shadow-md'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <CreditCard className="w-4 h-4 mx-auto mb-0.5" />
                  <span className="text-[10px] uppercase font-bold block">DÉBITO</span>
                </button>
              </div>
            </div>

            {/* Cash Calculator if Dinheiro */}
            {selectedPayment === 'dinheiro' && (
              <div className="p-2.5 bg-slate-900/90 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Valor Recebido:</span>
                  <input
                    type="number"
                    placeholder={`R$ ${total.toFixed(2)}`}
                    value={cashGiven}
                    onChange={(e) => setCashGiven(e.target.value)}
                    className="w-28 text-right px-2 py-1 bg-slate-950 border border-slate-700 rounded-lg text-xs font-mono text-emerald-400 font-bold focus:outline-none"
                  />
                </div>
                <div className="flex items-center justify-between text-xs font-bold pt-1 border-t border-slate-800">
                  <span className="text-slate-300">Troco a devolver:</span>
                  <span className="font-mono text-sm text-amber-400">
                    R$ {cashChange.toFixed(2)}
                  </span>
                </div>
              </div>
            )}

            {/* Total and Submit */}
            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  TOTAL DO BALCÃO
                </span>
                <span className="text-2xl font-black font-mono text-emerald-400">
                  R$ {total.toFixed(2)}
                </span>
              </div>

              <button
                onClick={handleFinishCounterOrder}
                disabled={cartItems.length === 0 || isProcessing}
                className="px-6 py-3 rounded-2xl bg-gradient-to-r from-sky-500 to-sky-600 hover:from-sky-400 hover:to-sky-500 text-slate-950 font-black text-sm uppercase tracking-wider shadow-lg shadow-sky-500/25 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 transition-all"
              >
                {isProcessing ? (
                  <span>PROCESSANDO...</span>
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5" />
                    <span>ENVIAR BALCÃO</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
