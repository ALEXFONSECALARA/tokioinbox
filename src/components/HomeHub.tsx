import React, { useState } from 'react';
import { useStore } from '../context/StoreContext';
import { RestaurantConfig, RestaurantSlug, MenuItem } from '../types/restaurant';
import { LuxuryPromoSlider } from './LuxuryPromoSlider';
import { RestaurantDossierModal } from './RestaurantDossierModal';
import { RestaurantDirectLinkModal } from './RestaurantDirectLinkModal';
import { VitrineRestaurantCard } from './VitrineRestaurantCard';
import { BrandLogo } from './BrandLogo';
import { BRAND_CONFIG, BRAND_NAME, BRAND_TAGLINE, BRAND_SLOGAN } from '../config/brand';
import { getRestaurantDirectUrl, copyToClipboard } from '../utils/urlRouting';
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
  Share2,
  MessageCircle,
  MapPin,
  Tag,
  Copy,
  Check,
  ExternalLink,
  Info,
  Globe,
  QrCode,
  UserCheck,
  Users,
  Fish,
  Beer,
  Wallet,
  Settings,
  ArrowRight,
  Truck,
  Activity,
  Bot,
  TrendingUp,
} from 'lucide-react';

interface HomeHubProps {
  onSelectRestaurant: (slug: RestaurantSlug) => void;
  onOpenTracker: () => void;
}

