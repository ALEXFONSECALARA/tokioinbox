import React, { useState, useMemo, useRef } from 'react';
import { useStore } from '../context/StoreContext';
import { MenuItem, MenuItemOptionGroup, Order } from '../types/restaurant';
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
import { isRestaurantAcceptingOrders, PAUSED_ORDERS_MESSAGE } from '../utils/restaurantStatus';

interface ClientTableViewProps {
  tableNumber: number;
  tableAccessToken?: string;
  /** Restaurante da URL/QR. Evita enviar o pedido para o restaurante errado se o catálogo ainda estiver carregando. */
  restaurantSlug?: string;
  onExit?: () => void;
}

type CartOption = { groupId: string; groupTitle: string; optionId: string; name: string; price: number };
type CartEntry = { key: string; item: MenuItem; quantity: number; notes: string; selectedOptions: CartOption[]; unitPrice: number };

const unitPriceOf = (item: MenuItem, opts: CartOption[]) =>
  Number(((typeof item.promoPrice === 'number' ? item.promoPrice : item.price) + opts.reduce((a, o) => a + o.price, 0)).toFixed(2));

export const ClientTableView: React.FC<ClientTableViewProps> = ({
  tableNumber,
  tableAccessToken,
  restaurantSlug,
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
  const [clientCart, setClientCart] = useState<CartEntry[]>([]);
  const [accessToken, setAccessToken] = useState<string | undefined>(tableAccessToken);
  // Item com opções (ex.: sabor, ponto) aguardando escolha do cliente
  const [optionPicker, setOptionPicker] = useState<MenuItem | null>(null);
  const [pickerChoices, setPickerChoices] = useState<Record<string, string[]>>({});
  // Chave estável da tentativa de envio: se a rede falhar e o cliente tocar de novo, o servidor não duplica o pedido.
  const sendKeyRef = useRef<string | null>(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const effectiveSlug = restaurantSlug || activeRestaurantSlug;
  const restaurant = restaurants[effectiveSlug] || Object.values(restaurants)[0];
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
        o.restaurantSlug === effectiveSlug &&
        o.tableNumber === tableNumber &&
        o.status !== 'entregue' &&
        o.status !== 'finalizado' &&
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

  const ordersPaused = !isRestaurantAcceptingOrders(restaurant);

  const addEntry = (item: MenuItem, opts: CartOption[]) => {
    const key = `${item.id}|${opts.map((o) => `${o.groupId}:${o.optionId}`).sort().join(',')}`;
    setClientCart((prev) => {
      const idx = prev.findIndex((c) => c.key === key);
      if (idx >= 0) return prev.map((c, i) => (i === idx ? { ...c, quantity: c.quantity + 1 } : c));
      return [...prev, { key, item, quantity: 1, notes: '', selectedOptions: opts, unitPrice: unitPriceOf(item, opts) }];
    });
    sendKeyRef.current = null; // carrinho mudou: próxima tentativa é uma operação nova
    try { playAlertSound('sound1', 0.4); } catch { /* áudio bloqueado no celular não pode travar o pedido */ }
    showToast(`+1x ${item.name} adicionado`, 'info');
  };

  const addToCart = (item: MenuItem) => {
    if (ordersPaused) {
      showToast(PAUSED_ORDERS_MESSAGE, 'error');
      return;
    }
    // Itens com opções (sabor, ponto, adicionais) precisam de escolha — o servidor recusa se faltar opção obrigatória.
    if ((item.optionGroups || []).length > 0) {
      const initial: Record<string, string[]> = {};
      (item.optionGroups || []).forEach((g) => {
        initial[g.id] = g.required && g.options.length > 0 && (g.maxSelections ?? 1) === 1 ? [g.options[0].id] : [];
      });
      setPickerChoices(initial);
      setOptionPicker(item);
      return;
    }
    addEntry(item, []);
  };

  const togglePickerOption = (g: MenuItemOptionGroup, optionId: string) => {
    setPickerChoices((prev) => {
      const cur = prev[g.id] || [];
      const max = g.maxSelections ?? 1;
      if (max === 1) return { ...prev, [g.id]: cur.includes(optionId) && !g.required ? [] : [optionId] };
      if (cur.includes(optionId)) return { ...prev, [g.id]: cur.filter((x) => x !== optionId) };
      if (cur.length >= max) {
        showToast(`Máximo de ${max} opção(ões) em "${g.title}"`, 'error');
        return prev;
      }
      return { ...prev, [g.id]: [...cur, optionId] };
    });
  };

  const confirmPicker = () => {
    if (!optionPicker) return;
    const opts: CartOption[] = [];
    for (const g of optionPicker.optionGroups || []) {
      const chosen = pickerChoices[g.id] || [];
      if (g.required && chosen.length === 0) {
        showToast(`Escolha uma opção em "${g.title}"`, 'error');
        return;
      }
      for (const id of chosen) {
        const o = g.options.find((x) => x.id === id);
        if (o) opts.push({ groupId: g.id, groupTitle: g.title, optionId: o.id, name: o.name, price: Number(o.price) || 0 });
      }
    }
    addEntry(optionPicker, opts);
    setOptionPicker(null);
  };

  const updateQuantity = (key: string, delta: number) => {
    sendKeyRef.current = null;
    setClientCart((prev) =>
      prev
        .map((c) => (c.key === key ? { ...c, quantity: c.quantity + delta } : c))
        .filter((c) => c.quantity > 0)
    );
  };

  const cartTotal = useMemo(() => {
    return clientCart.reduce((acc, c) => acc + c.unitPrice * c.quantity, 0);
  }, [clientCart]);

  const cartCount = useMemo(() => {
    return clientCart.reduce((acc, c) => acc + c.quantity, 0);
  }, [clientCart]);

  const handleSendOrder = async () => {
    if (clientCart.length === 0 || isSending) return;
    if (ordersPaused) {
      showToast(PAUSED_ORDERS_MESSAGE, 'error');
      return;
    }
    setIsSending(true);
    if (!sendKeyRef.current) sendKeyRef.current = `qr-${effectiveSlug}-${tableNumber}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    try {
      // CORREÇÃO (QR da mesa não finalizava pelo celular): o payload NÃO levava o
      // `menuItemId`. Para cliente (não funcionário) o servidor só aceita itens que
      // reconhece no cardápio, então recusava o pedido — e a tela não mostrava nada.
      const itemsPayload = clientCart.map((c) => ({
        menuItemId: c.item.id,
        name: c.item.name,
        quantity: c.quantity,
        unitPrice: c.unitPrice,
        selectedOptions: c.selectedOptions,
        notes: c.notes,
        station: c.item.station,
      }));

      const send = (token?: string) =>
        appendItemsToTableOrder({
          tableNumber,
          restaurantSlug: effectiveSlug,
          tableAccessToken: token,
          items: itemsPayload as any,
          customerName: customerName.trim() || `Cliente Mesa ${tableNumber}`,
          customerPhone: customerPhone.trim(),
          idempotencyKey: sendKeyRef.current!,
        });

      let res = await send(accessToken);

      // Senha/QR expirada (a conta da mesa foi fechada depois que a página abriu): renova
      // sozinha pelo QR permanente da mesa e tenta de novo, sem o cliente precisar reescanear.
      if (!res.success && /senha|qr|token|expirad/i.test(res.error || '')) {
        try {
          const r = await fetch(`/api/tables/${encodeURIComponent(effectiveSlug)}/${tableNumber}/qr-access`);
          const d = await r.json();
          if (d?.success && d?.active && d?.tableAccessToken) {
            setAccessToken(d.tableAccessToken);
            res = await send(d.tableAccessToken);
          } else if (d?.success && d?.active === false) {
            showToast(d.message || 'Pedidos pela mesa estão desativados. Chame o atendimento.', 'error');
            return;
          }
        } catch {
          /* cai no erro abaixo */
        }
      }

      if (res.success) {
        setClientCart([]);
        setIsCartOpen(false);
        sendKeyRef.current = null;
        try { playAlertSound('sound3', 0.7); } catch { /* ignore */ }
        showToast('Seu pedido foi enviado para a cozinha!', 'success');
      } else {
        // CORREÇÃO: antes, falha = nenhuma mensagem. Agora o cliente sempre vê o motivo.
        showToast(res.error || 'Não foi possível enviar o pedido. Tente novamente ou chame o atendimento.', 'error');
      }
    } catch (err: any) {
      showToast(err?.message || 'Falha ao enviar o pedido. Tente novamente.', 'error');
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
                      Pedido em Andamento {currentTableOrder.shortCode}
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
        {ordersPaused && (
          <div role="alert" className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/40 text-rose-300 text-sm font-bold text-center">
            {PAUSED_ORDERS_MESSAGE}
          </div>
        )}
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
                    R$ {(typeof item.promoPrice === 'number' ? item.promoPrice : item.price).toFixed(2)}
                  </span>
                  <button
                    onClick={() => addToCart(item)}
                    disabled={ordersPaused}
                    className="disabled:opacity-40 disabled:cursor-not-allowed px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black rounded-lg shadow flex items-center gap-1 active:scale-95"
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
              {clientCart.map((c) => (
                <div
                  key={c.key}
                  className="bg-[#151A26] border border-slate-800 p-3 rounded-xl flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-white block truncate">
                      {c.item.name}
                    </span>
                    {c.selectedOptions.length > 0 && (
                      <span className="text-[10px] text-slate-400 block truncate">
                        {c.selectedOptions.map((o) => o.name).join(' • ')}
                      </span>
                    )}
                    <span className="text-xs font-mono text-amber-400">
                      R$ {(c.unitPrice * c.quantity).toFixed(2)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateQuantity(c.key, -1)}
                      className="w-7 h-7 rounded-lg bg-slate-800 text-white flex items-center justify-center"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-xs font-bold font-mono text-white w-4 text-center">
                      {c.quantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(c.key, 1)}
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
                disabled={isSending || clientCart.length === 0 || ordersPaused}
                className="w-full py-4 bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 text-slate-950 font-black text-sm uppercase tracking-wider rounded-2xl shadow-xl flex items-center justify-center gap-2 active:scale-95 disabled:opacity-40"
              >
                <Send className="w-4 h-4" />
                <span>{isSending ? 'Enviando...' : 'ENVIAR PEDIDO PARA A COZINHA'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Escolha de opções do produto */}
      {optionPicker && (
        <div className="modal-viewport fixed inset-0 z-[60] bg-black/90 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full max-w-md bg-[#10141E] border border-slate-800 rounded-t-3xl sm:rounded-3xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-slate-800">
              <h3 className="text-sm font-black text-white">{optionPicker.name}</h3>
              <button onClick={() => setOptionPicker(null)} className="p-2 text-slate-400 rounded-xl bg-slate-800/60">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {(optionPicker.optionGroups || []).map((g) => (
                <div key={g.id} className="space-y-2">
                  <p className="text-xs font-black text-amber-400 uppercase">
                    {g.title} {g.required ? <span className="text-rose-400">• obrigatório</span> : <span className="text-slate-500">• opcional</span>}
                  </p>
                  {g.options.map((o) => {
                    const on = (pickerChoices[g.id] || []).includes(o.id);
                    return (
                      <button
                        key={o.id}
                        type="button"
                        onClick={() => togglePickerOption(g, o.id)}
                        className={`w-full flex items-center justify-between px-3 py-3 rounded-xl border text-xs font-bold ${
                          on ? 'bg-amber-500/15 border-amber-500 text-amber-300' : 'bg-[#151A26] border-slate-800 text-slate-300'
                        }`}
                      >
                        <span>{on ? '✓ ' : ''}{o.name}</span>
                        {o.price > 0 && <span className="font-mono">+ R$ {o.price.toFixed(2)}</span>}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
            <div className="p-5 border-t border-slate-800">
              <button onClick={confirmPicker} className="w-full py-3.5 bg-amber-500 text-slate-950 font-black text-sm rounded-2xl active:scale-95">
                Adicionar ao pedido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
