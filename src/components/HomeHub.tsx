import React, { useState } from 'react';
import { useStore } from '../context/StoreContext';
import { RestaurantSlug } from '../types/restaurant';
import { LuxuryPromoSlider } from './LuxuryPromoSlider';
import {
  Star,
  Clock,
  Bike,
  Store,
  UtensilsCrossed,
  Search,
  ShieldCheck,
  Sparkles,
  ChevronRight,
  Flame,
  Award,
  CheckCircle2,
} from 'lucide-react';

interface HomeHubProps {
  onSelectRestaurant: (slug: RestaurantSlug) => void;
  onOpenTracker: () => void;
  onOpenAdmin: () => void;
}

export const HomeHub: React.FC<HomeHubProps> = ({
  onSelectRestaurant,
  onOpenTracker,
  onOpenAdmin,
}) => {
  const { restaurants, menuItems } = useStore();
  const [searchFilter, setSearchFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'japones' | 'italiano' | 'pizza' | 'hamburgueria'>('all');
  const [sortFilter, setSortFilter] = useState<'recommended' | 'rating' | 'time' | 'fee'>('recommended');

  const restaurantList = Object.values(restaurants);

  const filteredRestaurants = restaurantList
    .filter((r) => {
      // Category filter
      if (categoryFilter !== 'all' && r.slug !== categoryFilter) return false;

      // Search filter
      if (!searchFilter.trim()) return true;
      const q = searchFilter.toLowerCase();
      const matchesName = r.name.toLowerCase().includes(q);
      const matchesCuisine = r.cuisine.toLowerCase().includes(q);
      const matchesTagline = r.tagline.toLowerCase().includes(q);
      const matchesDish = menuItems.some(
        (m) => m.restaurantSlug === r.slug && (m.name.toLowerCase().includes(q) || m.description.toLowerCase().includes(q))
      );
      return matchesName || matchesCuisine || matchesTagline || matchesDish;
    })
    .sort((a, b) => {
      if (sortFilter === 'rating') return b.rating - a.rating;
      if (sortFilter === 'time') return a.estimatedTimeMin - b.estimatedTimeMin;
      if (sortFilter === 'fee') return a.deliveryFee - b.deliveryFee;
      return 0; // recommended
    });

  // Featured top dishes across all restaurants for quick spotlight
  const featuredDishes = menuItems
    .filter((m) => m.tags?.includes('mais_vendido') || m.tags?.includes('destaque'))
    .slice(0, 4);

  return (
    <div className="space-y-10 pb-24">
      {/* 🍣 HERO CINEMATOGRÁFICO COM EFEITO PARALLAX & BRILHO DOURADO */}
      <section className="relative overflow-hidden rounded-3xl border border-amber-500/30 bg-[#0a0a0f] shadow-[0_16px_48px_rgba(0,0,0,0.85)] group">
        {/* Cinematic Background with Parallax Feel */}
        <div className="absolute inset-0 z-0 overflow-hidden">
          <img
            src="https://images.unsplash.com/photo-1544025162-d76694265947?w=1800&auto=format&fit=crop&q=85"
            alt="Gastronomia de Luxo"
            className="w-full h-full object-cover object-center filter brightness-[0.40] contrast-[1.2] group-hover:scale-105 transition-transform duration-[6000ms]"
          />
          {/* 4K Dark Vignette & Gold Radial Glow */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#09090d] via-[#09090d]/75 to-black/50" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#09090d] via-[#09090d]/60 to-transparent" />
          <div className="absolute top-0 right-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        </div>

        {/* Golden Shimmer Ambient Border Line */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-amber-400 to-transparent z-10 opacity-75" />

        {/* Hero Content Container */}
        <div className="relative z-10 p-6 sm:p-12 max-w-4xl space-y-5">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-black/70 backdrop-blur-md border border-amber-400/40 text-amber-300 text-xs font-black uppercase tracking-widest shadow-[0_0_15px_rgba(245,158,11,0.25)]">
            <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
            <span>✦ ALTA GASTRONOMIA • 4 COZINHAS EM 1 ÚNICO PEDIDO</span>
          </div>

          <h1 className="text-3xl sm:text-6xl font-black text-white tracking-tight leading-[1.15]">
            Experiência Gastronômica <br />
            <span className="text-gold-gradient drop-shadow-lg">de Alto Padrão</span>
          </h1>

          <p className="text-xs sm:text-base text-slate-300 max-w-2xl leading-relaxed font-normal">
            Descubra sushis com cortes nobres de salmão fresco, massas artesanais toscanas apuradas por 6h,
            pizzas napolitanas com 48h de fermentação e smash burgers 100% Angus artesanal grelhados na brasa.
          </p>

          {/* Luxury Search Bar */}
          <div className="pt-2 max-w-xl">
            <div className="relative">
              <Search className="w-5 h-5 text-amber-400 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Busque por pratos, combinados, massas, pizzas napolitanas, smash burgers..."
                className="w-full min-h-[48px] bg-black/80 backdrop-blur-xl border border-amber-500/40 rounded-2xl pl-12 pr-4 py-3.5 text-xs sm:text-sm text-white placeholder-slate-400 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 shadow-[0_8px_30px_rgba(0,0,0,0.6)] transition-all"
              />
            </div>
            {/* Quick trending chips */}
            <div className="flex items-center gap-2 mt-3 overflow-x-auto no-scrollbar text-[11px] text-slate-300">
              <span className="text-amber-400 font-bold flex items-center gap-1 shrink-0">
                <Flame className="w-3.5 h-3.5" /> Em alta:
              </span>
              <button
                onClick={() => setSearchFilter('Salmão')}
                className="px-2.5 py-1 rounded-lg bg-black/50 hover:bg-amber-500/20 text-slate-300 hover:text-amber-300 border border-slate-800 transition-colors shrink-0"
              >
                🍣 Salmão Nobre
              </button>
              <button
                onClick={() => setSearchFilter('Costela')}
                className="px-2.5 py-1 rounded-lg bg-black/50 hover:bg-amber-500/20 text-slate-300 hover:text-amber-300 border border-slate-800 transition-colors shrink-0"
              >
                🍝 Ragu di Costela
              </button>
              <button
                onClick={() => setSearchFilter('Margherita')}
                className="px-2.5 py-1 rounded-lg bg-black/50 hover:bg-amber-500/20 text-slate-300 hover:text-amber-300 border border-slate-800 transition-colors shrink-0"
              >
                🍕 Margherita D.O.P.
              </button>
              <button
                onClick={() => setSearchFilter('Smash')}
                className="px-2.5 py-1 rounded-lg bg-black/50 hover:bg-amber-500/20 text-slate-300 hover:text-amber-300 border border-slate-800 transition-colors shrink-0"
              >
                🍔 Double Smash Angus
              </button>
            </div>
          </div>

          {/* Gastronomic Quality Badges */}
          <div className="pt-2 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-black/60 backdrop-blur-md border border-slate-800/80 p-3 rounded-2xl flex items-center gap-3">
              <span className="text-xl">⭐</span>
              <div className="text-xs">
                <span className="font-extrabold text-white block">4.9 / 5.0</span>
                <span className="text-amber-400 text-[10px]">Avaliação Geral</span>
              </div>
            </div>

            <div className="bg-black/60 backdrop-blur-md border border-slate-800/80 p-3 rounded-2xl flex items-center gap-3">
              <span className="text-xl">⏱️</span>
              <div className="text-xs">
                <span className="font-extrabold text-white block">30 a 45 min</span>
                <span className="text-amber-400 text-[10px]">Preparo & Entrega</span>
              </div>
            </div>

            <div className="bg-black/60 backdrop-blur-md border border-slate-800/80 p-3 rounded-2xl flex items-center gap-3">
              <span className="text-xl">🌿</span>
              <div className="text-xs">
                <span className="font-extrabold text-white block">100% Artesanal</span>
                <span className="text-amber-400 text-[10px]">Ingredientes Frescos</span>
              </div>
            </div>

            <div className="bg-black/60 backdrop-blur-md border border-slate-800/80 p-3 rounded-2xl flex items-center gap-3">
              <span className="text-xl">🛵</span>
              <div className="text-xs">
                <span className="font-extrabold text-white block">Bag Térmica Pro</span>
                <span className="text-amber-400 text-[10px]">Chega Fervendo</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 🎥 SLIDER AUTOMÁTICO: PROMOÇÕES, RODÍZIOS & FESTIVAIS */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-amber-400" />
            <h2 className="text-lg sm:text-xl font-black text-white tracking-tight uppercase">
              Promoções &amp; Rodízios em Destaque
            </h2>
          </div>
          <span className="text-xs text-amber-400/90 font-medium">Troca automática</span>
        </div>
        <LuxuryPromoSlider onSelectRestaurant={onSelectRestaurant} />
      </section>

      {/* 💎 BARRA DE FILTROS LUXO & CATEGORIAS */}
      <section className="glass-gold-card p-3 sm:p-4 rounded-2xl flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shadow-xl">
        {/* Category Pills */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
          <button
            onClick={() => setCategoryFilter('all')}
            className={`min-h-[42px] px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-2 ${
              categoryFilter === 'all'
                ? 'bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 shadow-[0_0_12px_rgba(245,158,11,0.5)]'
                : 'bg-black/60 text-slate-300 hover:text-white border border-slate-800'
            }`}
          >
            <span>✨ Todas as Cozinhas</span>
            <span className="text-[10px] opacity-80">({restaurantList.length})</span>
          </button>
          <button
            onClick={() => setCategoryFilter('japones')}
            className={`min-h-[42px] px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-2 ${
              categoryFilter === 'japones'
                ? 'bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 shadow-[0_0_12px_rgba(245,158,11,0.5)]'
                : 'bg-black/60 text-slate-300 hover:text-white border border-slate-800'
            }`}
          >
            <span>🍣 Japonês &amp; Sushi</span>
          </button>
          <button
            onClick={() => setCategoryFilter('italiano')}
            className={`min-h-[42px] px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-2 ${
              categoryFilter === 'italiano'
                ? 'bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 shadow-[0_0_12px_rgba(245,158,11,0.5)]'
                : 'bg-black/60 text-slate-300 hover:text-white border border-slate-800'
            }`}
          >
            <span>🍝 Cucina Italiana</span>
          </button>
          <button
            onClick={() => setCategoryFilter('pizza')}
            className={`min-h-[42px] px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-2 ${
              categoryFilter === 'pizza'
                ? 'bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 shadow-[0_0_12px_rgba(245,158,11,0.5)]'
                : 'bg-black/60 text-slate-300 hover:text-white border border-slate-800'
            }`}
          >
            <span>🍕 Pizza Napolitana</span>
          </button>
          <button
            onClick={() => setCategoryFilter('hamburgueria')}
            className={`min-h-[42px] px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-2 ${
              categoryFilter === 'hamburgueria'
                ? 'bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 shadow-[0_0_12px_rgba(245,158,11,0.5)]'
                : 'bg-black/60 text-slate-300 hover:text-white border border-slate-800'
            }`}
          >
            <span>🍔 Burger Angus</span>
          </button>
        </div>

        {/* Sort Selector */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-slate-400 hidden md:inline font-medium">Ordenar:</span>
          <select
            value={sortFilter}
            onChange={(e) => setSortFilter(e.target.value as any)}
            className="min-h-[42px] bg-black/80 border border-slate-800 text-xs text-slate-200 rounded-xl px-3.5 py-2 focus:outline-none focus:border-amber-400 cursor-pointer"
          >
            <option value="recommended">⭐ Destaques Recomendados</option>
            <option value="rating">★ Maior Avaliação</option>
            <option value="time">⏱️ Entrega Mais Rápida</option>
            <option value="fee">🛵 Menor Taxa de Entrega</option>
          </select>
        </div>
      </section>

      {/* ✨ CARDS VIDRO PREMIUM: 4 RESTAURANTES COM MOLDURAS DOURADAS */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
              <span>Restaurantes Exclusivos</span>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30">
                4 Cozinhas Premium
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Selecione o restaurante desejado para personalizar seu pedido com toda a sofisticação
            </p>
          </div>

          <span className="text-xs text-amber-300 font-bold bg-black/60 px-3 py-1.5 rounded-xl border border-amber-500/30 shadow">
            {filteredRestaurants.length} disponíveis
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredRestaurants.map((rest) => (
            <div
              key={rest.slug}
              onClick={() => onSelectRestaurant(rest.slug)}
              className="group glass-gold-card rounded-3xl overflow-hidden shadow-2xl cursor-pointer flex flex-col justify-between relative"
            >
              {/* Golden Ambient Glow Border on Top of Card */}
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-amber-400/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-30" />

              {/* Cover Banner */}
              <div className="relative h-48 sm:h-56 w-full bg-slate-900 overflow-hidden">
                <img
                  src={rest.banner}
                  alt={rest.name}
                  className="w-full h-full object-cover object-center filter brightness-[0.85] group-hover:scale-105 transition-transform duration-700"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0e] via-[#0a0a0e]/40 to-transparent" />

                {/* Status Open/Closed Badge */}
                <div className="absolute top-4 right-4 z-20">
                  <span
                    className={`px-3 py-1.5 rounded-full text-xs font-bold border backdrop-blur-md flex items-center gap-1.5 shadow-lg ${
                      rest.isOpen
                        ? 'bg-emerald-950/70 text-emerald-300 border-emerald-500/40'
                        : 'bg-rose-950/70 text-rose-300 border-rose-500/40'
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${
                        rest.isOpen ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'
                      }`}
                    />
                    {rest.isOpen ? 'Aberto Agora' : 'Fechado'}
                  </span>
                </div>

                {/* Logo & Identity */}
                <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between z-20">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <img
                        src={rest.logo}
                        alt={rest.name}
                        className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl object-cover border-2 border-amber-400/70 shadow-[0_0_15px_rgba(245,158,11,0.3)]"
                      />
                      <span className="absolute -bottom-1.5 -right-1.5 text-xl filter drop-shadow">
                        {rest.emoji}
                      </span>
                    </div>

                    <div>
                      <span className="text-[11px] font-bold text-amber-300 bg-black/70 border border-amber-500/30 px-2.5 py-0.5 rounded-md backdrop-blur-md">
                        {rest.cuisine}
                      </span>
                      <h3 className="text-lg sm:text-xl font-black text-white tracking-tight drop-shadow-md leading-tight mt-1 group-hover:text-amber-300 transition-colors">
                        {rest.name}
                      </h3>
                    </div>
                  </div>
                </div>
              </div>

              {/* Body Content */}
              <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-normal">
                  {rest.tagline}
                </p>

                {/* Metrics Row */}
                <div className="grid grid-cols-3 gap-2 py-3 border-y border-amber-500/20 text-center text-xs bg-black/30 rounded-xl px-2">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Avaliação</span>
                    <span className="font-black text-amber-400 flex items-center justify-center gap-1 mt-0.5">
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                      {rest.rating.toFixed(1)}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[10px]">Tempo Médio</span>
                    <span className="font-bold text-white flex items-center justify-center gap-1 mt-0.5">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      {rest.estimatedTimeMin}-{rest.estimatedTimeMax} min
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[10px]">Taxa Delivery</span>
                    <span className="font-black text-emerald-400 mt-0.5 block">
                      R$ {rest.deliveryFee.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Modalities & Golden CTA */}
                <div className="flex items-center justify-between text-xs pt-1">
                  <div className="flex items-center gap-2 text-slate-400 text-[11px]">
                    <span className="flex items-center gap-1 text-slate-300">
                      <Bike className="w-3.5 h-3.5 text-amber-400" /> Delivery
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1 text-slate-300">
                      <Store className="w-3.5 h-3.5 text-emerald-400" /> Balcão
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1 text-slate-300">
                      <UtensilsCrossed className="w-3.5 h-3.5 text-amber-300" /> Mesa
                    </span>
                  </div>

                  <span className="min-h-[40px] px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 group-hover:from-amber-400 group-hover:to-yellow-300 text-slate-950 font-black flex items-center gap-1.5 transition-all shadow-[0_0_12px_rgba(245,158,11,0.3)]">
                    <span>Cardápio</span>
                    <ChevronRight className="w-4 h-4" />
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 📸 20 FOTOS PROFISSIONAIS: PRATOS ASSINATURA EM DESTAQUE */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-400" />
              <span>Pratos Assinatura dos Chefs</span>
            </h2>
            <p className="text-xs text-slate-400">
              Criações premiadas preparadas na hora pelos mestres de cada cozinha
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {featuredDishes.map((dish) => {
            const rest = restaurants[dish.restaurantSlug];
            return (
              <div
                key={dish.id}
                onClick={() => onSelectRestaurant(dish.restaurantSlug)}
                className="group glass-gold-card rounded-2xl overflow-hidden cursor-pointer flex flex-col justify-between transition-all"
              >
                <div className="relative h-44 w-full overflow-hidden bg-slate-900">
                  <img
                    src={dish.image}
                    alt={dish.name}
                    className="w-full h-full object-cover object-center group-hover:scale-110 transition-transform duration-500 filter brightness-[0.9]"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                  <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-md border border-amber-500/40 text-amber-300 font-black text-[10px] uppercase">
                    {rest?.name}
                  </span>
                </div>

                <div className="p-4 flex-1 flex flex-col justify-between space-y-2">
                  <div>
                    <h3 className="font-bold text-sm text-white group-hover:text-amber-300 transition-colors line-clamp-1">
                      {dish.name}
                    </h3>
                    <p className="text-xs text-slate-400 line-clamp-2 mt-1 leading-relaxed">
                      {dish.description}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                    <span className="text-base font-black text-amber-400">
                      R$ {dish.price.toFixed(2)}
                    </span>
                    <span className="text-[11px] font-bold text-slate-300 group-hover:text-amber-300 flex items-center gap-1">
                      Ver no menu <ChevronRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* FOOTER RÁPIDO & RASTREADOR */}
      <section className="glass-gold-card rounded-3xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h4 className="text-sm font-bold text-white flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-amber-400" />
            <span>Já tem um pedido em andamento?</span>
          </h4>
          <p className="text-xs text-slate-400 mt-0.5">
            Acompanhe cada etapa do preparo e entrega através do nosso rastreador em tempo real.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            onClick={onOpenTracker}
            className="flex-1 sm:flex-initial px-4 py-2.5 bg-black/80 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl border border-amber-500/30 flex items-center justify-center gap-2 transition-colors shadow"
          >
            <Clock className="w-4 h-4 text-amber-400" />
            <span>Rastrear Meu Pedido</span>
          </button>

          <button
            onClick={onOpenAdmin}
            className="flex-1 sm:flex-initial px-4 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black text-xs rounded-xl flex items-center justify-center gap-2 transition-all shadow-[0_0_15px_rgba(245,158,11,0.3)]"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Acesso Super-Admin</span>
          </button>
        </div>
      </section>
    </div>
  );
};
