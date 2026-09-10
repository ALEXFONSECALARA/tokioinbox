import React, { useState } from 'react';
import { CartItem, RestaurantConfig, MenuItem, DeliveryAddress } from '../types';
import { formatCurrency, COUPONS } from '../utils/helpers';
import { 
  X, 
  Trash2, 
  Plus, 
  Minus, 
  ShoppingBag, 
  ArrowRight, 
  Tag, 
  Sparkles, 
  Check, 
  Bike,
  AlertCircle,
  MapPin,
  Flame,
  PlusCircle
} from 'lucide-react';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  onUpdateQuantity: (id: string, delta: number) => void;
  onRemoveItem: (id: string) => void;
  onClearCart: () => void;
  appliedCoupon: string | null;
  onApplyCoupon: (couponCode: string) => boolean;
  onRemoveCoupon: () => void;
  restaurantConfig: RestaurantConfig;
  onProceedToCheckout: () => void;
  allMenuItems?: MenuItem[];
  onQuickAddItem?: (item: MenuItem) => void;
  currentAddress?: DeliveryAddress | null;
  onOpenAddressModal?: () => void;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({
  isOpen,
  onClose,
  items,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  appliedCoupon,
  onApplyCoupon,
  onRemoveCoupon,
  restaurantConfig,
  onProceedToCheckout,
  allMenuItems = [],
  onQuickAddItem,
  currentAddress,
  onOpenAddressModal,
}) => {
  const [couponInput, setCouponInput] = useState('');
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponSuccess, setCouponSuccess] = useState<string | null>(null);

  if (!isOpen) return null;

  const subtotal = items.reduce((acc, item) => acc + item.totalPrice, 0);

  // Calculate discount based on active coupon
  let discountAmount = 0;
  if (appliedCoupon && COUPONS[appliedCoupon]) {
    const coupon = COUPONS[appliedCoupon];
    if (coupon.discountPercent) {
      discountAmount = (subtotal * coupon.discountPercent) / 100;
    } else if (coupon.fixedDiscount) {
      discountAmount = Math.min(coupon.fixedDiscount, subtotal);
    }
  }

  // Free delivery progress calculation
  const freeThreshold = restaurantConfig.freeDeliveryThreshold || 80;
  const isFreeDelivery = subtotal >= freeThreshold;
  const remainingForFree = Math.max(0, freeThreshold - subtotal);
  const freePercent = Math.min(100, Math.round((subtotal / freeThreshold) * 100));

  // Minimum Order Check
  const minOrder = restaurantConfig.minimumOrder || 25;
  const meetsMinOrder = subtotal >= minOrder;
  const remainingForMin = Math.max(0, minOrder - subtotal);

  // Quick delivery upsell items (beverages and desserts not already in cart)
  const cartItemIds = items.map((i) => i.menuItem.id);
  const upsellItems = allMenuItems
    .filter((m) => (m.categoryId === 'bebidas' || m.categoryId === 'sobremesas' || m.categoryId === 'porcoes') && !cartItemIds.includes(m.id))
    .slice(0, 3);

  const total = Math.max(0, subtotal - discountAmount);

  const handleApplyCouponSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCouponError(null);
    setCouponSuccess(null);

    const cleanCode = couponInput.trim().toUpperCase();
    if (!cleanCode) return;

    const coupon = COUPONS[cleanCode];
    if (!coupon) {
      setCouponError('Cupom inválido. Tente BEMVINDO10, SABOR15 ou FRETEGRATIS.');
      return;
    }

    if (subtotal < coupon.minTotal) {
      setCouponError(`Este cupom exige pedido mínimo de ${formatCurrency(coupon.minTotal)}.`);
      return;
    }

    const success = onApplyCoupon(cleanCode);
    if (success) {
      setCouponSuccess(`Cupom "${cleanCode}" aplicado com sucesso!`);
      setCouponInput('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-xs flex justify-end animate-in fade-in duration-200">
      <div
        id="cart-slide-drawer"
        className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col justify-between border-l border-stone-200 animate-in slide-in-from-right duration-300"
      >
        {/* Drawer Header */}
        <div className="p-4 sm:p-5 border-b border-stone-200 flex items-center justify-between bg-stone-50">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-[var(--brand)] text-slate-950">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-black text-stone-900 text-base">Seu Carrinho Delivery</h2>
              <p className="text-stone-500 text-xs">
                {items.length} {items.length === 1 ? 'item adicionado' : 'itens adicionados'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {items.length > 0 && (
              <button
                id="clear-cart-btn"
                onClick={onClearCart}
                className="text-stone-400 hover:text-rose-600 p-2 text-xs font-medium transition-colors"
                title="Limpar tudo"
              >
                Limpar
              </button>
            )}
            <button
              id="close-cart-btn"
              onClick={onClose}
              className="p-2 rounded-full hover:bg-stone-200 text-stone-600 transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Free Shipping Meter — só aparece se o restaurante ativou a promoção */}
        {items.length > 0 && (restaurantConfig.freeDeliveryEnabled ?? true) && (
          <div className="bg-[var(--brand-tint)] px-4 py-2.5 border-b border-[var(--brand-tint)] flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-amber-900 flex items-center gap-1.5">
                <Bike className="w-3.5 h-3.5 text-[var(--brand-dark)]" />
                {isFreeDelivery ? (
                  <span className="text-emerald-700 font-bold flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                    Parabéns! Você ganhou Frete Grátis!
                  </span>
                ) : (
                  <span>
                    Adicione mais <strong>{formatCurrency(remainingForFree)}</strong> para Frete Grátis
                  </span>
                )}
              </span>
              <span className="font-bold text-amber-800 text-[11px]">{freePercent}%</span>
            </div>
            <div className="w-full bg-[var(--brand-tint)]/80 rounded-full h-1.5 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  isFreeDelivery ? 'bg-emerald-500' : 'bg-[var(--brand)]'
                }`}
                style={{ width: `${freePercent}%` }}
              />
            </div>
          </div>
        )}

        {/* Drawer Item List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
          {/* Address Quick Card in Cart */}
          {items.length > 0 && onOpenAddressModal && (
            <div 
              onClick={onOpenAddressModal}
              className="p-3 bg-stone-50 border border-stone-200 rounded-2xl flex items-center justify-between cursor-pointer hover:bg-stone-100 transition-all text-xs"
            >
              <div className="flex items-center gap-2 text-stone-700 truncate">
                <MapPin className="w-4 h-4 text-[var(--brand-dark)] flex-shrink-0" />
                <div className="truncate">
                  <span className="font-bold block text-stone-900 truncate">
                    {currentAddress ? `${currentAddress.street}, ${currentAddress.number}` : 'Definir endereço de entrega'}
                  </span>
                  <span className="text-[11px] text-stone-500">
                    {currentAddress ? currentAddress.neighborhood : 'Clique para calcular taxa de entrega'}
                  </span>
                </div>
              </div>
              <span className="text-amber-700 font-bold text-[11px] hover:underline flex-shrink-0">
                {currentAddress ? 'Alterar' : 'Definir'}
              </span>
            </div>
          )}

          {items.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center py-12 text-stone-400">
              <div className="w-16 h-16 rounded-full bg-stone-100 flex items-center justify-center mb-3">
                <ShoppingBag className="w-8 h-8 text-stone-300" />
              </div>
              <h3 className="font-bold text-stone-700 text-sm">Seu carrinho está vazio</h3>
              <p className="text-xs text-stone-400 max-w-xs mt-1">
                Explore as delícias do nosso cardápio e monte seu pedido de delivery!
              </p>
              <button
                id="empty-cart-explore-btn"
                onClick={onClose}
                className="mt-4 px-4 py-2 rounded-xl bg-[var(--brand)] hover:bg-[var(--brand-light)] text-stone-950 font-bold text-xs transition-all shadow-xs"
              >
                Ver Cardápio
              </button>
            </div>
          ) : (
            items.map((item) => (
              <div
                key={item.id}
                id={`cart-item-${item.id}`}
                className="bg-white p-3 rounded-2xl border border-stone-200 shadow-2xs space-y-2"
              >
                <div className="flex gap-3">
                  <img
                    src={item.menuItem.image}
                    alt={item.menuItem.name}
                    className="w-16 h-16 rounded-xl object-cover flex-shrink-0 bg-stone-100"
                    referrerPolicy="no-referrer"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-1">
                      <h4 className="font-bold text-stone-900 text-xs sm:text-sm line-clamp-1">
                        {item.menuItem.name}
                      </h4>
                      <button
                        id={`remove-item-${item.id}`}
                        onClick={() => onRemoveItem(item.id)}
                        className="text-stone-400 hover:text-rose-600 p-1 transition-colors"
                        title="Remover item"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <p className="text-xs font-extrabold text-stone-800 mt-0.5">
                      {formatCurrency(item.totalPrice)}
                    </p>

                    {/* Breakdown of Choices & Extras */}
                    {item.selectedChoices.length > 0 && (
                      <div className="text-[11px] text-stone-500 mt-1 space-y-0.5">
                        {item.selectedChoices.map((c) => (
                          <div key={c.groupId} className="flex items-center gap-1">
                            <span className="text-stone-400">•</span>
                            <span>{c.groupTitle}: {c.optionName}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {item.selectedExtras.length > 0 && (
                      <div className="text-[11px] text-amber-700 mt-0.5 space-y-0.5">
                        {item.selectedExtras.map((e) => (
                          <div key={e.id} className="flex items-center gap-1">
                            <span>+ {e.quantity}x {e.name}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {item.specialNotes && (
                      <p className="text-[11px] text-stone-500 italic mt-1 bg-stone-50 p-1 rounded-md border border-stone-100">
                        Obs: {item.specialNotes}
                      </p>
                    )}
                  </div>
                </div>

                {/* Quantity Controls inside Cart */}
                <div className="flex items-center justify-between pt-2 border-t border-stone-100">
                  <span className="text-[11px] text-stone-400">
                    {formatCurrency(item.unitPrice)} un.
                  </span>
                  <div className="flex items-center bg-stone-100 rounded-lg p-0.5 border border-stone-200">
                    <button
                      id={`cart-minus-${item.id}`}
                      onClick={() => onUpdateQuantity(item.id, -1)}
                      className="w-6 h-6 rounded-md bg-white text-stone-800 flex items-center justify-center font-bold shadow-2xs hover:bg-stone-50"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-7 text-center text-xs font-bold text-stone-900">
                      {item.quantity}
                    </span>
                    <button
                      id={`cart-plus-${item.id}`}
                      onClick={() => onUpdateQuantity(item.id, 1)}
                      className="w-6 h-6 rounded-md bg-white text-stone-800 flex items-center justify-center font-bold shadow-2xs hover:bg-stone-50"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}

          {/* Upselling Section: "Turbine seu Delivery" */}
          {items.length > 0 && upsellItems.length > 0 && onQuickAddItem && (
            <div className="bg-stone-50 p-3 rounded-2xl border border-stone-200 space-y-2">
              <span className="text-[11px] font-black text-stone-700 uppercase tracking-wider flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-[var(--brand)]" />
                Combina com seu pedido (Bebidas & Doces):
              </span>
              <div className="space-y-1.5">
                {upsellItems.map((uItem) => (
                  <div
                    key={uItem.id}
                    className="p-2 bg-white rounded-xl border border-stone-200 flex items-center justify-between gap-2 shadow-2xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <img
                        src={uItem.image}
                        alt={uItem.name}
                        className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-stone-900 truncate">{uItem.name}</p>
                        <p className="text-[11px] text-amber-700 font-extrabold">{formatCurrency(uItem.price)}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onQuickAddItem(uItem)}
                      className="px-2.5 py-1 bg-[var(--brand)] hover:bg-[var(--brand-light)] text-slate-950 font-bold text-xs rounded-lg flex items-center gap-1 transition-all shadow-2xs flex-shrink-0"
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                      <span>Adicionar</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Coupon Suggestion chips */}
          {items.length > 0 && !appliedCoupon && (
            <div className="bg-stone-50 p-3 rounded-2xl border border-stone-200">
              <span className="text-[11px] font-bold text-stone-600 uppercase flex items-center gap-1 mb-2">
                <Tag className="w-3 h-3 text-[var(--brand)]" />
                Cupons de Desconto Disponíveis
              </span>
              <div className="flex flex-wrap gap-1.5">
                {Object.values(COUPONS).map((c) => (
                  <button
                    key={c.code}
                    onClick={() => {
                      setCouponInput(c.code);
                      onApplyCoupon(c.code);
                    }}
                    className="text-[11px] font-semibold bg-white hover:bg-[var(--brand-tint)] text-stone-700 border border-stone-200 hover:border-[var(--brand-light)] px-2 py-1 rounded-lg transition-all"
                  >
                    {c.code}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Drawer Footer & Checkout Action */}
        {items.length > 0 && (
          <div className="p-4 sm:p-5 bg-white border-t border-stone-200 space-y-3">
            {/* Coupon Application Form */}
            {appliedCoupon ? (
              <div className="bg-emerald-50 border border-emerald-200 p-2.5 rounded-xl flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600" />
                  <div>
                    <span className="font-bold text-emerald-900">Cupom {appliedCoupon}</span>
                    <span className="text-emerald-700 block text-[11px]">
                      -{formatCurrency(discountAmount)} aplicado
                    </span>
                  </div>
                </div>
                <button
                  id="remove-coupon-btn"
                  onClick={onRemoveCoupon}
                  className="text-stone-400 hover:text-rose-600 font-bold p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <form onSubmit={handleApplyCouponSubmit} className="flex gap-2">
                <input
                  id="coupon-input"
                  type="text"
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                  placeholder="Cupom (ex: BEMVINDO10)"
                  className="flex-1 px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs uppercase font-bold placeholder:normal-case placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-[var(--brand)]"
                />
                <button
                  id="apply-coupon-btn"
                  type="submit"
                  className="px-3.5 py-2 bg-stone-900 hover:bg-stone-800 text-white font-bold text-xs rounded-xl transition-all"
                >
                  Aplicar
                </button>
              </form>
            )}

            {couponError && (
              <p className="text-rose-600 text-[11px] flex items-center gap-1">
                <AlertCircle className="w-3 h-3 flex-shrink-0" />
                {couponError}
              </p>
            )}
            {couponSuccess && (
              <p className="text-emerald-600 text-[11px] flex items-center gap-1">
                <Check className="w-3 h-3 flex-shrink-0" />
                {couponSuccess}
              </p>
            )}

            {/* Financial Summary */}
            <div className="space-y-1 text-xs text-stone-600 pt-1">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span className="font-bold text-stone-900">{formatCurrency(subtotal)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-emerald-600 font-semibold">
                  <span>Desconto ({appliedCoupon})</span>
                  <span>-{formatCurrency(discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between items-baseline pt-2 border-t border-stone-100">
                <span className="text-sm font-extrabold text-stone-900">Total dos Itens</span>
                <span className="text-lg font-black text-[var(--brand-dark)]">{formatCurrency(total)}</span>
              </div>
            </div>

            {/* Minimum Order Warning if applicable */}
            {!meetsMinOrder && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600" />
                <span>
                  Pedido mínimo para entrega é <strong>{formatCurrency(minOrder)}</strong>. Faltam <strong>{formatCurrency(remainingForMin)}</strong>.
                </span>
              </div>
            )}

            {/* Proceed CTA */}
            <button
              id="proceed-checkout-btn"
              disabled={!meetsMinOrder}
              onClick={() => {
                onClose();
                onProceedToCheckout();
              }}
              className="w-full py-3.5 px-4 rounded-2xl bg-[var(--brand)] hover:bg-[var(--brand-light)] disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.99] text-slate-950 font-black text-sm flex items-center justify-center gap-2 transition-all shadow-md"
            >
              <span>Avançar para Entrega & Pagamento</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

