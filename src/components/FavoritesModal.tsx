import React from 'react';
import { MenuItem } from '../types';
import { formatCurrency } from '../utils/helpers';
import { X, Heart, Plus, ShoppingBag } from 'lucide-react';

interface FavoritesModalProps {
  isOpen: boolean;
  onClose: () => void;
  favorites: MenuItem[];
  onSelectDish: (dish: MenuItem) => void;
  onRemoveFavorite: (id: string) => void;
}

export const FavoritesModal: React.FC<FavoritesModalProps> = ({
  isOpen,
  onClose,
  favorites,
  onSelectDish,
  onRemoveFavorite,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      <div
        id="favorites-modal-container"
        className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-stone-200 overflow-hidden my-auto max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 bg-stone-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-[var(--accent-red)] text-white">
              <Heart className="w-5 h-5 fill-white" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black tracking-tight">Pratos Favoritos</h2>
              <p className="text-xs text-stone-300">
                {favorites.length} {favorites.length === 1 ? 'prato salvo' : 'pratos salvos'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-stone-800 text-stone-400 hover:text-white transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* List */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-3 flex-1">
          {favorites.length === 0 ? (
            <div className="text-center py-10 text-stone-400">
              <Heart className="w-12 h-12 text-stone-200 mx-auto mb-2" />
              <h3 className="font-bold text-stone-700 text-sm">Nenhum prato favoritado ainda</h3>
              <p className="text-xs text-stone-400 mt-1 max-w-xs mx-auto">
                Clique no coração dos pratos que você mais gosta para encontrá-los facilmente aqui!
              </p>
            </div>
          ) : (
            favorites.map((dish) => (
              <div
                key={dish.id}
                className="flex items-center gap-3 p-3 bg-stone-50 rounded-2xl border border-stone-200"
              >
                <img
                  src={dish.image}
                  alt={dish.name}
                  className="w-16 h-16 rounded-xl object-cover bg-stone-200 flex-shrink-0"
                  referrerPolicy="no-referrer"
                />
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-stone-900 text-xs sm:text-sm truncate">{dish.name}</h4>
                  <p className="text-xs font-black text-[var(--brand-dark)] mt-0.5">{formatCurrency(dish.price)}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => onRemoveFavorite(dish.id)}
                    className="p-2 text-stone-400 hover:text-[var(--accent-red)] rounded-xl"
                    title="Remover"
                  >
                    <Heart className="w-4 h-4 fill-[var(--accent-red)] text-[var(--accent-red)]" />
                  </button>
                  <button
                    onClick={() => {
                      onClose();
                      onSelectDish(dish);
                    }}
                    className="px-3 py-1.5 bg-[var(--brand)] hover:bg-[var(--brand-light)] text-slate-950 rounded-xl text-xs font-bold flex items-center gap-1 shadow-2xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Pedir</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
