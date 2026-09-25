import React, { useState, useMemo } from 'react';
import { MenuItem, MenuCategory, RestaurantSlug } from '../types/restaurant';
import { useStore } from '../context/StoreContext';
import { ProductModal } from './ProductModal';
import { Search, Plus, Sparkles, Tag, Leaf, X, Flame } from 'lucide-react';

interface MenuSectionProps {
  restaurantSlug?: RestaurantSlug;
  onSelectProduct?: (item: MenuItem) => void;
}

export const MenuSection: React.FC<MenuSectionProps> = ({
  restaurantSlug: propSlug,
  onSelectProduct,
}) => {
  const { categories, menuItems, activeRestaurantSlug } = useStore();
  const restaurantSlug = propSlug || activeRestaurantSlug;
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string>('all');
  const [modalItem, setModalItem] = useState<MenuItem | null>(null);

  const handleOpenItem = (item: MenuItem) => {
    if (onSelectProduct) {
      onSelectProduct(item);
    } else {
      setModalItem(item);
    }
  };

  // Filter categories for this restaurant
  const restaurantCategories = useMemo(() => {
    return categories
      .filter((cat) => cat.restaurantSlug === restaurantSlug)
      .sort((a, b) => a.order - b.order);
  }, [categories, restaurantSlug]);

  // Filter items for this restaurant
  const filteredItems = useMemo(() => {
    return menuItems.filter((item) => {
      if (item.restaurantSlug !== restaurantSlug) return false;
      if (!item.available) return false;

      // Category filter
      if (selectedCategory !== 'all' && item.categoryId !== selectedCategory) {
        return false;
      }

      // Tag filter
      if (selectedTag === 'mais_vendido' && !item.tags?.includes('mais_vendido')) return false;
      if (selectedTag === 'promocao' && !item.tags?.includes('promocao')) return false;
      if (selectedTag === 'vegetariano' && !item.tags?.includes('vegetariano')) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = item.name.toLowerCase().includes(q);
        const matchesDesc = item.description.toLowerCase().includes(q);
        if (!matchesName && !matchesDesc) return false;
      }

      return true;
    });
  }, [menuItems, restaurantSlug, selectedCategory, selectedTag, searchQuery]);

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
      {/* Search & Luxury Tag Filters in Glassmorphism Bar */}
      <div className="glass-gold-card rounded-2xl p-4 sm:p-5 mb-6 space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-amber-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar pratos, sushis, massas, ingredientes selecionados..."
              className="w-full bg-black/80 border border-slate-800 rounded-xl pl-10 pr-9 py-2.5 text-xs sm:text-sm text-white placeholder-slate-400 focus:outline-none focus:border-amber-400 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Quick Dietary / Highlight Tags */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            <button
              onClick={() => setSelectedTag('all')}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                selectedTag === 'all'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50'
                  : 'bg-black/50 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              Todos os Pratos
            </button>
            <button
              onClick={() => setSelectedTag(selectedTag === 'mais_vendido' ? 'all' : 'mais_vendido')}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 transition-all ${
                selectedTag === 'mais_vendido'
                  ? 'bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 font-black shadow-[0_0_12px_rgba(245,158,11,0.5)]'
                  : 'bg-black/50 text-slate-300 hover:text-amber-300 border border-slate-800'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Mais Vendidos</span>
            </button>
            <button
              onClick={() => setSelectedTag(selectedTag === 'promocao' ? 'all' : 'promocao')}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 transition-all ${
                selectedTag === 'promocao'
                  ? 'bg-rose-500 text-white font-bold shadow-md'
                  : 'bg-black/50 text-slate-300 hover:text-rose-400 border border-slate-800'
              }`}
            >
              <Tag className="w-3.5 h-3.5 text-rose-400" />
              <span>Promoções</span>
            </button>
            <button
              onClick={() => setSelectedTag(selectedTag === 'vegetariano' ? 'all' : 'vegetariano')}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 transition-all ${
                selectedTag === 'vegetariano'
                  ? 'bg-emerald-500 text-slate-950 font-bold shadow-md'
                  : 'bg-black/50 text-slate-300 hover:text-emerald-400 border border-slate-800'
              }`}
            >
              <Leaf className="w-3.5 h-3.5 text-emerald-400" />
              <span>Vegetarianos</span>
            </button>
          </div>
        </div>

        {/* Categories Bar */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pt-1 border-t border-slate-800/80">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              selectedCategory === 'all'
                ? 'bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 shadow-[0_0_12px_rgba(245,158,11,0.4)]'
                : 'bg-black/60 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            ✨ Todas Categorias
          </button>
          {restaurantCategories.map((cat) => {
            const count = menuItems.filter(
              (i) => i.restaurantSlug === restaurantSlug && i.categoryId === cat.id && i.available
            ).length;
            const isSelected = selectedCategory === cat.id;

            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 shadow-[0_0_12px_rgba(245,158,11,0.4)]'
                    : 'bg-black/60 text-slate-300 hover:text-white border border-slate-800'
                }`}
              >
                <span>{cat.icon || '🍽️'}</span>
                <span>{cat.name}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    isSelected ? 'bg-slate-950/30 text-slate-950' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Product List / Cards Grid - 💎 CARDS VIDRO PREMIUM COM MOLDURAS DOURADAS */}
      {filteredItems.length === 0 ? (
        <div className="text-center py-16 glass-gold-card rounded-3xl">
          <div className="w-14 h-14 rounded-2xl bg-black/60 border border-slate-800 flex items-center justify-center text-2xl mx-auto mb-3">
            🔍
          </div>
          <h3 className="text-base font-bold text-white mb-1">Nenhum item encontrado</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto mb-4">
            Tente buscar com outros termos ou limpe os filtros de categoria e tags.
          </p>
          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedCategory('all');
              setSelectedTag('all');
            }}
            className="px-4 py-2 bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 text-xs font-bold rounded-xl transition-all shadow-md"
          >
            Limpar Filtros
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {filteredItems.map((item) => {
            const hasPromo = typeof item.promoPrice === 'number' && item.promoPrice < item.price;

            return (
              <div
                key={item.id}
                onClick={() => handleOpenItem(item)}
                className="group glass-gold-card rounded-2xl overflow-hidden cursor-pointer flex flex-col justify-between relative"
              >
                {/* Image Section with 4K Dark Gastronomic Presentation */}
                <div className="relative h-48 sm:h-52 w-full overflow-hidden bg-slate-950">
                  <img
                    src={item.image}
                    alt={item.name}
                    className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500 filter brightness-[0.9] contrast-[1.05]"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0c0c10] via-transparent to-black/30 opacity-90" />

                  {/* Luxury Badges */}
                  <div className="absolute top-3 left-3 flex flex-col gap-1.5 z-10">
                    {item.tags?.includes('mais_vendido') && (
                      <span className="px-2.5 py-0.5 rounded-md bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 font-black text-[10px] uppercase tracking-wider shadow-[0_0_10px_rgba(245,158,11,0.5)]">
                        ★ Mais Vendido
                      </span>
                    )}
                    {hasPromo && (
                      <span className="px-2.5 py-0.5 rounded-md bg-rose-600 text-white font-black text-[10px] uppercase tracking-wider shadow-md">
                        Oferta Especial
                      </span>
                    )}
                    {item.tags?.includes('vegetariano') && (
                      <span className="px-2.5 py-0.5 rounded-md bg-emerald-600 text-white font-bold text-[10px] uppercase tracking-wider shadow-md">
                        🌱 Veg
                      </span>
                    )}
                  </div>
                </div>

                {/* Info & Description */}
                <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between space-y-3">
                  <div>
                    <h3 className="font-bold text-white text-base group-hover:text-amber-300 transition-colors line-clamp-1">
                      {item.name}
                    </h3>
                    <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed font-normal">
                      {item.description}
                    </p>
                  </div>

                  {/* Price & Gold Action Button */}
                  <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between">
                    <div>
                      {hasPromo ? (
                        <div>
                          <span className="text-[11px] text-slate-500 line-through block">
                            R$ {item.price.toFixed(2)}
                          </span>
                          <span className="text-lg font-black text-amber-400">
                            R$ {item.promoPrice!.toFixed(2)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-lg font-black text-amber-400">
                          R$ {item.price.toFixed(2)}
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setModalItem(item);
                      }}
                      className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500/20 to-yellow-400/10 hover:from-amber-500 hover:to-yellow-400 text-amber-300 hover:text-slate-950 border border-amber-500/40 text-xs font-black flex items-center gap-1.5 transition-all shadow-[0_0_10px_rgba(245,158,11,0.2)]"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Adicionar</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Product Detail Modal */}
      {modalItem && (
        <ProductModal item={modalItem} onClose={() => setModalItem(null)} />
      )}
    </section>
  );
};
