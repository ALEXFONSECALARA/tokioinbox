import React, { useState, useEffect } from 'react';
import { MenuItem, SelectedChoice, SelectedExtra, CartItem, RestaurantConfig } from '../types';
import { formatCurrency, getBadgeInfo, playSoundEffect } from '../utils/helpers';
import { X, Plus, Minus, Check, Clock, Users, Flame, ShoppingBag } from 'lucide-react';

interface ProductModalProps {
  item: MenuItem | null;
  isOpen: boolean;
  onClose: () => void;
  onAddToCart: (cartItem: CartItem) => void;
  restaurantConfig?: Pick<RestaurantConfig, 'badges'>;
}

export const ProductModal: React.FC<ProductModalProps> = ({
  item,
  isOpen,
  onClose,
  onAddToCart,
  restaurantConfig,
}) => {
  const [quantity, setQuantity] = useState(1);
  const [selectedChoices, setSelectedChoices] = useState<SelectedChoice[]>([]);
  const [selectedExtras, setSelectedExtras] = useState<SelectedExtra[]>([]);
  const [specialNotes, setSpecialNotes] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  // Initialize modal state when item changes
  useEffect(() => {
    if (item) {
      setQuantity(1);
      setSpecialNotes('');
      setValidationError(null);

      // Pre-select required choices default first option
      const initialChoices: SelectedChoice[] = [];
      if (item.choices) {
        item.choices.forEach((group) => {
          if (group.required && group.options.length > 0) {
            initialChoices.push({
              groupId: group.id,
              groupTitle: group.title,
              optionId: group.options[0].id,
              optionName: group.options[0].name,
              price: group.options[0].price,
            });
          }
        });
      }
      setSelectedChoices(initialChoices);
      setSelectedExtras([]);
    }
  }, [item]);

  if (!isOpen || !item) return null;

  // Handle single choice selection per group
  const handleChoiceSelect = (groupId: string, groupTitle: string, optionId: string, optionName: string, price: number) => {
    setSelectedChoices((prev) => {
      const filtered = prev.filter((c) => c.groupId !== groupId);
      return [...filtered, { groupId, groupTitle, optionId, optionName, price }];
    });
    setValidationError(null);
  };

  // Handle extra options quantity increment/decrement
  const handleExtraQuantityChange = (extra: { id: string; name: string; price: number; maxQuantity?: number }, delta: number) => {
    setSelectedExtras((prev) => {
      const existing = prev.find((e) => e.id === extra.id);
      const currentQty = existing ? existing.quantity : 0;
      const nextQty = Math.max(0, currentQty + delta);
      const max = extra.maxQuantity || 5;

      if (nextQty > max) return prev;

      if (nextQty === 0) {
        return prev.filter((e) => e.id !== extra.id);
      }

      if (existing) {
        return prev.map((e) => (e.id === extra.id ? { ...e, quantity: nextQty } : e));
      } else {
        return [...prev, { id: extra.id, name: extra.name, price: extra.price, quantity: nextQty }];
      }
    });
  };

  // Calculate dynamic unit price and total
  const choicesExtraPrice = selectedChoices.reduce((acc, curr) => acc + curr.price, 0);
  const extrasTotalPerUnit = selectedExtras.reduce((acc, curr) => acc + curr.price * curr.quantity, 0);
  const unitPrice = item.price + choicesExtraPrice + extrasTotalPerUnit;
  const totalPrice = unitPrice * quantity;

  const handleAdd = () => {
    // Validate required choice groups
    if (item.choices) {
      for (const group of item.choices) {
        if (group.required) {
          const selected = selectedChoices.find((c) => c.groupId === group.id);
          if (!selected) {
            setValidationError(`Por favor, selecione uma opção em "${group.title}".`);
            return;
          }
        }
      }
    }

    const cartItem: CartItem = {
      id: `${item.id}-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      menuItem: item,
      quantity,
      selectedChoices,
      selectedExtras,
      specialNotes: specialNotes.trim() || undefined,
      unitPrice,
      totalPrice,
    };

    playSoundEffect('success');
    onAddToCart(cartItem);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        id="product-customization-modal"
        className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl border border-stone-200 animate-in slide-in-from-bottom duration-300"
      >
        {/* Modal Header / Media */}
        <div className="relative h-48 sm:h-56 bg-stone-100 flex-shrink-0">
          <img
            src={item.image}
            alt={item.name}
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
          <button
            id="close-product-modal-btn"
            onClick={onClose}
            className="absolute top-3 right-3 p-2 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-md text-white transition-all border border-white/20"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="absolute bottom-3 left-3 right-3 flex flex-wrap gap-1.5">
            {item.tags.map((tag) => {
              const info = getBadgeInfo(tag, restaurantConfig);
              return (
                <span
                  key={tag}
                  className="backdrop-blur-md text-white text-[11px] font-semibold px-2.5 py-0.5 rounded-lg"
                  style={{ backgroundColor: `${info.color}cc` }}
                >
                  {info.emoji ? `${info.emoji} ` : ''}
                  {info.label}
                </span>
              );
            })}
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5">
          <div>
            <h2 className="text-xl font-bold text-stone-900 leading-snug">{item.name}</h2>
            <p className="text-stone-600 text-xs sm:text-sm mt-1 leading-relaxed">{item.description}</p>

            <div className="flex items-center gap-4 text-xs text-stone-400 mt-2">
              {item.preparationTimeMinutes && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {item.preparationTimeMinutes} min de preparo
                </span>
              )}
              {item.servesCount && (
                <span className="flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" />
                  Serve {item.servesCount} {item.servesCount > 1 ? 'pessoas' : 'pessoa'}
                </span>
              )}
              {item.calories && (
                <span className="flex items-center gap-1">
                  <Flame className="w-3.5 h-3.5 text-[var(--brand)]" />
                  {item.calories} kcal
                </span>
              )}
            </div>
          </div>

          {/* Validation Alert */}
          {validationError && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs p-3 rounded-xl font-medium">
              {validationError}
            </div>
          )}

          {/* Choice Groups (e.g. Ponto da carne, Escolha do Pão) */}
          {item.choices &&
            item.choices.map((group) => (
              <div key={group.id} className="bg-stone-50 p-3.5 rounded-2xl border border-stone-200">
                <div className="flex items-center justify-between mb-2.5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-stone-800">
                    {group.title}
                  </h4>
                  {group.required ? (
                    <span className="text-[10px] uppercase font-extrabold bg-[var(--brand-tint)] text-amber-900 px-2 py-0.5 rounded-md">
                      Obrigatório
                    </span>
                  ) : (
                    <span className="text-[10px] text-stone-400 font-medium">Opcional</span>
                  )}
                </div>

                <div className="space-y-1.5">
                  {group.options.map((opt) => {
                    const isSelected = selectedChoices.some(
                      (c) => c.groupId === group.id && c.optionId === opt.id
                    );
                    return (
                      <label
                        key={opt.id}
                        className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-white border-[var(--brand)] shadow-xs ring-1 ring-[var(--brand)]'
                            : 'bg-white border-stone-200 hover:border-stone-300'
                        }`}
                        onClick={() =>
                          handleChoiceSelect(group.id, group.title, opt.id, opt.name, opt.price)
                        }
                      >
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                              isSelected
                                ? 'border-[var(--brand)] bg-[var(--brand)] text-white'
                                : 'border-stone-300'
                            }`}
                          >
                            {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                          </div>
                          <span className="text-xs font-medium text-stone-800">{opt.name}</span>
                        </div>
                        {opt.price > 0 && (
                          <span className="text-xs font-bold text-stone-700">
                            +{formatCurrency(opt.price)}
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}

          {/* Extras / Adicionais */}
          {item.extras && item.extras.length > 0 && (
            <div className="bg-stone-50 p-3.5 rounded-2xl border border-stone-200">
              <div className="flex items-center justify-between mb-2.5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-stone-800">
                  Adicionais & Extras
                </h4>
                <span className="text-[10px] text-stone-400 font-medium">Opcional</span>
              </div>

              <div className="space-y-2">
                {item.extras.map((extra) => {
                  const selected = selectedExtras.find((e) => e.id === extra.id);
                  const currentQty = selected ? selected.quantity : 0;
                  return (
                    <div
                      key={extra.id}
                      className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-stone-200"
                    >
                      <div>
                        <p className="text-xs font-medium text-stone-800">{extra.name}</p>
                        <p className="text-xs font-bold text-[var(--brand-dark)] mt-0.5">
                          +{formatCurrency(extra.price)}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        {currentQty > 0 && (
                          <>
                            <button
                              id={`extra-minus-${extra.id}`}
                              onClick={() => handleExtraQuantityChange(extra, -1)}
                              className="w-7 h-7 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-800 flex items-center justify-center font-bold"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="text-xs font-bold w-4 text-center">{currentQty}</span>
                          </>
                        )}
                        <button
                          id={`extra-plus-${extra.id}`}
                          onClick={() => handleExtraQuantityChange(extra, 1)}
                          className="w-7 h-7 rounded-lg bg-[var(--brand)] hover:bg-[var(--brand-light)] text-slate-950 flex items-center justify-center font-bold shadow-xs"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Observações / Observações Especiais */}
          {item.allowSpecialNotes !== false && (
            <div>
              <label htmlFor="modal-special-notes" className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1.5">
                Alguma observação especial?
              </label>
              <textarea
                id="modal-special-notes"
                value={specialNotes}
                onChange={(e) => setSpecialNotes(e.target.value)}
                placeholder="Ex: Tirar cebola, molho à parte, bem passado, sem picles..."
                rows={2}
                maxLength={160}
                className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl text-xs sm:text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[var(--brand)] focus:bg-white transition-all"
              />
              <span className="text-[10px] text-stone-400 text-right block mt-0.5">
                {specialNotes.length}/160 caracteres
              </span>
            </div>
          )}
        </div>

        {/* Modal Sticky Bottom Controls: Quantity + Add CTA */}
        <div className="p-4 sm:p-5 bg-white border-t border-stone-200 flex items-center gap-3">
          {/* Quantity selector */}
          <div className="flex items-center bg-stone-100 rounded-xl p-1 border border-stone-200">
            <button
              id="modal-qty-minus"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              disabled={quantity <= 1}
              className="w-8 h-8 rounded-lg bg-white text-stone-800 disabled:opacity-40 flex items-center justify-center font-bold shadow-2xs"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <span className="w-8 text-center text-xs sm:text-sm font-extrabold text-stone-900">
              {quantity}
            </span>
            <button
              id="modal-qty-plus"
              onClick={() => setQuantity((q) => q + 1)}
              className="w-8 h-8 rounded-lg bg-white text-stone-800 flex items-center justify-center font-bold shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Add to Cart CTA */}
          <button
            id="modal-add-to-cart-cta"
            onClick={handleAdd}
            className="flex-1 py-3 px-4 rounded-xl bg-[var(--brand)] hover:bg-[var(--brand-light)] active:scale-[0.98] text-slate-950 font-bold text-xs sm:text-sm flex items-center justify-between transition-all shadow-md"
          >
            <span className="flex items-center gap-1.5">
              <ShoppingBag className="w-4 h-4" />
              <span>Adicionar ao Pedido</span>
            </span>
            <span className="bg-slate-950 text-[var(--brand-light)] px-2.5 py-1 rounded-lg text-xs font-black">
              {formatCurrency(totalPrice)}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
