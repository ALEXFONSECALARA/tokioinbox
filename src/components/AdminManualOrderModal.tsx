import React, { useState } from 'react';
import { useStore } from '../context/StoreContext';
import { RestaurantSlug, OrderType, PaymentMethod } from '../types/restaurant';
import {
  Plus,
  Trash2,
  ShoppingBag,
  X,
  CheckCircle2,
  User,
  Phone,
  MapPin,
  Zap,
  Printer,
  ChevronDown,
  Hash,
  Utensils,
  Store,
  Bike,
} from 'lucide-react';

interface AdminManualOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultSlug: RestaurantSlug;
}

export const AdminManualOrderModal: React.FC<AdminManualOrderModalProps> = ({
  isOpen,
  onClose,
  defaultSlug,
}) => {
  const { restaurants, menuItems, showToast, printerSettings, currentUser } = useStore();

  const [selectedSlug, setSelectedSlug] = useState<RestaurantSlug>(defaultSlug);
  const canSwitchRestaurant = currentUser?.restaurantSlug === 'all';

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [orderType, setOrderType] = useState<OrderType>('balcao');
  const [tableNumber, setTableNumber] = useState<number | undefined>(undefined);

  // Dynamic pickup number (1 to 100) - hidden by default, expands dynamically
  const [showPickupInput, setShowPickupInput] = useState(false);
  const [pickupNumber, setPickupNumber] = useState<number | undefined>(undefined);

  // Delivery details
  const [street, setStreet] = useState('');
  const [number, setNumber] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [city, setCity] = useState('São Paulo');

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('dinheiro');
  const [notes, setNotes] = useState('');
  const [autoPrintAfterSend, setAutoPrintAfterSend] = useState(true);

  // Selected item line entries
  const [selectedItems, setSelectedItems] = useState<{ itemId: string; quantity: number }[]>([]);
  React.useEffect(() => {
    if (currentUser?.restaurantSlug && currentUser.restaurantSlug !== 'all') {
      setSelectedSlug(currentUser.restaurantSlug as RestaurantSlug);
      setSelectedItems([]);
    }
  }, [currentUser?.restaurantSlug]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchItem, setSearchItem] = useState('');

  if (!isOpen) return null;

  const currentRestItems = menuItems.filter(
    (m) =>
      m.restaurantSlug === selectedSlug &&
      (searchItem ? m.name.toLowerCase().includes(searchItem.toLowerCase()) : true)
  );

  const addItemToOrder = (itemId: string) => {
    setSelectedItems((prev) => {
      const existing = prev.find((i) => i.itemId === itemId);
      if (existing) {
        return prev.map((i) => (i.itemId === itemId ? { ...i, quantity: i.quantity + 1 } : i));
      }
      return [...prev, { itemId, quantity: 1 }];
    });
  };

  const updateItemQty = (itemId: string, qty: number) => {
    if (qty <= 0) {
      setSelectedItems((prev) => prev.filter((i) => i.itemId !== itemId));
    } else {
      setSelectedItems((prev) =>
        prev.map((i) => (i.itemId === itemId ? { ...i, quantity: qty } : i))
      );
    }
  };

  const calculateSubtotal = () => {
    return selectedItems.reduce((sum, entry) => {
      const item = menuItems.find((m) => m.id === entry.itemId);
      if (!item) return sum;
      return sum + (item.promoPrice ?? item.price) * entry.quantity;
    }, 0);
  };

  // 1-Click Fast Dispatch & Manual Submit
  const handleDispatchOrder = async (isFastOneClick = false) => {
    if (selectedItems.length === 0) {
      showToast('Selecione pelo menos 1 produto para lançar o pedido.', 'warning');
      return;
    }

    if (orderType === 'mesa' && (!tableNumber || tableNumber < 1 || tableNumber > 50)) {
      showToast('Por favor, informe uma mesa válida (1 a 50).', 'warning');
      return;
    }

    // Auto-generate human readable name if blank in 1-click mode
    let finalCustomerName = customerName.trim();
    if (!finalCustomerName) {
      if (orderType === 'mesa') {
        finalCustomerName = `Mesa ${tableNumber}`;
      } else if (orderType === 'balcao') {
        finalCustomerName = pickupNumber ? `Retirada #${pickupNumber}` : 'Balcão Express';
      } else {
        finalCustomerName = 'Cliente Delivery';
      }
    }

    setIsSubmitting(true);
    try {
      const restaurant = restaurants[selectedSlug];
      const itemsPayload = selectedItems.map((entry) => {
        const item = menuItems.find((m) => m.id === entry.itemId)!;
        const unit = item.promoPrice ?? item.price;
        return {
          id: `${item.id}-${Date.now()}`,
          name: item.name,
          quantity: entry.quantity,
          unitPrice: unit,
          totalPrice: unit * entry.quantity,
        };
      });

      const subtotal = calculateSubtotal();
      const deliveryFee = orderType === 'delivery' ? restaurant.deliveryFee : 0;
      const total = subtotal + deliveryFee;

      const payload = {
        restaurantSlug: selectedSlug,
        restaurantName: restaurant.name,
        customerName: finalCustomerName,
        customerPhone: customerPhone.trim() || '(11) 99999-0000',
        orderType,
        tableNumber: orderType === 'mesa' ? tableNumber : undefined,
        pickupNumber:
          orderType === 'balcao'
            ? pickupNumber
            : undefined,
        deliveryAddress:
          orderType === 'delivery'
            ? {
                street: street.trim() || 'Rua Central',
                number: number.trim() || 'S/N',
                neighborhood: neighborhood.trim() || 'Bairro',
                city,
              }
            : undefined,
        items: itemsPayload,
        subtotal,
        deliveryFee,
        discount: 0,
        total,
        paymentMethod,
        paymentDetails: { paid: true },
        notes: notes.trim() || (isFastOneClick ? 'Lançamento Rápido em 1 Clique' : undefined),
        idempotencyKey: `manual-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      };

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error('Falha ao registrar pedido manual');
      }

      const resData = await res.json();
      const createdOrder = resData.order;

      showToast(
        `Pedido ${createdOrder?.shortCode || ''} (${
          orderType === 'mesa'
            ? `Mesa ${tableNumber}`
            : orderType === 'balcao' && pickupNumber
            ? `Retirada #${pickupNumber}`
            : orderType.toUpperCase()
        }) enviado à cozinha com sucesso!`,
        'success'
      );

      // Auto-trigger window.print if requested and supported
      if (autoPrintAfterSend && typeof window !== 'undefined') {
        setTimeout(() => {
          try {
            window.print();
          } catch (e) {
            console.warn('[Print Spool]', e);
          }
        }, 500);
      }

      onClose();
    } catch (err: any) {
      showToast(err.message || 'Erro ao enviar pedido.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-fadeIn text-slate-100">
      <div className="bg-[#141720] border border-slate-700 rounded-3xl max-w-3xl w-full p-4 sm:p-6 max-h-[92vh] overflow-y-auto shadow-2xl space-y-4">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 text-slate-950 flex items-center justify-center font-black shadow-lg">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-white">Lançamento de Pedido Ágil</h3>
                <span className="bg-amber-500/20 border border-amber-500/30 text-amber-400 text-[10px] font-black px-2 py-0.5 rounded-full uppercase">
                  PDV &amp; Balcão
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Lançamento instantâneo para Mesa, Retirada ou Delivery
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4 text-xs">
          {/* Top Bar: Restaurant & Mode Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">
                Restaurante / Unidade
              </label>
              <select
                value={selectedSlug}
                disabled={!canSwitchRestaurant}
                onChange={(e) => {
                  setSelectedSlug(e.target.value as any);
                  setSelectedItems([]);
                }}
                className="w-full bg-[#0E1015] border border-slate-700 rounded-xl px-3 py-2 text-white font-bold text-xs focus:border-amber-500"
              >
                {Object.values(restaurants)
                  .filter((r) => canSwitchRestaurant || r.slug === currentUser?.restaurantSlug)
                  .map((r) => (
                  <option key={r.slug} value={r.slug}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">
                Modalidade do Atendimento
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() => setOrderType('mesa')}
                  className={`py-2 px-2 rounded-xl font-bold uppercase transition-all flex items-center justify-center gap-1 text-[11px] ${
                    orderType === 'mesa'
                      ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                      : 'bg-[#1A1F2B] text-slate-400 border border-slate-800 hover:text-white'
                  }`}
                >
                  <Utensils className="w-3.5 h-3.5" />
                  <span>Mesa</span>
                </button>

                <button
                  type="button"
                  onClick={() => setOrderType('balcao')}
                  className={`py-2 px-2 rounded-xl font-bold uppercase transition-all flex items-center justify-center gap-1 text-[11px] ${
                    orderType === 'balcao'
                      ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                      : 'bg-[#1A1F2B] text-slate-400 border border-slate-800 hover:text-white'
                  }`}
                >
                  <Store className="w-3.5 h-3.5" />
                  <span>Retirada</span>
                </button>

                <button
                  type="button"
                  onClick={() => setOrderType('delivery')}
                  className={`py-2 px-2 rounded-xl font-bold uppercase transition-all flex items-center justify-center gap-1 text-[11px] ${
                    orderType === 'delivery'
                      ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                      : 'bg-[#1A1F2B] text-slate-400 border border-slate-800 hover:text-white'
                  }`}
                >
                  <Bike className="w-3.5 h-3.5" />
                  <span>Entrega</span>
                </button>
              </div>
            </div>
          </div>

          {/* DYNAMIC MODALITY FIELDS */}
          {/* 1. MESA (1 a 50) */}
          {orderType === 'mesa' && (
            <div className="bg-[#1A1F2B] p-3 rounded-2xl border border-amber-500/30 space-y-2.5 animate-fadeIn">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-amber-400 uppercase flex items-center gap-1.5">
                  <Utensils className="w-4 h-4" />
                  <span>Seleção Rápida de Mesa (1 a 50)</span>
                </span>
                <div className="flex items-center gap-1 text-xs">
                  <span className="text-slate-400 font-bold">Mesa Selecionada:</span>
                  <span className="font-mono font-black text-amber-400 bg-black/40 px-2 py-0.5 rounded border border-amber-500/40">
                    {tableNumber ? `MESA ${tableNumber}` : 'Nenhuma'}
                  </span>
                </div>
              </div>

              {/* Quick Pills for Tables 1 to 12 */}
              <div className="flex flex-wrap gap-1.5">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setTableNumber(num)}
                    className={`w-9 h-8 rounded-lg font-mono font-bold text-xs transition-all ${
                      tableNumber === num
                        ? 'bg-amber-500 text-slate-950 shadow scale-105 font-black'
                        : 'bg-[#0E1015] text-slate-300 border border-slate-700 hover:border-amber-400'
                    }`}
                  >
                    {num}
                  </button>
                ))}
              </div>

              {/* Direct numeric input for 1-50 */}
              <div className="flex items-center gap-2 pt-1 border-t border-slate-800/80">
                <span className="text-[11px] text-slate-400">Ou digite o número da mesa (1 a 50):</span>
                <input
                  type="number"
                  min="1"
                  max="50"
                  placeholder="Ex: 24"
                  value={tableNumber ?? ''}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    setTableNumber(isNaN(val) ? undefined : Math.min(50, Math.max(1, val)));
                  }}
                  className="w-20 bg-[#0E1015] border border-slate-700 rounded-lg px-2 py-1 text-white font-mono font-bold text-center focus:border-amber-500"
                />
              </div>
            </div>
          )}

          {/* 2. RETIRADA / BALCÃO (1 a 100 Dinâmico) */}
          {orderType === 'balcao' && (
            <div className="bg-[#1A1F2B] p-3 rounded-2xl border border-slate-800 space-y-2 animate-fadeIn">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-black text-slate-200 uppercase">
                  <Store className="w-4 h-4 text-amber-400" />
                  <span>Identificação de Retirada no Balcão</span>
                </div>

                {!showPickupInput && !pickupNumber ? (
                  <button
                    type="button"
                    onClick={() => setShowPickupInput(true)}
                    className="text-[11px] text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20 transition-colors"
                  >
                    <Hash className="w-3.5 h-3.5" />
                    <span>+ Senha / Número de Retirada (1 a 100)</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setShowPickupInput(false);
                      setPickupNumber(undefined);
                    }}
                    className="text-[10px] text-slate-400 hover:text-rose-400 font-bold"
                  >
                    Ocultar número
                  </button>
                )}
              </div>

              {/* Dynamic Expandable Input Panel (1 to 100) */}
              {(showPickupInput || pickupNumber) && (
                <div className="p-2.5 bg-[#0E1015] rounded-xl border border-amber-500/30 space-y-2 animate-fadeIn">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-300 font-semibold">
                      Senha de Chamada no Painel / Ticket (1 a 100):
                    </span>
                    <span className="font-mono font-black text-amber-400 text-xs">
                      {pickupNumber ? `Senha #${pickupNumber}` : 'Aguardando número...'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      max="100"
                      autoFocus
                      placeholder="Nº da comanda/senha (1 a 100)"
                      value={pickupNumber ?? ''}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        setPickupNumber(isNaN(val) ? undefined : Math.min(100, Math.max(1, val)));
                      }}
                      className="w-full bg-[#141720] border border-slate-700 rounded-lg px-3 py-1.5 text-white font-mono text-xs focus:border-amber-500"
                    />

                    {/* Quick increment buttons */}
                    <div className="flex gap-1 shrink-0">
                      {[1, 2, 5, 10].map((inc) => (
                        <button
                          key={inc}
                          type="button"
                          onClick={() => setPickupNumber((prev) => Math.min(100, (prev || 0) + inc))}
                          className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded font-mono text-[10px]"
                        >
                          +{inc}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 3. DELIVERY ADDRESS */}
          {orderType === 'delivery' && (
            <div className="p-3 bg-[#1A1F2B] rounded-2xl border border-slate-800 space-y-2 animate-fadeIn">
              <span className="text-[11px] font-bold text-amber-400 uppercase flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" />
                <span>Endereço de Entrega</span>
              </span>
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="text"
                  placeholder="Rua / Avenida"
                  value={street}
                  onChange={(e) => setStreet(e.target.value)}
                  className="col-span-2 bg-[#0E1015] border border-slate-700 rounded-lg px-2.5 py-1.5 text-white"
                />
                <input
                  type="text"
                  placeholder="Número"
                  value={number}
                  onChange={(e) => setNumber(e.target.value)}
                  className="bg-[#0E1015] border border-slate-700 rounded-lg px-2.5 py-1.5 text-white"
                />
              </div>
              <input
                type="text"
                placeholder="Bairro"
                value={neighborhood}
                onChange={(e) => setNeighborhood(e.target.value)}
                className="w-full bg-[#0E1015] border border-slate-700 rounded-lg px-2.5 py-1.5 text-white"
              />
            </div>
          )}

          {/* Customer Info (Optional for 1-Click speed) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">
                Nome do Cliente (Opcional no Envio Rápido)
              </label>
              <input
                type="text"
                placeholder={
                  orderType === 'mesa'
                    ? `Mesa ${tableNumber || '..'}`
                    : orderType === 'balcao' && pickupNumber
                    ? `Retirada #${pickupNumber}`
                    : 'Nome do cliente'
                }
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full bg-[#0E1015] border border-slate-700 rounded-xl px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">
                Telefone / WhatsApp
              </label>
              <input
                type="text"
                placeholder="(11) 99999-0000"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="w-full bg-[#0E1015] border border-slate-700 rounded-xl px-3 py-2 text-white"
              />
            </div>
          </div>

          {/* Product Selector with Filter */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-300 uppercase">
                Cardápio do Restaurante
              </label>
              <input
                type="text"
                placeholder="Buscar item..."
                value={searchItem}
                onChange={(e) => setSearchItem(e.target.value)}
                className="w-44 bg-[#0E1015] border border-slate-700 rounded-lg px-2 py-1 text-white text-[11px]"
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-36 overflow-y-auto pr-1">
              {currentRestItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => addItemToOrder(item.id)}
                  className="p-2 bg-[#1A1F2B] hover:bg-[#252C3D] border border-slate-800 rounded-xl text-left transition-colors flex items-center justify-between group"
                >
                  <div className="truncate">
                    <span className="font-bold text-white block truncate group-hover:text-amber-400">
                      {item.name}
                    </span>
                    <span className="text-[10px] text-amber-400 font-mono">
                      R$ {(item.promoPrice ?? item.price).toFixed(2)}
                    </span>
                  </div>
                  <Plus className="w-3.5 h-3.5 text-slate-400 group-hover:text-amber-400 shrink-0" />
                </button>
              ))}
            </div>
          </div>

          {/* Selected Items Summary */}
          {selectedItems.length > 0 && (
            <div className="bg-[#0E1015] p-3 rounded-xl border border-slate-800 space-y-1.5">
              <span className="text-[11px] font-bold text-slate-400 uppercase">
                Itens Adicionados ({selectedItems.reduce((acc, i) => acc + i.quantity, 0)}):
              </span>
              {selectedItems.map((entry) => {
                const itm = menuItems.find((m) => m.id === entry.itemId);
                if (!itm) return null;
                const unit = itm.promoPrice ?? itm.price;
                return (
                  <div key={entry.itemId} className="flex items-center justify-between text-xs py-1">
                    <span className="text-white font-semibold truncate max-w-[200px]">
                      {itm.name}
                    </span>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 bg-[#1A1F2B] rounded-lg px-1.5 py-0.5 border border-slate-800 font-mono">
                        <button
                          type="button"
                          onClick={() => updateItemQty(entry.itemId, entry.quantity - 1)}
                          className="px-1 text-slate-400 hover:text-white"
                        >
                          -
                        </button>
                        <span className="text-amber-400 font-bold px-1">{entry.quantity}</span>
                        <button
                          type="button"
                          onClick={() => updateItemQty(entry.itemId, entry.quantity + 1)}
                          className="px-1 text-slate-400 hover:text-white"
                        >
                          +
                        </button>
                      </div>
                      <span className="font-mono text-white font-bold w-16 text-right">
                        R$ {(unit * entry.quantity).toFixed(2)}
                      </span>
                    </div>
                  </div>
                );
              })}
              <div className="border-t border-slate-800 pt-2 flex justify-between font-black text-sm text-white">
                <span>Subtotal Pedido:</span>
                <span className="text-amber-400 font-mono">R$ {calculateSubtotal().toFixed(2)}</span>
              </div>
            </div>
          )}

          {/* Payment Method */}
          <div>
            <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">
              Forma de Pagamento no Caixa
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              {(['dinheiro', 'pix', 'cartao_credito', 'cartao_debito'] as PaymentMethod[]).map(
                (pm) => (
                  <button
                    key={pm}
                    type="button"
                    onClick={() => setPaymentMethod(pm)}
                    className={`py-1.5 px-2 rounded-lg text-[10px] font-bold uppercase transition-all ${
                      paymentMethod === pm
                        ? 'bg-amber-500 text-slate-950 font-black shadow'
                        : 'bg-[#1A1F2B] text-slate-400 border border-slate-800 hover:text-white'
                    }`}
                  >
                    {pm === 'dinheiro'
                      ? 'Dinheiro'
                      : pm === 'pix'
                      ? 'PIX'
                      : pm === 'cartao_credito'
                      ? 'Crédito'
                      : 'Débito'}
                  </button>
                )
              )}
            </div>
          </div>

          {/* Auto Print Checkbox */}
          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center gap-2 cursor-pointer text-[11px] text-slate-300">
              <input
                type="checkbox"
                checked={autoPrintAfterSend}
                onChange={(e) => setAutoPrintAfterSend(e.target.checked)}
                className="rounded bg-[#0E1015] border-slate-700 text-amber-500 focus:ring-amber-500"
              />
              <span className="flex items-center gap-1">
                <Printer className="w-3.5 h-3.5 text-slate-400" />
                Imprimir comanda térmica ao confirmar
              </span>
            </label>
          </div>

          {/* ACTION BUTTONS: 1-CLICK DISPATCH VS STANDARD */}
          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition-colors"
            >
              Cancelar
            </button>

            {/* PEDIDO EM 1 CLIQUE (Primary Fast Action) */}
            <button
              type="button"
              onClick={() => handleDispatchOrder(true)}
              disabled={isSubmitting || selectedItems.length === 0}
              className="flex-1 py-3 px-4 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 disabled:opacity-40 text-slate-950 font-black text-xs rounded-xl shadow-lg flex items-center justify-center gap-2 transition-transform active:scale-95"
            >
              <Zap className="w-4 h-4 fill-current" />
              <span>
                {isSubmitting ? 'Enviando...' : '⚡ Pedido em 1 Clique (Envio Imediato KDS)'}
              </span>
            </button>

            {/* Standard Complete Register */}
            <button
              type="button"
              onClick={() => handleDispatchOrder(false)}
              disabled={isSubmitting || selectedItems.length === 0}
              className="py-3 px-4 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 font-black text-xs rounded-xl shadow flex items-center justify-center gap-1.5 transition-colors"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Salvar Pedido</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
