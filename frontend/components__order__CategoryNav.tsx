import React from 'react';
import { Category } from './types';
import { 
  UtensilsCrossed, 
  Flame, 
  ChefHat, 
  Sparkles, 
  Cake, 
  GlassWater, 
  BadgePercent,
  Layers
} from 'lucide-react';

interface CategoryNavProps {
  categories: Category[];
  activeCategoryId: string;
  onSelectCategory: (id: string) => void;
  categoryItemCounts: Record<string, number>;
}

export const CategoryNav: React.FC<CategoryNavProps> = ({
  categories,
  activeCategoryId,
  onSelectCategory,
  categoryItemCounts,
}) => {
  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'UtensilsCrossed':
        return <UtensilsCrossed className="w-4 h-4" />;
      case 'Flame':
        return <Flame className="w-4 h-4" />;
      case 'ChefHat':
        return <ChefHat className="w-4 h-4" />;
      case 'Sparkles':
        return <Sparkles className="w-4 h-4" />;
      case 'Cake':
        return <Cake className="w-4 h-4" />;
      case 'GlassWater':
        return <GlassWater className="w-4 h-4" />;
      case 'BadgePercent':
        return <BadgePercent className="w-4 h-4" />;
      default:
        // O cadastro japonês usa emojis como ícone de categoria. Mantemos o
        // visual limpo sem substituir o ícone definido pelo restaurante.
        if (iconName && iconName.length <= 4) {
          return <span className="text-base leading-none" aria-hidden="true">{iconName}</span>;
        }
        return <Layers className="w-4 h-4" />;
    }
  };

  return (
    <nav aria-label="Navegação por Categorias" className="sticky top-0 z-30 bg-[#080b0b]/92 backdrop-blur-xl border-b border-white/5 shadow-lg py-3 px-4 sm:px-6">
      <div className="max-w-7xl mx-auto flex items-center gap-2 overflow-x-auto scrollbar-none py-0.5">
        <button
          id="category-tab-all"
          onClick={() => onSelectCategory('all')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
            activeCategoryId === 'all'
              ? 'bg-[#c9a227] text-[#080a0a] shadow-sm'
              : 'bg-white/5 text-[#b9bbb4] hover:bg-white/10 border border-white/10'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Cardápio Completo</span>
        </button>

        {categories.map((cat) => {
          const isActive = activeCategoryId === cat.id;
          const count = categoryItemCounts[cat.id] || 0;
          return (
            <button
              key={cat.id}
              id={`category-tab-${cat.id}`}
              onClick={() => onSelectCategory(cat.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
                isActive
                  ? 'bg-[#c9a227] text-[#080a0a] shadow-sm'
                  : 'bg-white/5 text-[#b9bbb4] hover:bg-white/10 border border-white/10'
              }`}
            >
              {getIcon(cat.icon)}
              <span>{cat.name}</span>
              {count > 0 && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    isActive ? 'bg-[#080a0a] text-[#e2c55d]' : 'bg-white/10 text-[#a8aaa2]'
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
