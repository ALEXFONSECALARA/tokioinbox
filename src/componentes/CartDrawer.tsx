import React, { useState } from 'react';
import { useStore } from '../context/StoreContext';
import {
  X,
  ShoppingBag,
  Plus,
  Minus,
  Trash2,
  Tag,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Bike,
  Store,
  UtensilsCrossed,
  Sparkles,
} from 'lucide-react';

interface CartDrawerProps {
  isOpen?: boolean;
  onClose?: () => void;
  onProceedToCheckout?: () => void;
  onOpenCheckout?: () => void;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({
  isOpen: propIsOpen,
  onClose: propOnClose,
  onProceedToCheckout,
  onOpenCheckout,
}) => {
  const {
    cart,
    isCartOpen: contextIsOpen,
    setIsCartOpen,
    updateCartItemQuantity,
    removeFromCart,
    clearCart,
    appliedCoupon,
    applyCoupon,
    removeCoupon,
    restaurants,
    activeRestaurantSlug,
    orderType,
    selectedTable,
  } = useStore();

  const isCartVisible = propIsOpen !== undefined ? propIsOpen : contextIsOpen;
  const handleClose = () => {
    if (propOnClose) propOnClose();
    setIsCartOpen(false);
  };

  const handleCheckoutClick = () => {
    if (onProceedToCheckout) onProceedToCheckout();
    else if (onOpenCheckout) onOpenCheckout();
  };

  const [couponCodeInput, setCouponCodeInput] = useState('');
  const [couponFeedback, setCouponFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // AI Chef Pairing State
  const [aiLoading, setAiLoading] = useState(false);
  const [aiRecommendation, setAiRecommendation] = useState<string | null>(null);

  const handleAskAiChef = async () => {
    setAiLoading(true);
    try {
      const res = await fetch('/api/ai/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurantSlug: activeRestaurantSlug,
          currentItems: cart.map((i) => ({ name: i.menuItem.name, quantity: i.quantity })),
        }),
      });
      const data = await res.json();
      if (data.recommendation) {
        setAiRecommendation(data.recommendation);
      }
    } catch (e) {
      setAiRecommendation(
        'Sugestão do Chef: Harmonize seu pedido com uma bebida artesanal gelada e experimente uma de nossas sobremesas da casa!'
      );
    } finally {
      setAiLoading(false);
    }
  };

  if (!isCartVisible) return null;

  const currentRestaurant = restaurants[activeRestaurantSlug] || restaurants.japones;

  const subtotal = cart.reduce((sum, item) => sum + item.subtotal, 0);

  let discount = 0;
  if (appliedCoupon) {
    if (appliedCoupon.type === 'percent') {
      discount = (subtotal * appliedCoupon.value) / 100;
    } else {
      discount = appliedCoupon.value;
    }
  }
  discount = Math.min(discount, subtotal);

  const deliveryFee = orderType === 'delivery' ? currentRestaurant.deliveryFee : 0;
  const total = Math.max(0, subtotal - discount + deliveryFee);

  const isMinOrderReached =
    orderType !== 'delivery' || subtotal >= currentRestaurant.minOrderValue;

  const handleApplyCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponCodeInput.trim()) return;
    const result = applyCoupon(couponCodeInput);
    if (result.success) {
      setCouponFeedback({ type: 'success', message: result.message });
      setCouponCodeInput('');
    } else {
      setCouponFeedback({ type: 'error', message: result.message });
    }
    setTimeout(() => setCouponFeedback(null), 4000);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        onClick={() => setIsCartOpen(false)}
        className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity"
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col justify-between">
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
                <ShoppingBag className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white">Seu Pedido</h2>
                <p className="text-[11px] text-slate-400 flex items-center gap-1">
                  <span>{currentRestaurant.emoji}</span>
                  <span>{currentRestaurant.name}</span>
                </p>
              </div>
            </div>

            <button
              onClick={handleClose}
              className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Modality Status Bar in Cart */}
          <div className="bg-slate-950 px-4 py-2 border-b border-slate-800/80 flex items-center justify-between text-xs text-slate-300">
            <div className="flex items-center gap-2">
              {orderType === 'delivery' && (
                <>
                  <Bike className="w-4 h-4 text-amber-400" />
                  <span>Entrega Delivery</span>
                </>
              )}
              {orderType === 'retirada' && (
                <>
                  <Store className="w-4 h-4 text-emerald-400" />
                  <span>Retirada no Balcão</span>
                </>
              )}
              {orderType === 'mesa' && (
                <>
                  <UtensilsCrossed className="w-4 h-4 text-amber-400" />
                  <span>
                    {selectedTable ? `Consumo no Salão - Mesa ${selectedTable}` : 'Consumo no Salão'}
                  </span>
                </>
              )}
            </div>

            {cart.length > 0 && (
              <button
                onClick={clearCart}
                className="text-[11px] text-rose-400 hover:text-rose-300 hover:underline flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3" />
                Limpar
              </button>
            )}
          </div>

          {/* Cart Item List */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
                <div className="w-16 h-16 rounded-full bg-slate-800/60 flex items-center justify-center text-3xl mb-3">
                  🛍️
                </div>
                <h3 className="text-base font-bold text-white mb-1">Seu carrinho está vazio</h3>
                <p className="text-xs text-slate-400 max-w-xs mb-6">
                  Navegue pelo cardápio e adicione seus pratos favoritos para iniciar o pedido.
                </p>
                <button
                  onClick={() => setIsCartOpen(false)}
                  className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl transition-colors shadow-md"
                >
                  Explorar Pratos
                </button>
              </div>
            ) : (
              cart.map((item) => (
                <div
                  key={item.id}
                  className="p-3.5 bg-slate-950/60 border border-slate-800/90 rounded-2xl space-y-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <h4 className="text-xs sm:text-sm font-bold text-white leading-snug">
                        {item.menuItem.name}
                      </h4>
                      <p className="text-[11px] text-amber-400 font-semibold mt-0.5">
                        R$ {item.unitTotalPrice.toFixed(2)} cada
                      </p>
                    </div>
                    <span className="text-xs font-black text-white">
                      R$ {item.subtotal.toFixed(2)}
                    </span>
                  </div>

                  {/* Selected Options List */}
                  {item.selectedOptions.length > 0 && (
                    <div className="space-y-0.5 pt-1">
                      {item.selectedOptions.map((opt, idx) => (
                        <div
                          key={idx}
                          className="text-[11px] text-slate-400 flex items-center justify-between"
                        >
                          <span>+ {opt.name}</span>
                          {opt.price > 0 && <span>+R$ {opt.price.toFixed(2)}</span>}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Customer Notes */}
                  {item.notes && (
                    <p className="text-[11px] text-slate-400 italic bg-slate-900/60 px-2 py-1 rounded">
                      Obs: {item.notes}
                    </p>
                  )}

                  {/* Quantity and Remove */}
                  <div className="flex items-center justify-between pt-1 border-t border-slate-800/60">
                    <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-lg px-2 py-1">
                      <button
                        onClick={() => updateCartItemQuantity(item.id, -1)}
                        className="text-slate-400 hover:text-white p-0.5"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="text-xs font-bold text-white min-w-[16px] text-center">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateCartItemQuantity(item.id, 1)}
                        className="text-slate-400 hover:text-white p-0.5"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <button
                      onClick={() => removeFromCart(item.id)}
                      className="text-slate-500 hover:text-rose-400 p-1 transition-colors"
                      title="Remover item"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer / Coupons & Checkout */}
          {cart.length > 0 && (
            <div className="p-4 sm:p-5 bg-slate-950 border-t border-slate-800 space-y-3.5">
              {/* Coupon Form */}
              <div>
                {appliedCoupon ? (
                  <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 text-emerald-400">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <div>
                        <span className="font-bold uppercase tracking-wider">{appliedCoupon.code}</span>
                        <span className="block text-[10px] text-emerald-300/80">
                          {appliedCoupon.type === 'percent'
                            ? `${appliedCoupon.value}% de desconto aplicado`
                            : `R$ ${appliedCoupon.value.toFixed(2)} de desconto aplicado`}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={removeCoupon}
                      className="text-slate-400 hover:text-white text-xs underline"
                    >
                      Remover
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleApplyCoupon} className="flex gap-2">
                    <div className="relative flex-1">
                      <Tag className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={couponCodeInput}
                        onChange={(e) => setCouponCodeInput(e.target.value.toUpperCase())}
                        placeholder="Cupom de desconto (ex: BEMVINDO10)"
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-8 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 uppercase"
                      />
                    </div>
                    <button
                      type="submit"
                      className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl border border-slate-700 transition-colors"
                    >
                      Aplicar
                    </button>
                  </form>
                )}

                {/* Feedback Toast */}
                {couponFeedback && (
                  <p
                    className={`text-[11px] mt-1.5 ${
                      couponFeedback.type === 'success' ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {couponFeedback.message}
                  </p>
                )}

                {/* Quick Coupon Suggestions */}
                {!appliedCoupon && (
                  <div className="flex items-center gap-1.5 mt-2">
                    <span className="text-[10px] text-slate-500">Sugestões:</span>
                    <button
                      type="button"
                      onClick={() => {
                        setCouponCodeInput('BEMVINDO10');
                        applyCoupon('BEMVINDO10');
                      }}
                      className="text-[10px] bg-slate-900 text-amber-400 px-2 py-0.5 rounded border border-slate-800 hover:border-amber-500"
                    >
                      BEMVINDO10 (10% OFF)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCouponCodeInput('TOKIO5');
                        applyCoupon('TOKIO5');
                      }}
                      className="text-[10px] bg-slate-900 text-amber-400 px-2 py-0.5 rounded border border-slate-800 hover:border-amber-500"
                    >
                      TOKIO5 (R$ 5 OFF)
                    </button>
                  </div>
                )}
              </div>

              {/* Chef AI Pairing Recommendation */}
              <div className="bg-slate-900/90 border border-amber-500/30 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-amber-400 text-xs font-bold">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Harmonização do Chef IA</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleAskAiChef}
                    disabled={aiLoading}
                    className="text-[10px] text-amber-300 hover:text-amber-200 font-semibold underline"
                  >
                    {aiLoading ? 'Consultando...' : aiRecommendation ? 'Atualizar' : 'Pedir Dica'}
                  </button>
                </div>
                {aiRecommendation ? (
                  <p className="text-[11px] text-slate-300 leading-relaxed italic bg-slate-950/60 p-2 rounded-lg border border-slate-800">
                    &quot;{aiRecommendation}&quot;
                  </p>
                ) : (
                  <p className="text-[10px] text-slate-400">
                    Quer sugestão de bebida ou sobremesa ideal para acompanhar seus pratos? Clique em &quot;Pedir Dica&quot;.
                  </p>
                )}
              </div>

              {/* Financial Calculation Breakdown */}
              <div className="space-y-1.5 text-xs text-slate-300 pt-1 border-t border-slate-800">
                <div className="flex justify-between">
                  <span className="text-slate-400">Subtotal:</span>
                  <span>R$ {subtotal.toFixed(2)}</span>
                </div>

                {discount > 0 && (
                  <div className="flex justify-between text-emerald-400">
                    <span>Desconto do Cupom:</span>
                    <span>- R$ {discount.toFixed(2)}</span>
                  </div>
                )}

                <div className="flex justify-between">
                  <span className="text-slate-400">Taxa de Entrega:</span>
                  {orderType === 'delivery' ? (
                    <span>R$ {deliveryFee.toFixed(2)}</span>
                  ) : (
                    <span className="text-emerald-400 font-medium">Grátis ({orderType})</span>
                  )}
                </div>

                <div className="flex justify-between text-sm font-black text-white pt-2 border-t border-slate-800">
                  <span>Total a Pagar:</span>
                  <span className="text-amber-400 text-base">R$ {total.toFixed(2)}</span>
                </div>
              </div>

              {/* Minimum Order Warning */}
              {!isMinOrderReached && (
                <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center gap-2 text-xs text-amber-400">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>
                    Pedido mínimo para entrega é de R$ {currentRestaurant.minOrderValue.toFixed(2)}. Faltam R${' '}
                    {(currentRestaurant.minOrderValue - subtotal).toFixed(2)}.
                  </span>
                </div>
              )}

              {/* Checkout Button */}
              <button
                onClick={() => {
                  setIsCartOpen(false);
                  handleCheckoutClick();
                }}
                disabled={!isMinOrderReached}
                className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-black text-sm flex items-center justify-center gap-2 shadow-xl hover:shadow-amber-500/20 transition-all"
              >
                <span>Finalizar Pedido</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
