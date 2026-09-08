import React, { useState } from 'react';
import { MenuItem, CartItemOptionSelected } from '../types/restaurant';
import { useStore } from '../context/StoreContext';
import { X, Plus, Minus, Check, Sparkles } from 'lucide-react';

interface ProductModalProps {
  item?: MenuItem;
  product?: MenuItem;
  onClose: () => void;
}

export const ProductModal: React.FC<ProductModalProps> = ({ item: propItem, product, onClose }) => {
  const item = propItem || product;
  if (!item) return null;
  const { addToCart } = useStore();
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');
  const [selectedOptions, setSelectedOptions] = useState<CartItemOptionSelected[]>([]);

  const basePrice = item.promoPrice ?? item.price;
  const optionsTotal = selectedOptions.reduce((sum, opt) => sum + opt.price, 0);
  const unitPrice = basePrice + optionsTotal;
  const totalPrice = unitPrice * quantity;

  const toggleOption = (
    groupId: string,
    groupTitle: string,
    optionId: string,
    optionName: string,
    optionPrice: number,
    maxSelections?: number
  ) => {
    setSelectedOptions((prev) => {
      const isAlreadySelected = prev.some(
        (o) => o.groupId === groupId && o.optionId === optionId
      );

      if (isAlreadySelected) {
        return prev.filter((o) => !(o.groupId === groupId && o.optionId === optionId));
      }

      // If maxSelections is 1 (radio-like behavior)
      if (maxSelections === 1) {
        const filtered = prev.filter((o) => o.groupId !== groupId);
        return [
          ...filtered,
          {
            groupId,
            groupTitle,
            optionId,
            name: optionName,
            price: optionPrice,
          },
        ];
      }

      // Check max selections limit
      const currentInGroup = prev.filter((o) => o.groupId === groupId);
      if (maxSelections && currentInGroup.length >= maxSelections) {
        return prev;
      }

      return [
        ...prev,
        {
          groupId,
          groupTitle,
          optionId,
          name: optionName,
          price: optionPrice,
        },
      ];
    });
  };

  const handleAdd = () => {
    addToCart(item, quantity, selectedOptions, notes.trim() || undefined);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl my-auto animate-in fade-in zoom-in-95 duration-200">
        {/* Header Image */}
        <div className="relative h-56 sm:h-64 w-full bg-slate-800 overflow-hidden">
          <img
            src={item.image}
            alt={item.name}
            className="w-full h-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-black/40" />

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-9 h-9 rounded-full bg-slate-950/80 hover:bg-slate-900 text-white border border-slate-700/60 backdrop-blur-md flex items-center justify-center transition-all shadow-md"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Tags */}
          <div className="absolute bottom-3 left-4 flex gap-1.5 flex-wrap">
            {item.tags?.includes('mais_vendido') && (
              <span className="px-2.5 py-1 rounded-full bg-amber-500 text-slate-950 font-extrabold text-[11px] shadow-sm flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Mais Vendido
              </span>
            )}
            {item.tags?.includes('promocao') && (
              <span className="px-2.5 py-1 rounded-full bg-rose-600 text-white font-extrabold text-[11px] shadow-sm">
                Oferta Especial
              </span>
            )}
            {item.tags?.includes('vegetariano') && (
              <span className="px-2.5 py-1 rounded-full bg-emerald-600 text-white font-extrabold text-[11px] shadow-sm">
                Vegetariano
              </span>
            )}
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 max-h-[60vh] overflow-y-auto space-y-5">
          <div>
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-xl font-bold text-white tracking-tight leading-snug">
                {item.name}
              </h2>
              <div className="text-right shrink-0">
                {item.promoPrice ? (
                  <div>
                    <span className="text-xs text-slate-400 line-through block">
                      R$ {item.price.toFixed(2)}
                    </span>
                    <span className="text-lg font-black text-amber-400">
                      R$ {item.promoPrice.toFixed(2)}
                    </span>
                  </div>
                ) : (
                  <span className="text-lg font-black text-amber-400">
                    R$ {item.price.toFixed(2)}
                  </span>
                )}
              </div>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 mt-2 leading-relaxed">
              {item.description}
            </p>
          </div>

          {/* Option Groups (Adicionais) */}
          {item.optionGroups && item.optionGroups.length > 0 && (
            <div className="space-y-4 pt-2 border-t border-slate-800">
              {item.optionGroups.map((group) => (
                <div key={group.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                      {group.title}
                    </h3>
                    <span className="text-[10px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                      {group.maxSelections === 1
                        ? 'Escolha 1 opção'
                        : group.maxSelections
                        ? `Até ${group.maxSelections} opções`
                        : 'Opcional'}
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    {group.options.map((option) => {
                      const isSelected = selectedOptions.some(
                        (o) => o.groupId === group.id && o.optionId === option.id
                      );
                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() =>
                            toggleOption(
                              group.id,
                              group.title,
                              option.id,
                              option.name,
                              option.price,
                              group.maxSelections
                            )
                          }
                          className={`w-full p-3 rounded-xl border text-left flex items-center justify-between transition-all ${
                            isSelected
                              ? 'bg-amber-500/10 border-amber-500/60 text-white'
                              : 'bg-slate-950/60 hover:bg-slate-800/80 border-slate-800 text-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-5 h-5 rounded-md flex items-center justify-center border transition-all ${
                                isSelected
                                  ? 'bg-amber-500 border-amber-400 text-slate-950'
                                  : 'border-slate-600 bg-slate-800'
                              }`}
                            >
                              {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                            </div>
                            <span className="text-xs font-medium">{option.name}</span>
                          </div>
                          <span className="text-xs font-bold text-amber-400">
                            {option.price > 0 ? `+ R$ ${option.price.toFixed(2)}` : 'Grátis'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Observations */}
          <div className="pt-2 border-t border-slate-800">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
              Alguma observação? (Opcional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Tirar cebola, ponto da carne ao ponto, molho à parte..."
              maxLength={140}
              rows={2}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors resize-none"
            />
          </div>
        </div>

        {/* Footer / Add Action */}
        <div className="p-4 sm:p-5 bg-slate-950 border-t border-slate-800 flex items-center justify-between gap-4">
          {/* Quantity Controls */}
          <div className="flex items-center gap-3 bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5">
            <button
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              disabled={quantity <= 1}
              className="text-slate-400 hover:text-white disabled:opacity-30 p-1"
            >
              <Minus className="w-4 h-4" />
            </button>
            <span className="text-sm font-extrabold text-white min-w-[20px] text-center">
              {quantity}
            </span>
            <button
              onClick={() => setQuantity((q) => q + 1)}
              className="text-slate-400 hover:text-white p-1"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* Add to Cart CTA */}
          <button
            onClick={handleAdd}
            className="flex-1 py-3.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs sm:text-sm flex items-center justify-between shadow-lg hover:shadow-amber-500/20 transition-all active:scale-[0.98]"
          >
            <span>Adicionar ao Pedido</span>
            <span>R$ {totalPrice.toFixed(2)}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
