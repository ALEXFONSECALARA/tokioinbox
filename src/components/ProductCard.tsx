import React from 'react';
import { MenuItem, RestaurantConfig } from '../types';
import { formatCurrency, getBadgeInfo } from '../utils/helpers';
import { Plus, Clock, Users, Heart } from 'lucide-react';

interface ProductCardProps {
  item: MenuItem;
  onSelect: (item: MenuItem) => void;
  isFavorite: boolean;
  onToggleFavorite: (id: string, e: React.MouseEvent) => void;
  restaurantConfig?: Pick<RestaurantConfig, 'badges'>;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  item,
  onSelect,
  isFavorite,
  onToggleFavorite,
  restaurantConfig,
}) => {
  const hasDiscount = item.originalPrice && item.originalPrice > item.price;
  const discountPercent = hasDiscount
    ? Math.round(((item.originalPrice! - item.price) / item.originalPrice!) * 100)
    : 0;

  return (
    <article
      id={`product-card-${item.id}`}
      onClick={() => item.available && onSelect(item)}
      className={`group bg-[#0d1212] rounded-[24px] border border-white/8 overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:border-[#c9a227]/35 flex flex-col justify-between cursor-pointer relative ${
        !item.available ? 'opacity-60 cursor-not-allowed grayscale-[0.4]' : ''
      }`}
    >
      <div>
        {/* Card Image and Floating Badges */}
        <div className="relative h-44 sm:h-48 w-full overflow-hidden bg-[#101515]">
          <img
            src={item.image}
            alt={item.name}
            className="w-full h-full object-cover group-hover:scale-[1.06] transition-transform duration-700"
            loading="lazy"
            referrerPolicy="no-referrer"
          />

          {/* Discount and Availability Badges */}
          <div className="absolute top-2.5 left-2.5 flex flex-col gap-1 items-start">
            {hasDiscount && (
              <span className="bg-[var(--accent-red)] text-white text-[11px] font-bold px-2 py-0.5 rounded-md shadow-xs">
                -{discountPercent}% OFF
              </span>
            )}
            {!item.available && (
              <span className="bg-stone-900/90 text-white text-[11px] font-bold px-2 py-0.5 rounded-md">
                Esgotado no momento
              </span>
            )}
          </div>

          {/* Favorite button */}
          <button
            id={`fav-btn-${item.id}`}
            onClick={(e) => onToggleFavorite(item.id, e)}
            className="absolute top-2.5 right-2.5 p-2 rounded-full bg-black/30 backdrop-blur-md text-white hover:bg-black/50 transition-all border border-white/20"
            title={isFavorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
          >
            <Heart className={`w-3.5 h-3.5 ${isFavorite ? 'fill-[var(--accent-red)] text-[var(--accent-red)]' : 'text-white'}`} />
          </button>

          {/* Dietary / Feature Tags Over Image — no máximo 3 pra não poluir o
              card (Fase 4, item 6); o resto fica só no detalhe do produto. */}
          <div className="absolute bottom-2 left-2 right-2 flex flex-wrap gap-1">
            {item.tags.slice(0, 3).map((tag) => {
              const info = getBadgeInfo(tag, restaurantConfig);
              return (
                <span
                  key={tag}
                  className="backdrop-blur-md text-white text-[10px] font-semibold px-2 py-0.5 rounded-md"
                  style={{ backgroundColor: `${info.color}cc` }}
                >
                  {info.emoji ? `${info.emoji} ` : ''}
                  {info.label}
                </span>
              );
            })}
          </div>
        </div>

        {/* Card Body */}
        <div className="p-4 sm:p-5">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-[#f4f0e5] text-sm sm:text-base leading-snug group-hover:text-[#e2c55d] transition-colors line-clamp-1">
              {item.name}
            </h3>
          </div>

          <p className="text-[#999e97] text-xs mt-1.5 line-clamp-2 leading-relaxed">
            {item.description}
          </p>

          {/* Metadata info */}
          <div className="flex items-center gap-3 text-[11px] text-[#707770] mt-3">
            {item.preparationTimeMinutes && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3 text-[#777d76]" />
                {item.preparationTimeMinutes} min
              </span>
            )}
            {item.servesCount && (
              <span className="flex items-center gap-1">
                <Users className="w-3 h-3 text-[#777d76]" />
                Serve {item.servesCount} {item.servesCount > 1 ? 'pessoas' : 'pessoa'}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Card Footer: Price & Add Button */}
      <div className="p-4 sm:p-5 pt-0 flex items-center justify-between mt-2 border-t border-white/8 pt-4">
        <div>
          {hasDiscount && (
            <span className="text-[11px] text-[#777d76] line-through block font-medium">
              {formatCurrency(item.originalPrice!)}
            </span>
          )}
          <span className="text-base sm:text-lg font-extrabold text-[#f4f0e5]">
            {formatCurrency(item.price)}
          </span>
        </div>

        <button
          id={`add-btn-${item.id}`}
          disabled={!item.available}
          onClick={(e) => {
            e.stopPropagation();
            if (item.available) onSelect(item);
          }}
          className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all ${
            item.available
              ? 'bg-[#c9a227] hover:bg-[#e2c55d] text-[#080a0a] active:scale-95 shadow-lg shadow-black/20'
              : 'bg-white/10 text-[#666c65] cursor-not-allowed'
          }`}
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{item.choices || item.extras ? 'Personalizar' : 'Adicionar'}</span>
        </button>
      </div>
    </article>
  );
};