export const HomeHub: React.FC<HomeHubProps> = ({
  onSelectRestaurant,
  onOpenTracker,
}) => {
  const { restaurants, categories, menuItems } = useStore();
  const [searchFilter, setSearchFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<RestaurantSlug | 'all'>('all');
  const [sortFilter, setSortFilter] = useState<'recommended' | 'rating' | 'time' | 'fee'>('recommended');
  const [forcedLayoutTheme, setForcedLayoutTheme] = useState<'individual' | 'moderno_premium' | 'rustico_acolhedor' | 'clean_minimalista' | 'dark_elegante'>('individual');

  // Modal State for Independent Restaurant Dossier
  const [selectedDossierRestaurant, setSelectedDossierRestaurant] = useState<RestaurantConfig | null>(null);
  const [isDossierOpen, setIsDossierOpen] = useState(false);
  const [copiedCoupon, setCopiedCoupon] = useState<string | null>(null);
  const [selectedLinkRestaurant, setSelectedLinkRestaurant] = useState<RestaurantConfig | null>(null);
  const [copiedLinkSlug, setCopiedLinkSlug] = useState<string | null>(null);

  // Filter only active restaurants for customer display
  const restaurantList = Object.values(restaurants).filter((r) => r.isActive !== false);

  const handleCopyDirectUrl = async (rest: RestaurantConfig) => {
    const url = getRestaurantDirectUrl(rest, 'official');
    const ok = await copyToClipboard(url);
    if (ok) {
      setCopiedLinkSlug(rest.slug);
      setTimeout(() => setCopiedLinkSlug(null), 2500);
    }
  };

  const copyCouponCode = (e: React.MouseEvent, code: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(code);
    setCopiedCoupon(code);
    setTimeout(() => setCopiedCoupon(null), 2500);
  };

  const openDossier = (e: React.MouseEvent, rest: RestaurantConfig) => {
    e.stopPropagation();
    setSelectedDossierRestaurant(rest);
    setIsDossierOpen(true);
  };

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
    <div className="space-y-12 pb-24 bg-[#050505] text-[#F5F5F5] min-h-screen">
      {/* 🍣 HERO CINEMATOGRÁFICO DE LUXO — CORES FINAS (#050505, #111111, #E3BD6A, #A77A1C, #FF7A00, #F5F5F5) */}
      <section className="relative overflow-hidden rounded-3xl border border-[#E3BD6A]/30 bg-[#050505] shadow-[0_20px_60px_rgba(0,0,0,0.95)] group">
        {/* Cinematic Background */}
        <div className="absolute inset-0 z-0 overflow-hidden">
          <img
            src="https://images.unsplash.com/photo-1544025162-d76694265947?w=1800&auto=format&fit=crop&q=85"
            alt="Alta Gastronomia"
            className="w-full h-full object-cover object-center filter brightness-[0.35] contrast-[1.25] group-hover:scale-105 transition-transform duration-[6000ms]"
          />
          {/* Vignette Gradients */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/80 to-black/60" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#050505] via-[#050505]/70 to-transparent" />
          <div className="absolute top-0 right-1/4 w-96 h-96 bg-[#E3BD6A]/10 rounded-full blur-3xl pointer-events-none" />
        </div>

        {/* Ambient Gold Shimmer Line on Top Border */}
        <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-[#E3BD6A] to-transparent z-10 opacity-80" />

        {/* Hero Content Container */}
        <div className="relative z-10 p-6 sm:p-14 max-w-4xl space-y-6">
          {/* Logo Oficial NEXORO FOOD SYSTEM */}
          <div className="flex items-center gap-3">
            <BrandLogo size="md" showTagline={false} />
            <div className="hidden sm:block pl-3 border-l border-[#D4AF37]/30">
              <span className="bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/40 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                {BRAND_SLOGAN}
              </span>
              <p className="text-[11px] text-slate-400 font-medium tracking-wider uppercase mt-1">
                4 Cozinhas Autônomas • Alta Gastronomia
              </p>
            </div>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-[#F5F5F5] tracking-tight leading-[1.12]">
            Sabores Exclusivos, <br />
            <span className="bg-gradient-to-r from-[#FFF2C6] via-[#D4AF37] to-[#AA7A1C] bg-clip-text text-transparent drop-shadow-md">
              {BRAND_TAGLINE}
            </span>
          </h1>

          <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed font-normal">
            Descubra restaurantes consagrados reunidos em uma única plataforma de excelência. Sushi nobre, massas artesanais italianas, pizzas napolitanas e smash burgers preparados ao vivo por mestres da gastronomia.
          </p>

          {/* Luxury Search Bar */}
          <div className="pt-2 max-w-xl">
            <div className="relative">
              <Search className="w-5 h-5 text-[#E3BD6A] absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Busque por pratos, combinados, massas, pizzas, burgers ou restaurante..."
                className="w-full min-h-[48px] bg-[#111111]/90 backdrop-blur-xl border border-[#E3BD6A]/30 rounded-2xl pl-12 pr-4 py-3.5 text-xs sm:text-sm text-[#F5F5F5] placeholder-slate-400 focus:outline-none focus:border-[#E3BD6A] focus:ring-2 focus:ring-[#E3BD6A]/20 shadow-[0_8px_30px_rgba(0,0,0,0.7)] transition-all"
              />
            </div>

            {/* Quick trending chips */}
            <div className="flex items-center gap-2 mt-3 overflow-x-auto no-scrollbar text-[11px] text-slate-300">
              <span className="text-[#E3BD6A] font-bold flex items-center gap-1 shrink-0">
                <Flame className="w-3.5 h-3.5 text-[#FF7A00]" /> Mais pedidos:
              </span>
              <button
                onClick={() => setSearchFilter('Salmão')}
                className="px-2.5 py-1 rounded-lg bg-[#111111] hover:bg-[#E3BD6A]/20 text-slate-300 hover:text-[#E3BD6A] border border-slate-800 transition-colors shrink-0"
              >
                🍣 Salmão Nobre
              </button>
              <button
                onClick={() => setSearchFilter('Costela')}
                className="px-2.5 py-1 rounded-lg bg-[#111111] hover:bg-[#E3BD6A]/20 text-slate-300 hover:text-[#E3BD6A] border border-slate-800 transition-colors shrink-0"
              >
                🍝 Ragu di Costela
              </button>
              <button
                onClick={() => setSearchFilter('Margherita')}
                className="px-2.5 py-1 rounded-lg bg-[#111111] hover:bg-[#E3BD6A]/20 text-slate-300 hover:text-[#E3BD6A] border border-slate-800 transition-colors shrink-0"
              >
                🍕 Margherita D.O.P.
              </button>
              <button
                onClick={() => setSearchFilter('Smash')}
                className="px-2.5 py-1 rounded-lg bg-[#111111] hover:bg-[#E3BD6A]/20 text-slate-300 hover:text-[#E3BD6A] border border-slate-800 transition-colors shrink-0"
              >
                🍔 Double Smash Angus
              </button>
            </div>
          </div>

          {/* Gastronomic Quality Badges */}
          <div className="pt-2 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-[#111111]/80 backdrop-blur-md border border-[#E3BD6A]/20 p-3 rounded-2xl flex items-center gap-3">
              <span className="text-xl">⭐</span>
              <div className="text-xs">
                <span className="font-extrabold text-[#F5F5F5] block">4.9 / 5.0</span>
                <span className="text-[#E3BD6A] text-[10px]">Avaliação Auditada</span>
              </div>
            </div>

            <div className="bg-[#111111]/80 backdrop-blur-md border border-[#E3BD6A]/20 p-3 rounded-2xl flex items-center gap-3">
              <span className="text-xl">⏱️</span>
              <div className="text-xs">
                <span className="font-extrabold text-[#F5F5F5] block">25 a 45 min</span>
                <span className="text-[#E3BD6A] text-[10px]">Preparo &amp; Despacho</span>
              </div>
            </div>

            <div className="bg-[#111111]/80 backdrop-blur-md border border-[#E3BD6A]/20 p-3 rounded-2xl flex items-center gap-3">
              <span className="text-xl">🌿</span>
              <div className="text-xs">
                <span className="font-extrabold text-[#F5F5F5] block">100% Artesanal</span>
                <span className="text-[#E3BD6A] text-[10px]">Ingredientes Nobres</span>
              </div>
            </div>

            <div className="bg-[#111111]/80 backdrop-blur-md border border-[#E3BD6A]/20 p-3 rounded-2xl flex items-center gap-3">
              <span className="text-xl">🛵</span>
              <div className="text-xs">
                <span className="font-extrabold text-[#F5F5F5] block">Bag Térmica Selada</span>
                <span className="text-[#E3BD6A] text-[10px]">Temperatura Perfeita</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 🎥 SLIDER AUTOMÁTICO: PROMOÇÕES, FESTIVAIS & OFERTAS */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-[#FF7A00]" />
            <h2 className="text-lg sm:text-xl font-black text-[#F5F5F5] tracking-tight uppercase">
              Promoções &amp; Rodízios em Destaque
            </h2>
          </div>
          <span className="text-xs text-[#E3BD6A] font-semibold flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5" />
            Ofertas ativas hoje
          </span>
        </div>
        <LuxuryPromoSlider onSelectRestaurant={onSelectRestaurant} />
      </section>

      {/* 💎 BARRA DE FILTROS LUXO & COZINHAS */}
      <section className="glass-gold-card p-3 sm:p-4 rounded-2xl flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shadow-xl">
        {/* Category Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
          <button
            onClick={() => setCategoryFilter('all')}
            className={`min-h-[42px] px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-2 ${
              categoryFilter === 'all'
                ? 'bg-gradient-to-r from-[#C5A880] via-[#B85D3B] to-[#7D3F27] text-white shadow-[0_0_15px_rgba(197,168,128,0.4)] font-black'
                : 'bg-[#14110E] text-stone-300 hover:text-white border border-[#C5A880]/20'
            }`}
          >
            <span>✨ Todas as Cozinhas</span>
            <span className="text-[10px] opacity-80">({restaurantList.length})</span>
          </button>

          {restaurantList.map((rest) => {
            const isSelected = categoryFilter === rest.slug;
            return (
              <button
                key={rest.slug}
                onClick={() => setCategoryFilter(rest.slug)}
                className={`min-h-[42px] px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-2 ${
                  isSelected
                    ? 'bg-gradient-to-r from-[#C5A880] via-[#B85D3B] to-[#7D3F27] text-white shadow-[0_0_15px_rgba(197,168,128,0.4)] font-black'
                    : 'bg-[#14110E] text-stone-300 hover:text-white border border-[#C5A880]/20'
                }`}
              >
                <span>{rest.emoji}</span>
                <span>{rest.name}</span>
              </button>
            );
          })}
        </div>

        {/* Sort Selector */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-slate-400 hidden md:inline font-medium">Ordenar:</span>
          <select
            value={sortFilter}
            onChange={(e) => setSortFilter(e.target.value as any)}
            className="min-h-[42px] bg-[#111111] border border-[#E3BD6A]/30 text-xs text-slate-200 rounded-xl px-3.5 py-2 focus:outline-none focus:border-[#E3BD6A] cursor-pointer"
          >
            <option value="recommended">⭐ Destaques Recomendados</option>
            <option value="rating">★ Maior Avaliação</option>
            <option value="time">⏱️ Entrega Mais Rápida</option>
            <option value="fee">🛵 Menor Taxa de Entrega</option>
          </select>
        </div>
      </section>

      {/* ✨ RESTAURANTES INDEPENDENTES COM TODOS OS ATRIBUTOS SOLICITADOS */}
      <section className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-[#F5F5F5] tracking-tight flex items-center gap-2.5">
              <span>Restaurantes Autônomos Prime</span>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-[#C5A880]/15 text-[#C5A880] border border-[#C5A880]/30">
                {restaurantList.length} Cozinhas de Alto Padrão
              </span>
            </h2>
            <p className="text-xs text-stone-400 mt-0.5">
              Cada restaurante possui cardápio completo com 20 itens, fotos de alta qualidade, tema, promoções e identidade fina rústica premium.
            </p>
          </div>

          <span className="text-xs text-[#C5A880] font-bold bg-[#14110E] px-3.5 py-1.5 rounded-xl border border-[#C5A880]/30 self-start sm:self-auto">
            {filteredRestaurants.length} casas disponíveis
          </span>
        </div>

        {/* Vitrine Style Selector */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#111111]/80 p-3 rounded-2xl border border-[#E3BD6A]/20">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
            <span className="text-xs text-slate-400 font-bold shrink-0">Estilo dos Cards:</span>
            <button
              onClick={() => setForcedLayoutTheme('individual')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                forcedLayoutTheme === 'individual'
                  ? 'bg-[#E3BD6A] text-slate-950 font-black shadow'
                  : 'bg-black/60 text-slate-300 hover:text-white border border-slate-800'
              }`}
            >
              ✦ Conforme Restaurante
            </button>
            <button
              onClick={() => setForcedLayoutTheme('moderno_premium')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                forcedLayoutTheme === 'moderno_premium'
                  ? 'bg-[#E3BD6A] text-slate-950 font-black shadow'
                  : 'bg-black/60 text-slate-300 hover:text-white border border-slate-800'
              }`}
            >
              ✨ Moderno Premium
            </button>
            <button
              onClick={() => setForcedLayoutTheme('rustico_acolhedor')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                forcedLayoutTheme === 'rustico_acolhedor'
                  ? 'bg-amber-600 text-amber-50 font-black shadow'
                  : 'bg-black/60 text-slate-300 hover:text-white border border-slate-800'
              }`}
            >
              🌾 Rústico Acolhedor
            </button>
            <button
              onClick={() => setForcedLayoutTheme('clean_minimalista')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                forcedLayoutTheme === 'clean_minimalista'
                  ? 'bg-slate-100 text-slate-950 font-black shadow'
                  : 'bg-black/60 text-slate-300 hover:text-white border border-slate-800'
              }`}
            >
              ⚪ Clean Minimalista
            </button>
            <button
              onClick={() => setForcedLayoutTheme('dark_elegante')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                forcedLayoutTheme === 'dark_elegante'
                  ? 'bg-cyan-500 text-slate-950 font-black shadow'
                  : 'bg-black/60 text-slate-300 hover:text-white border border-slate-800'
              }`}
            >
              ⚡ Dark Elegante
            </button>
          </div>
        </div>

        {/* Cards Grid: Cada Restaurante com Capa Própria, Logo, Estilo e Chamada */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {filteredRestaurants.map((rest) => {
            const currentTheme =
              forcedLayoutTheme === 'individual'
                ? (rest.vitrineLayoutTheme || 'moderno_premium')
                : forcedLayoutTheme;

            const effectiveRest = {
              ...rest,
              vitrineLayoutTheme: currentTheme,
            };

            return (
              <VitrineRestaurantCard
                key={rest.slug}
                restaurant={effectiveRest}
                menuItems={menuItems}
                onSelect={(slug) => onSelectRestaurant(slug)}
                onOpenDossier={(e, r) => openDossier(e, r)}
              />
            );
          })}
        </div>
      </section>

      {/* 📸 PRATOS ASSINATURA DOS CHEFS (HIGHLIGHT COLETIVO) */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black text-[#F5F5F5] tracking-tight flex items-center gap-2">
              <Award className="w-5 h-5 text-[#E3BD6A]" />
              <span>Pratos Assinatura dos Mestres</span>
            </h2>
            <p className="text-xs text-slate-400">
              Criações de destaque preparadas com técnicas exclusivas em cada restaurante
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
                className="group rounded-2xl overflow-hidden bg-[#111111] border border-[#E3BD6A]/20 hover:border-[#E3BD6A]/60 cursor-pointer flex flex-col justify-between transition-all"
              >
                <div className="relative h-44 w-full overflow-hidden bg-[#050505]">
                  <img
                    src={dish.image}
                    alt={dish.name}
                    className="w-full h-full object-cover object-center group-hover:scale-110 transition-transform duration-500 filter brightness-[0.88]"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#111111] via-transparent to-transparent" />
                  <span className="absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-md bg-[#050505]/85 backdrop-blur-md border border-[#E3BD6A]/40 text-[#E3BD6A] font-black text-[10px] uppercase">
                    {rest?.name}
                  </span>
                </div>

                <div className="p-4 flex-1 flex flex-col justify-between space-y-2">
                  <div>
                    <h3 className="font-bold text-sm text-[#F5F5F5] group-hover:text-[#E3BD6A] transition-colors line-clamp-1">
                      {dish.name}
                    </h3>
                    <p className="text-xs text-slate-400 line-clamp-2 mt-1 leading-relaxed">
                      {dish.description}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                    <span className="text-base font-black text-[#E3BD6A]">
                      R$ {dish.price.toFixed(2)}
                    </span>
                    <span className="text-[11px] font-bold text-slate-300 group-hover:text-[#E3BD6A] flex items-center gap-1">
                      Pedir agora <ChevronRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 🧭 FOOTER RÁPIDO & RASTREADOR DE PEDIDOS */}
      <section className="glass-gold-card rounded-3xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4 border border-[#E3BD6A]/30 bg-[#111111]">
        <div>
          <h4 className="text-sm font-bold text-[#F5F5F5] flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#E3BD6A]" />
            <span>Já possui um pedido em andamento?</span>
          </h4>
          <p className="text-xs text-slate-400 mt-0.5">
            Acompanhe cada etapa da cozinha ao seu endereço pelo rastreador em tempo real.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            onClick={onOpenTracker}
            className="w-full sm:w-auto px-5 py-2.5 bg-[#050505] hover:bg-slate-900 text-white font-semibold text-xs rounded-xl border border-[#E3BD6A]/30 flex items-center justify-center gap-2 transition-colors shadow"
          >
            <Clock className="w-4 h-4 text-[#E3BD6A]" />
            <span>Rastrear Meu Pedido</span>
          </button>
        </div>
      </section>

      {/* MODAL DE DOSSIÊ INDEPENDENTE DA CASA */}
      <RestaurantDossierModal
        restaurant={selectedDossierRestaurant}
        categories={categories}
        menuItems={menuItems}
        isOpen={isDossierOpen}
        onClose={() => setIsDossierOpen(false)}
        onOpenMenu={(slug) => {
          setIsDossierOpen(false);
          onSelectRestaurant(slug);
        }}
      />

      {/* MODAL DE LINK HTTP PRÓPRIO & QR CODE */}
      <RestaurantDirectLinkModal
        restaurant={selectedLinkRestaurant}
        isOpen={!!selectedLinkRestaurant}
        onClose={() => setSelectedLinkRestaurant(null)}
        onNavigateDirect={(r) => {
          setSelectedLinkRestaurant(null);
          onSelectRestaurant(r.slug);
        }}
      />
    </div>
  );
};
