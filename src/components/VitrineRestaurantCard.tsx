import React from 'react';
import { RestaurantConfig, RestaurantSlug, MenuItem } from '../types/restaurant';
import {
  Star,
  Clock,
  Bike,
  Sparkles,
  ChevronRight,
  Info,
  Tag,
  Flame,
  Award,
  CheckCircle2,
} from 'lucide-react';

interface VitrineRestaurantCardProps {
  restaurant: RestaurantConfig;
  menuItems: MenuItem[];
  onSelect: (slug: RestaurantSlug) => void;
  onOpenDossier: (e: React.MouseEvent, rest: RestaurantConfig) => void;
}

export const VitrineRestaurantCard: React.FC<VitrineRestaurantCardProps> = ({
  restaurant,
  menuItems,
  onSelect,
  onOpenDossier,
}) => {
  const theme = restaurant.vitrineLayoutTheme || 'moderno_premium';
  const coverImg = restaurant.vitrineCoverImage || restaurant.banner;
  const callout = restaurant.vitrineCallout || restaurant.tagline;
  const badge = restaurant.vitrineBadge || (restaurant.promotions?.[0]?.badge ?? 'Em Destaque');

  // Top spotlight items for this restaurant
  const spotlightItems = menuItems
    .filter((m) => m.restaurantSlug === restaurant.slug)
    .slice(0, 3);

  // 1. RÚSTICO ACOLHEDOR (Warm amber, terracotta, artisanal feeling)
  if (theme === 'rustico_acolhedor') {
    return (
      <div
        onClick={() => onSelect(restaurant.slug)}
        className="group cursor-pointer rounded-3xl overflow-hidden bg-[#16120F] border border-amber-800/40 hover:border-amber-500/80 shadow-2xl transition-all duration-300 flex flex-col justify-between relative transform hover:-translate-y-1"
      >
        {/* Cover Header with Badge */}
        <div className="relative h-56 w-full overflow-hidden bg-[#1F1813]">
          <img
            src={coverImg}
            alt={restaurant.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 brightness-90"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#16120F] via-transparent to-black/40" />

          {/* Badge */}
          {badge && (
            <span className="absolute top-3 right-3 bg-amber-700/90 text-amber-100 border border-amber-500/40 text-[11px] font-extrabold px-3 py-1 rounded-full shadow-lg backdrop-blur-sm">
              🌾 {badge}
            </span>
          )}

          {/* Logo overlay */}
          <div className="absolute -bottom-4 left-5 flex items-end gap-3 z-10">
            <img
              src={restaurant.logo}
              alt={restaurant.name}
              className="w-16 h-16 rounded-2xl object-cover border-2 border-amber-600/60 shadow-xl bg-[#16120F]"
            />
          </div>
        </div>

        {/* Content */}
        <div className="p-5 pt-7 space-y-3 flex-1 flex flex-col justify-between">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-amber-100 font-serif tracking-wide">
                {restaurant.name}
              </h3>
              <div className="flex items-center gap-1 text-xs font-bold text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded-lg border border-amber-800/40">
                <Star className="w-3.5 h-3.5 fill-amber-400" />
                <span>{restaurant.rating}</span>
              </div>
            </div>

            <p className="text-xs text-amber-200/80 leading-relaxed font-sans">{callout}</p>
          </div>

          {/* Specs */}
          <div className="flex items-center gap-3 text-xs text-amber-300/80 pt-2 border-t border-amber-900/40">
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-amber-500" />
              {restaurant.estimatedTimeMin}-{restaurant.estimatedTimeMax} min
            </span>
            <span className="flex items-center gap-1">
              <Bike className="w-3.5 h-3.5 text-amber-500" />
              {restaurant.deliveryFee === 0 ? 'Frete Grátis' : `R$ ${restaurant.deliveryFee.toFixed(2)}`}
            </span>
          </div>

          {/* Action */}
          <div className="pt-2 flex items-center justify-between">
            <button
              onClick={(e) => onOpenDossier(e, restaurant)}
              className="text-xs text-amber-400/80 hover:text-amber-200 flex items-center gap-1 font-semibold"
            >
              <Info className="w-3.5 h-3.5" /> Dossiê
            </button>

            <span className="px-4 py-2 bg-gradient-to-r from-amber-700 to-amber-600 group-hover:from-amber-600 group-hover:to-amber-500 text-amber-100 font-black text-xs rounded-xl shadow transition-all flex items-center gap-1.5">
              <span>Abrir Cardápio</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </span>
          </div>
        </div>
      </div>
    );
  }

  // 2. CLEAN MINIMALISTA (Crisp typography, airy spacing, refined monochrome with delicate accents)
  if (theme === 'clean_minimalista') {
    return (
      <div
        onClick={() => onSelect(restaurant.slug)}
        className="group cursor-pointer rounded-3xl overflow-hidden bg-[#0D0F12] border border-slate-700/60 hover:border-slate-400 shadow-2xl transition-all duration-300 flex flex-col justify-between relative transform hover:-translate-y-1"
      >
        <div className="relative h-56 w-full overflow-hidden bg-slate-900">
          <img
            src={coverImg}
            alt={restaurant.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0D0F12] via-transparent to-transparent" />

          {badge && (
            <span className="absolute top-3 right-3 bg-white text-slate-950 text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full shadow">
              {badge}
            </span>
          )}

          <div className="absolute -bottom-4 left-5 flex items-end gap-3 z-10">
            <img
              src={restaurant.logo}
              alt={restaurant.name}
              className="w-16 h-16 rounded-2xl object-cover border-2 border-slate-700 shadow-lg bg-[#0D0F12]"
            />
          </div>
        </div>

        <div className="p-5 pt-7 space-y-3 flex-1 flex flex-col justify-between">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white tracking-tight">{restaurant.name}</h3>
              <span className="text-xs font-mono font-bold text-slate-300">★ {restaurant.rating}</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed font-normal">{callout}</p>
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-400 pt-2 border-t border-slate-800">
            <span>⏱ {restaurant.estimatedTimeMin}-{restaurant.estimatedTimeMax} min</span>
            <span>•</span>
            <span>🛵 {restaurant.deliveryFee === 0 ? 'Entrega Grátis' : `Taxa R$ ${restaurant.deliveryFee.toFixed(2)}`}</span>
          </div>

          <div className="pt-2 flex items-center justify-between">
            <button
              onClick={(e) => onOpenDossier(e, restaurant)}
              className="text-xs text-slate-400 hover:text-white flex items-center gap-1 font-medium"
            >
              <Info className="w-3.5 h-3.5" /> Detalhes
            </button>

            <span className="px-4 py-2 bg-slate-100 hover:bg-white text-slate-950 font-bold text-xs rounded-xl shadow transition-colors flex items-center gap-1">
              <span>Cardápio</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </span>
          </div>
        </div>
      </div>
    );
  }

  // 3. DARK ELEGANTE (Obsidian canvas, neon highlights, futuristic gastrolab aesthetic)
  if (theme === 'dark_elegante') {
    return (
      <div
        onClick={() => onSelect(restaurant.slug)}
        className="group cursor-pointer rounded-3xl overflow-hidden bg-[#0A0B10] border border-cyan-500/30 hover:border-cyan-400/80 shadow-[0_15px_40px_rgba(0,0,0,0.8)] transition-all duration-300 flex flex-col justify-between relative transform hover:-translate-y-1"
      >
        <div className="relative h-56 w-full overflow-hidden bg-black">
          <img
            src={coverImg}
            alt={restaurant.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 brightness-85"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0A0B10] via-black/40 to-transparent" />

          {badge && (
            <span className="absolute top-3 right-3 bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full shadow backdrop-blur-md">
              ⚡ {badge}
            </span>
          )}

          <div className="absolute -bottom-4 left-5 flex items-end gap-3 z-10">
            <img
              src={restaurant.logo}
              alt={restaurant.name}
              className="w-16 h-16 rounded-2xl object-cover border-2 border-cyan-500/40 shadow-xl bg-[#0A0B10]"
            />
          </div>
        </div>

        <div className="p-5 pt-7 space-y-3 flex-1 flex flex-col justify-between">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-white tracking-wide">{restaurant.name}</h3>
              <div className="flex items-center gap-1 text-xs font-bold text-cyan-400 bg-cyan-950/50 px-2 py-0.5 rounded-lg border border-cyan-500/30">
                <Star className="w-3.5 h-3.5 fill-cyan-400" />
                <span>{restaurant.rating}</span>
              </div>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed font-sans">{callout}</p>
          </div>

          <div className="flex items-center gap-3 text-xs text-cyan-300/80 pt-2 border-t border-cyan-950">
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-cyan-400" />
              {restaurant.estimatedTimeMin}-{restaurant.estimatedTimeMax} min
            </span>
            <span className="flex items-center gap-1">
              <Bike className="w-3.5 h-3.5 text-cyan-400" />
              {restaurant.deliveryFee === 0 ? 'Frete Grátis' : `R$ ${restaurant.deliveryFee.toFixed(2)}`}
            </span>
          </div>

          <div className="pt-2 flex items-center justify-between">
            <button
              onClick={(e) => onOpenDossier(e, restaurant)}
              className="text-xs text-cyan-400/80 hover:text-cyan-200 flex items-center gap-1 font-semibold"
            >
              <Info className="w-3.5 h-3.5" /> Dossiê
            </button>

            <span className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 group-hover:from-cyan-500 group-hover:to-blue-500 text-white font-black text-xs rounded-xl shadow-lg shadow-cyan-950 transition-all flex items-center gap-1.5">
              <span>Acessar Cardápio</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </span>
          </div>
        </div>
      </div>
    );
  }

  // 4. MODERNO PREMIUM (Default luxury black & gold signature theme)
  return (
    <div
      onClick={() => onSelect(restaurant.slug)}
      className="group cursor-pointer rounded-3xl overflow-hidden bg-[#08090C] border border-[#E3BD6A]/30 hover:border-[#E3BD6A]/80 shadow-[0_20px_50px_rgba(0,0,0,0.9)] transition-all duration-300 flex flex-col justify-between relative transform hover:-translate-y-1"
    >
      <div className="relative h-56 sm:h-60 w-full overflow-hidden bg-black">
        <img
          src={coverImg}
          alt={restaurant.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 brightness-90"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#08090C] via-black/30 to-black/50" />

        {badge && (
          <span className="absolute top-3 right-3 bg-gradient-to-r from-[#E3BD6A] to-amber-500 text-slate-950 text-[11px] font-black uppercase tracking-wider px-3 py-1 rounded-full shadow-lg">
            ✦ {badge}
          </span>
        )}

        <div className="absolute -bottom-4 left-5 flex items-end gap-3 z-10">
          <img
            src={restaurant.logo}
            alt={restaurant.name}
            className="w-16 h-16 rounded-2xl object-cover border-2 border-[#E3BD6A]/60 shadow-2xl bg-[#08090C]"
          />
        </div>
      </div>

      <div className="p-5 pt-7 space-y-3.5 flex-1 flex flex-col justify-between">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <h3 className="text-lg sm:text-xl font-black text-white tracking-tight">
              {restaurant.name}
            </h3>
            <div className="flex items-center gap-1 text-xs font-bold text-[#E3BD6A] bg-black/60 px-2.5 py-0.5 rounded-lg border border-[#E3BD6A]/40">
              <Star className="w-3.5 h-3.5 fill-[#E3BD6A]" />
              <span>{restaurant.rating}</span>
            </div>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed font-sans">{callout}</p>
        </div>

        {/* Highlight spotlight dishes */}
        {spotlightItems.length > 0 && (
          <div className="space-y-1 pt-1">
            <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block">
              Destaques do Cardápio:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {spotlightItems.map((dish) => (
                <span
                  key={dish.id}
                  className="text-[10px] bg-[#12151C] text-slate-300 border border-slate-800 px-2 py-0.5 rounded-md"
                >
                  {dish.name}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center gap-3 text-xs text-slate-300 pt-2 border-t border-slate-800">
          {/* Status badge Aberto / Fechado matching food nexoro.png */}
          <span className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-black border ${
            restaurant.isOpen
              ? 'bg-emerald-950/60 text-emerald-400 border-emerald-500/30'
              : 'bg-rose-950/60 text-rose-400 border-rose-500/30'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${restaurant.isOpen ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
            <span>{restaurant.isOpen ? `Aberto • ${restaurant.estimatedTimeMin} min` : 'Fechado'}</span>
          </span>

          <span className="flex items-center gap-1 text-slate-400 text-[11px]">
            <Bike className="w-3.5 h-3.5 text-[#D4AF37]" />
            {restaurant.deliveryFee === 0 ? 'Frete Grátis' : `R$ ${restaurant.deliveryFee.toFixed(2)}`}
          </span>
        </div>

        <div className="pt-2 flex items-center justify-between">
          <button
            onClick={(e) => onOpenDossier(e, restaurant)}
            className="text-xs text-[#D4AF37] hover:text-amber-200 flex items-center gap-1 font-bold"
          >
            <Info className="w-3.5 h-3.5" /> Dossiê
          </button>

          <span className="px-4 py-2 bg-gradient-to-r from-[#FFF2C6] via-[#D4AF37] to-[#AA7A1C] hover:from-white hover:via-[#E5C158] hover:to-[#B58525] text-slate-950 font-black text-xs rounded-xl shadow-[0_4px_15px_rgba(212,175,55,0.3)] transition-all flex items-center gap-1.5">
            <span>Ver cardápio</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </span>
        </div>
      </div>
    </div>
  );
};
