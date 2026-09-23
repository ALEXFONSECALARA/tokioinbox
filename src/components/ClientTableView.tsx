import React, { useState, useMemo } from 'react';
import { useStore } from '../context/StoreContext';
import { MenuItem, Order } from '../types/restaurant';
import { OrderOriginBadge } from './OrderOriginBadge';
import {
  Utensils,
  ShoppingBag,
  Plus,
  Minus,
  Check,
  Send,
  Clock,
  Sparkles,
  CheckCircle2,
  ChevronRight,
  Flame,
  Search,
  X,
} from 'lucide-react';
import { playAlertSound } from '../utils/audioAlert';

interface ClientTableViewProps {
  tableNumber: number;
  tableAccessToken?: string;
  onExit?: () => void;
}

export const ClientTableView: React.FC<ClientTableViewProps> = ({
  tableNumber,
  tableAccessToken,
  onExit,
}) => {
  const {
    menuItems,
    categories,
    orders,
    appendItemsToTableOrder,
    activeRestaurantSlug,
    restaurants,
    showToast,
  } = useStore();

  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');

  // Cart for this customer session
  const [clientCart, setClientCart] = useState<
    Array<{ item: MenuItem; quantity: number; notes: string }>
  >([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const restaurant = restaurants[activeRestaurantSlug] || Object.values(restaurants)[0];
  const restaurantMenuItems = useMemo(
    () => menuItems.filter((item) => item.restaurantSlug === restaurant?.slug),
    [menuItems, restaurant?.slug]
  );
  const restaurantCategories = useMemo(
    () => categories.filter((cat) => cat.restaurantSlug === restaurant?.slug),
    [categories, restaurant?.slug]
  );

  // Active table orders for live status
  const currentTableOrder = useMemo(() => {
    return orders.find(
      (o) =>
        o.orderType === 'mesa' &&
        o.restaurantSlug === activeRestaurantSlug &&
        o.tableNumber === tableNumber &&
        o.status !== 'entregue' &&
        o.status !== 'cancelado'
    );
  }, [orders, activeRestaurantSlug, tableNumber]);

  // Filter items
  const filteredItems = useMemo(() => {
    return restaurantMenuItems.filter((item) => {
      if (item.available === false) return false;
      if (selectedCategory !== 'all' && item.categoryId !== selectedCategory) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return item.name.toLowerCase().includes(q) || item.description.toLowerCase().includes(q);
      }
      return true;
    });
  }, [restaurantMenuItems, selectedCategory, searchQuery]);

  const addToCart = (item: MenuItem) => {
    setClientCart((prev) => {
      const idx = prev.findIndex((c) => c.item.id === item.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx].quantity += 1;
        return copy;
      }
      return [...prev, { item, quantity: 1, notes: '' }];
    });
    playAlertSound('sound1', 0.4);
    showToast(`+1x ${item.name} adicionado`, 'info');
  };

  const updateQuantity = (itemId: string, delta: number) => {
    setClientCart((prev) => {
      return prev
        .map((c) => {
          if (c.item.id === itemId) {
            const newQ = c.quantity + delta;
            return newQ > 0 ? { ...c, quantity: newQ } : null;
          }
          return c;
        })
        .filter(Boolean) as any;
    });
  };

  const cartTotal = useMemo(() => {
    return clientCart.reduce((acc, c) => acc + c.item.price * c.quantity, 0);
  }, [clientCart]);

  const cartCount = useMemo(() => {
    return clientCart.reduce((acc, c) => acc + c.quantity, 0);
  }, [clientCart]);

  const handleSendOrder = async () => {
    if (clientCart.length === 0) return;
    setIsSending(true);

    try {
      const itemsPayload = clientCart.map((c) => ({
        name: c.item.name,
        quantity: c.quantity,
        unitPrice: c.item.price,
        notes: c.notes,
      }));

      const res = await appendItemsToTableOrder({
        tableNumber,
        restaurantSlug: activeRestaurantSlug,
        tableAccessToken,
        items: itemsPayload,
        customerName: customerName.trim() || `Cliente Mesa ${tableNumber}`,
        customerPhone: customerPhone.trim(),
      });

      if (res.success) {
        setClientCart([]);
        setIsCartOpen(false);
        playAlertSound('sound3', 0.7);
        showToast('Seu pedido foi enviado para a cozinha!', 'success');
      }
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#07090E] text-slate-100 flex flex-col font-sans">
      {/* Top Header do Cliente */}
      <header className="sticky top-0 z-30 bg-[#0F131D]/90 backdrop-blur-md border-b border-slate-800 px-4 py-3 sm:px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <OrderOriginBadge orderType="mesa" tableNumber={tableNumber} variant="inline" />
          <div>
            <span className="text-sm font-black text-amber-400 block">
              {restaurant?.name || 'Cardápio Digital'}
            </span>
            <p className="text-[11px] text-slate-400">Faça seus pedidos e acompanhe direto na mesa</p>
          </div>
        </div>

        {/* View Cart Button */}
        <button
          onClick={() => setIsCartOpen(true)}
          className="relative p-2.5 bg-amber-500 text-slate-950 font-black rounded-xl shadow-lg flex items-center gap-2 active:scale-95 transition-all"
        >
          <ShoppingBag className="w-5 h-5" />
          {cartCount > 0 && (
            <span className="text-xs font-mono font-black">{cartCount}</span>
          )}
        </button>
      </header>

      {/* Live Order Status Banner if Table has active order */}
      {currentTableOrder && (
        <div className="bg-[#0E131F] border-b border-amber-500/20 p-4">
          <div className="max-w-4xl mx-auto space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
                  <Flame className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-black uppercase text-amber-400">
                      Pedido em Andamento #{currentTableOrder.shortCode}
                    </span>
                    <span className="text-[10px] bg-slate-800 border border-slate-700 px-2 py-0.5 rounded text-white font-bold uppercase">
                      {currentTableOrder.status === 'pronto'
                        ? '🟢 Pronto p/ Servir'
                        : currentTableOrder.status === 'em_preparo'
                        ? '🟡 Em Preparo'
                        : '🔵 Recebido na Cozinha'}
                    </span>
                    <span className="text-[10px] bg-amber-500/10 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded font-bold">
                      🔒 Itens Enviados Bloqueados
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400">
                    {currentTableOrder.items.length} item(s) já enviados • Total acumulado: R${' '}
                    {currentTableOrder.total.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            {/* Itens já enviados em produção na mesa */}
            <div className="bg-[#080B11] border border-slate-800/80 rounded-xl p-2.5 max-h-36 overflow-y-auto space-y-1.5 text-xs">
              <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">
                Itens Confirmados e em Produção:
              </span>
              {currentTableOrder.items.map((it, idx) => (
                <div key={idx} className="flex items-center justify-between py-1 border-b border-slate-900 last:border-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-amber-400 font-mono">{it.quantity}x</span>
                    <span className="text-slate-200 font-medium">{it.name}</span>
                    {it.notes && <span className="text-[10px] text-slate-500 italic">({it.notes})</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400 font-mono">
                      R$ {(it.totalPrice || it.unitPrice * it.quantity).toFixed(2)}
                    </span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded uppercase font-bold ${
                      it.stationStatus === 'pedido_feito'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : it.stationStatus === 'em_preparo'
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                    }`}>
                      {it.stationStatus === 'pedido_feito' ? 'Pronto' : it.stationStatus === 'em_preparo' ? 'Preparo' : 'Fila'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main Content: Categories & Menu */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Search */}
        <div className="relative">
          <Search className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar prato, bebida ou sobremesa..."
            className="w-full pl-11 pr-4 py-3 bg-[#111520] border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
          />
        </div>

        {/* Categories Bar */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider whitespace-nowrap transition-all border ${
              selectedCategory === 'all'
                ? 'bg-amber-500 text-slate-950 border-amber-300'
                : 'bg-[#141926] text-slate-400 border-slate-800'
            }`}
          >
            Todos
          </button>
          {restaurantCategories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider whitespace-nowrap transition-all border ${
                selectedCategory === cat.id
                  ? 'bg-amber-500 text-slate-950 border-amber-300'
                  : 'bg-[#141926] text-slate-400 border-slate-800'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Items Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className="bg-[#10141E] border border-slate-800/90 rounded-2xl p-4 flex gap-4 shadow-lg hover:border-amber-500/40 transition-all"
            >
              {item.image && (
                <img
                  src={item.image}
                  alt={item.name}
                  className="w-20 h-20 rounded-xl object-cover shrink-0 bg-slate-900 border border-slate-800"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              )}

              <div className="flex-1 flex flex-col justify-between">
                <div>
                  <h4 className="text-sm font-black text-white">{item.name}</h4>
                  <p className="text-xs text-slate-400 line-clamp-2 mt-0.5">{item.description}</p>
                </div>

                <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-800/60">
                  <span className="text-sm font-black text-amber-400 font-mono">
                    R$ {item.price.toFixed(2)}
                  </span>
                  <button
                    onClick={() => addToCart(item)}
                    className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black rounded-lg shadow flex items-center gap-1 active:scale-95"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Adicionar</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Floating Bottom Cart Bar */}
      {cartCount > 0 && !isCartOpen && (
        <div className="sticky bottom-4 px-4 max-w-md mx-auto w-full z-40">
          <button
            onClick={() => setIsCartOpen(true)}
            className="w-full py-3.5 px-5 bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 font-black text-sm rounded-2xl shadow-2xl flex items-center justify-between border border-amber-300 active:scale-95 transition-all"
          >
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-slate-950 text-amber-300 text-xs flex items-center justify-center font-mono">
                {cartCount}
              </span>
              <span>Ver Pedido da Mesa</span>
            </div>
            <span className="font-mono font-black text-base">R$ {cartTotal.toFixed(2)}</span>
          </button>
        </div>
      )}

      {/* Cart Drawer */}
      {isCartOpen && (
        <div className="modal-viewport fixed inset-0 z-50 bg-black/95 backdrop-blur-sm flex justify-end animate-fadeIn">
          <div className="w-full max-w-md bg-[#10141E] border-l border-slate-800 h-full flex flex-col p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-black text-white uppercase">Seu Pedido • Mesa {tableNumber}</h3>
              </div>
              <button
                onClick={() => setIsCartOpen(false)}
                className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800/60"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Cart Items */}
            <div className="flex-1 overflow-y-auto py-4 space-y-3">
              {clientCart.map((c, idx) => (
                <div
                  key={idx}
                  className="bg-[#151A26] border border-slate-800 p-3 rounded-xl flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-white block truncate">
                      {c.item.name}
                    </span>
                    <span className="text-xs font-mono text-amber-400">
                      R$ {(c.item.price * c.quantity).toFixed(2)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateQuantity(c.item.id, -1)}
                      className="w-7 h-7 rounded-lg bg-slate-800 text-white flex items-center justify-center"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-xs font-bold font-mono text-white w-4 text-center">
                      {c.quantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(c.item.id, 1)}
                      className="w-7 h-7 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center font-bold"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Customer info */}
            <div className="py-3 border-t border-slate-800 space-y-2">
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Seu nome (opcional)"
                className="w-full p-2.5 bg-[#151A26] border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* Send to Kitchen */}
            <div className="pt-3 border-t border-slate-800 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Total:</span>
                <span className="text-lg font-black text-amber-400 font-mono">
                  R$ {cartTotal.toFixed(2)}
                </span>
              </div>

              <button
                onClick={handleSendOrder}
                disabled={isSending || clientCart.length === 0}
                className="w-full py-4 bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 text-slate-950 font-black text-sm uppercase tracking-wider rounded-2xl shadow-xl flex items-center justify-center gap-2 active:scale-95 disabled:opacity-40"
              >
                <Send className="w-4 h-4" />
                <span>{isSending ? 'Enviando...' : 'ENVIAR PEDIDO PARA A COZINHA'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
