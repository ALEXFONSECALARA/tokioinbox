import React, { useState } from 'react';
import { RestaurantConfig, MenuItem, MenuCategory, RestaurantSlug } from '../types/restaurant';
import {
  X,
  Star,
  Clock,
  Bike,
  Store,
  UtensilsCrossed,
  Phone,
  MessageCircle,
  MapPin,
  Sparkles,
  Flame,
  Copy,
  Check,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Tag,
  Share2,
} from 'lucide-react';

interface RestaurantDossierModalProps {
  restaurant: RestaurantConfig | null;
  categories: MenuCategory[];
  menuItems: MenuItem[];
  isOpen: boolean;
  onClose: () => void;
  onOpenMenu: (slug: RestaurantSlug) => void;
  onSelectProduct?: (item: MenuItem) => void;
}

export const RestaurantDossierModal: React.FC<RestaurantDossierModalProps> = ({
  restaurant,
  categories,
  menuItems,
  isOpen,
  onClose,
  onOpenMenu,
  onSelectProduct,
}) => {
  const [activeTab, setActiveTab] = useState<'cardapio' | 'promocoes' | 'avaliacoes' | 'contato'>('cardapio');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [copiedCoupon, setCopiedCoupon] = useState<string | null>(null);

  if (!isOpen || !restaurant) return null;

  const restaurantCategories = categories.filter((c) => c.restaurantSlug === restaurant.slug);
  const restaurantItems = menuItems.filter((m) => m.restaurantSlug === restaurant.slug);

  const filteredItems = selectedCategory === 'all'
    ? restaurantItems
    : restaurantItems.filter((item) => item.categoryId === selectedCategory);

  const copyCoupon = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCoupon(code);
    setTimeout(() => setCopiedCoupon(null), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-xl animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-4xl max-h-[92vh] flex flex-col rounded-3xl bg-[#050505] border border-[#E3BD6A]/40 shadow-[0_24px_80px_rgba(0,0,0,0.95)] overflow-hidden"
        style={{
          boxShadow: '0 0 35px rgba(227, 189, 106, 0.15), 0 20px 60px rgba(0, 0, 0, 0.95)',
        }}
      >
        {/* Ambient Top Glow Line */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#E3BD6A] to-transparent z-30" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-40 w-10 h-10 rounded-full bg-[#111111]/90 hover:bg-[#050505] text-slate-300 hover:text-[#E3BD6A] border border-[#E3BD6A]/30 hover:border-[#E3BD6A] flex items-center justify-center transition-colors shadow-lg"
          aria-label="Fechar detalhes da casa"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Hero Banner */}
        <div className="relative h-44 sm:h-56 w-full shrink-0 overflow-hidden bg-[#111111]">
          <img
            src={restaurant.banner}
            alt={restaurant.name}
            className="w-full h-full object-cover object-center filter brightness-[0.70] contrast-[1.1]"
          />
          {/* Subtle Vignette Gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/60 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#050505]/80 via-transparent to-transparent" />

          {/* Status Badge */}
          <div className="absolute top-4 left-4 z-20">
            <span
              className={`px-3 py-1 rounded-full text-xs font-black border backdrop-blur-md flex items-center gap-1.5 shadow-lg ${
                restaurant.isOpen
                  ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40'
                  : 'bg-rose-950/80 text-rose-300 border-rose-500/40'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  restaurant.isOpen ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'
                }`}
              />
              {restaurant.isOpen ? 'Aberto Agora' : 'Fechado no Momento'}
            </span>
          </div>

          {/* Logo, Title & Tagline in Banner */}
          <div className="absolute bottom-4 left-4 right-16 flex items-end gap-3.5 z-20">
            <div className="relative shrink-0">
              <img
                src={restaurant.logo}
                alt={restaurant.name}
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover border-2 border-[#E3BD6A] shadow-[0_0_20px_rgba(227,189,106,0.35)]"
              />
              <span className="absolute -bottom-1 -right-1 text-lg filter drop-shadow">
                {restaurant.emoji}
              </span>
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-[#E3BD6A] bg-[#111111]/90 border border-[#E3BD6A]/30 px-2 py-0.5 rounded-md backdrop-blur-md">
                  {restaurant.themeStyle?.badge || restaurant.cuisine}
                </span>
                <span className="text-[11px] text-amber-400 font-bold flex items-center gap-1">
                  <Star className="w-3 h-3 fill-[#E3BD6A] text-[#E3BD6A]" />
                  {restaurant.rating.toFixed(1)} ({restaurant.reviewCount} avaliações)
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-[#F5F5F5] tracking-tight leading-tight truncate mt-1">
                {restaurant.name}
              </h2>
              <p className="text-xs text-slate-300 line-clamp-1 max-w-xl">
                {restaurant.tagline}
              </p>
            </div>
          </div>
        </div>

        {/* Quick Modality & Delivery Strip */}
        <div className="bg-[#111111] border-y border-[#E3BD6A]/20 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-4 text-slate-300">
            <span className="flex items-center gap-1 font-semibold">
              <Clock className="w-3.5 h-3.5 text-[#E3BD6A]" />
              <span>{restaurant.estimatedTimeMin}-{restaurant.estimatedTimeMax} min</span>
            </span>
            <span className="text-slate-600">•</span>
            <span className="flex items-center gap-1 font-bold text-emerald-400">
              <Bike className="w-3.5 h-3.5 text-emerald-400" />
              <span>Taxa: R$ {restaurant.deliveryFee.toFixed(2)}</span>
            </span>
            {restaurant.freeDeliveryThreshold && (
              <>
                <span className="text-slate-600 hidden sm:inline">•</span>
                <span className="text-[11px] text-[#E3BD6A] hidden sm:inline">
                  Frete Grátis acima de R$ {restaurant.freeDeliveryThreshold.toFixed(2)}
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-md bg-[#050505] border border-slate-800 text-[11px] text-slate-300">
              Pedido mín: R$ {restaurant.minOrderValue.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Navigation Tabs (Cardápio, Promoções, Avaliações, Contato) */}
        <div className="bg-[#050505] border-b border-[#E3BD6A]/20 px-4 flex items-center gap-2 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('cardapio')}
            className={`min-h-[44px] px-4 text-xs font-black flex items-center gap-1.5 border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'cardapio'
                ? 'border-[#E3BD6A] text-[#E3BD6A]'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <UtensilsCrossed className="w-3.5 h-3.5" />
            <span>Cardápio &amp; Produtos ({restaurantItems.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('promocoes')}
            className={`min-h-[44px] px-4 text-xs font-black flex items-center gap-1.5 border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'promocoes'
                ? 'border-[#E3BD6A] text-[#E3BD6A]'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Flame className="w-3.5 h-3.5 text-[#FF7A00]" />
            <span>Promoções &amp; Cupons ({restaurant.promotions?.length || 0})</span>
          </button>

          <button
            onClick={() => setActiveTab('avaliacoes')}
            className={`min-h-[44px] px-4 text-xs font-black flex items-center gap-1.5 border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'avaliacoes'
                ? 'border-[#E3BD6A] text-[#E3BD6A]'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Star className="w-3.5 h-3.5 fill-[#E3BD6A] text-[#E3BD6A]" />
            <span>Avaliações ({restaurant.reviewCount})</span>
          </button>

          <button
            onClick={() => setActiveTab('contato')}
            className={`min-h-[44px] px-4 text-xs font-black flex items-center gap-1.5 border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'contato'
                ? 'border-[#E3BD6A] text-[#E3BD6A]'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-[#E3BD6A]" />
            <span>Horários &amp; Redes Sociais</span>
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 bg-[#050505]">
          {/* TAB 1: CARDÁPIO & PRODUTOS */}
          {activeTab === 'cardapio' && (
            <div className="space-y-4">
              {/* Category selector pills */}
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                <button
                  onClick={() => setSelectedCategory('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                    selectedCategory === 'all'
                      ? 'bg-[#E3BD6A] text-slate-950 font-black shadow-[0_0_10px_rgba(227,189,106,0.4)]'
                      : 'bg-[#111111] text-slate-300 hover:text-white border border-[#E3BD6A]/20'
                  }`}
                >
                  Todos ({restaurantItems.length})
                </button>
                {restaurantCategories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                      selectedCategory === cat.id
                        ? 'bg-[#E3BD6A] text-slate-950 font-black shadow-[0_0_10px_rgba(227,189,106,0.4)]'
                        : 'bg-[#111111] text-slate-300 hover:text-white border border-[#E3BD6A]/20'
                    }`}
                  >
                    <span>{cat.icon}</span>
                    <span>{cat.name}</span>
                  </button>
                ))}
              </div>

              {/* Items Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {filteredItems.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => {
                      if (onSelectProduct) onSelectProduct(item);
                    }}
                    className="p-3.5 rounded-2xl bg-[#111111] border border-[#E3BD6A]/20 hover:border-[#E3BD6A]/60 flex items-center justify-between gap-3 cursor-pointer group transition-all"
                  >
                    <div className="flex-1 min-w-0 pr-2 space-y-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h4 className="font-bold text-sm text-[#F5F5F5] group-hover:text-[#E3BD6A] transition-colors truncate">
                          {item.name}
                        </h4>
                        {item.tags?.includes('mais_vendido') && (
                          <span className="text-[9px] font-black text-[#FF7A00] bg-[#FF7A00]/10 border border-[#FF7A00]/30 px-1.5 py-0.2 rounded">
                            MAIS PEDIDO
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                        {item.description}
                      </p>
                      <div className="pt-1 flex items-center gap-2">
                        <span className="font-black text-sm text-[#E3BD6A]">
                          R$ {item.price.toFixed(2)}
                        </span>
                        {item.promoPrice && (
                          <span className="text-xs line-through text-slate-500">
                            R$ {item.promoPrice.toFixed(2)}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="relative w-20 h-20 shrink-0 rounded-xl overflow-hidden bg-slate-900 border border-[#E3BD6A]/20">
                      <img
                        src={item.image}
                        alt={item.name}
                        className="w-full h-full object-cover object-center group-hover:scale-110 transition-transform duration-300"
                        loading="lazy"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 2: PROMOÇÕES & CUPONS */}
          {activeTab === 'promocoes' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-gradient-to-r from-[#111111] via-[#1a1408] to-[#111111] border border-[#E3BD6A]/30 flex items-center gap-3">
                <Sparkles className="w-6 h-6 text-[#E3BD6A] shrink-0 animate-pulse" />
                <div>
                  <h4 className="font-black text-sm text-[#F5F5F5]">
                    Vantagens &amp; Ofertas Exclusivas da Casa
                  </h4>
                  <p className="text-xs text-slate-400">
                    Aproveite os cupons independentes e promoções sazonais desta cozinha.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {(restaurant.promotions || []).map((promo) => (
                  <div
                    key={promo.id}
                    className="p-4 rounded-2xl bg-[#111111] border border-[#E3BD6A]/30 space-y-3 relative overflow-hidden"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-wider text-[#FF7A00] bg-[#FF7A00]/10 border border-[#FF7A00]/30 px-2 py-0.5 rounded">
                        {promo.badge}
                      </span>
                      <span className="text-xs font-black text-[#E3BD6A]">
                        {promo.discountText}
                      </span>
                    </div>

                    <div>
                      <h4 className="font-bold text-sm text-[#F5F5F5]">
                        {promo.title}
                      </h4>
                      <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                        {promo.description}
                      </p>
                    </div>

                    {promo.couponCode && (
                      <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1 text-xs font-mono text-amber-300 bg-black/60 px-2.5 py-1 rounded-lg border border-[#E3BD6A]/30">
                          <Tag className="w-3.5 h-3.5 text-[#E3BD6A]" />
                          <span>{promo.couponCode}</span>
                        </div>

                        <button
                          onClick={() => copyCoupon(promo.couponCode!)}
                          className="px-3 py-1 bg-[#E3BD6A] hover:bg-[#f3d185] text-slate-950 font-black text-xs rounded-lg flex items-center gap-1 transition-all"
                        >
                          {copiedCoupon === promo.couponCode ? (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              <span>Copiado!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Copiar Cupom</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: AVALIAÇÕES & DEPOIMENTOS */}
          {activeTab === 'avaliacoes' && (
            <div className="space-y-5">
              {/* Rating Overview Box */}
              <div className="p-4 sm:p-6 rounded-2xl bg-[#111111] border border-[#E3BD6A]/30 flex flex-col sm:flex-row items-center justify-between gap-6">
                <div className="text-center sm:text-left space-y-1">
                  <div className="flex items-center justify-center sm:justify-start gap-2">
                    <span className="text-4xl font-black text-[#F5F5F5]">
                      {restaurant.rating.toFixed(1)}
                    </span>
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star key={s} className="w-4 h-4 fill-[#E3BD6A] text-[#E3BD6A]" />
                        ))}
                      </div>
                      <span className="text-xs text-slate-400 mt-0.5">
                        {restaurant.reviewCount} clientes avaliaram
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-[#E3BD6A]">
                    {restaurant.reviewsInfo?.fiveStarsPercent || 96}% das avaliações são 5 estrelas
                  </p>
                </div>

                <div className="text-xs text-slate-300 space-y-1.5 w-full sm:w-64 border-t sm:border-t-0 sm:border-l border-slate-800 pt-3 sm:pt-0 sm:pl-6">
                  <div className="flex items-center justify-between">
                    <span>Sabor &amp; Ponto</span>
                    <span className="font-bold text-[#E3BD6A]">5.0 ★</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Apresentação &amp; Embalagem</span>
                    <span className="font-bold text-[#E3BD6A]">4.9 ★</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Velocidade de Entrega</span>
                    <span className="font-bold text-[#E3BD6A]">4.8 ★</span>
                  </div>
                </div>
              </div>

              {/* Verified Customer Reviews */}
              <div className="space-y-3">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Depoimentos Verificados da Casa</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {(restaurant.reviewsInfo?.items || []).map((rev, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-2xl bg-[#111111] border border-[#E3BD6A]/20 space-y-2 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white">{rev.author}</span>
                        <div className="flex items-center gap-0.5">
                          {[...Array(rev.stars)].map((_, i) => (
                            <Star key={i} className="w-3 h-3 fill-[#E3BD6A] text-[#E3BD6A]" />
                          ))}
                        </div>
                      </div>
                      <p className="text-slate-300 italic leading-relaxed">
                        "{rev.comment}"
                      </p>
                      <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-800/80">
                        <span className="text-[#E3BD6A] font-medium">{rev.dishTag}</span>
                        <span>{rev.date}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: HORÁRIOS, TAXAS & REDES SOCIAIS */}
          {activeTab === 'contato' && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Hours Box */}
                <div className="p-4 rounded-2xl bg-[#111111] border border-[#E3BD6A]/20 space-y-2">
                  <span className="text-xs font-black uppercase text-[#E3BD6A] flex items-center gap-1.5">
                    <Clock className="w-4 h-4" /> Horário de Funcionamento
                  </span>
                  <p className="text-sm font-bold text-white">
                    {restaurant.openingHours}
                  </p>
                  <p className="text-xs text-slate-400">
                    Cozinha opera com despachos imediatos para delivery ou pedidos no balcão e mesa.
                  </p>
                </div>

                {/* Delivery Rates */}
                <div className="p-4 rounded-2xl bg-[#111111] border border-[#E3BD6A]/20 space-y-2">
                  <span className="text-xs font-black uppercase text-emerald-400 flex items-center gap-1.5">
                    <Bike className="w-4 h-4" /> Entrega &amp; Logística
                  </span>
                  <div className="space-y-1 text-xs text-slate-300">
                    <p>Taxa Padrão: <strong className="text-emerald-400">R$ {restaurant.deliveryFee.toFixed(2)}</strong></p>
                    <p>Tempo Médio: <strong className="text-white">{restaurant.estimatedTimeMin} a {restaurant.estimatedTimeMax} min</strong></p>
                    {restaurant.freeDeliveryThreshold && (
                      <p>Frete Grátis: <strong className="text-[#E3BD6A]">Acima de R$ {restaurant.freeDeliveryThreshold.toFixed(2)}</strong></p>
                    )}
                  </div>
                </div>
              </div>

              {/* Socials & Direct Channels */}
              <div className="p-4 sm:p-5 rounded-2xl bg-[#111111] border border-[#E3BD6A]/30 space-y-4">
                <span className="text-xs font-black uppercase text-[#E3BD6A] flex items-center gap-1.5">
                  <Share2 className="w-4 h-4" /> Canais Oficiais &amp; Redes Sociais
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  {/* Instagram */}
                  <a
                    href={`https://instagram.com/${restaurant.instagram?.replace('@', '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-3 rounded-xl bg-[#050505] border border-pink-500/30 hover:border-pink-500/70 text-slate-200 hover:text-white flex items-center gap-3 transition-colors"
                  >
                    <span className="w-8 h-8 rounded-lg bg-pink-500/20 text-pink-400 flex items-center justify-center font-bold">
                      📸
                    </span>
                    <div>
                      <span className="block font-black text-[11px] text-pink-300">Instagram Oficial</span>
                      <span className="text-xs text-white">{restaurant.instagram}</span>
                    </div>
                  </a>

                  {/* WhatsApp */}
                  <a
                    href={`https://wa.me/${restaurant.whatsapp}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-3 rounded-xl bg-[#050505] border border-emerald-500/30 hover:border-emerald-500/70 text-slate-200 hover:text-white flex items-center gap-3 transition-colors"
                  >
                    <MessageCircle className="w-6 h-6 text-emerald-400 shrink-0" />
                    <div>
                      <span className="block font-black text-[11px] text-emerald-300">WhatsApp Direto</span>
                      <span className="text-xs text-white">{restaurant.phone}</span>
                    </div>
                  </a>

                  {/* Address / Map */}
                  <a
                    href={restaurant.socials?.mapUrl || `https://maps.google.com/?q=${encodeURIComponent(restaurant.address)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-3 rounded-xl bg-[#050505] border border-[#E3BD6A]/30 hover:border-[#E3BD6A] text-slate-200 hover:text-white flex items-center gap-3 transition-colors"
                  >
                    <MapPin className="w-6 h-6 text-[#E3BD6A] shrink-0" />
                    <div className="min-w-0">
                      <span className="block font-black text-[11px] text-[#E3BD6A]">Localização Física</span>
                      <span className="text-xs text-white truncate block">{restaurant.address}</span>
                    </div>
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer CTA */}
        <div className="p-4 sm:p-5 bg-[#111111] border-t border-[#E3BD6A]/20 flex items-center justify-between gap-3">
          <div className="hidden sm:block text-xs text-slate-400">
            Você está visualizando a casa autônoma <strong className="text-white">{restaurant.name}</strong>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              onClick={onClose}
              className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-[#050505] hover:bg-slate-900 border border-slate-800 text-slate-300 font-bold text-xs transition-colors"
            >
              Voltar ao Hub
            </button>

            <button
              onClick={() => {
                onClose();
                onOpenMenu(restaurant.slug);
              }}
              className="flex-1 sm:flex-initial px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#E3BD6A] via-[#FF7A00] to-[#A77A1C] hover:from-[#f3d185] hover:via-[#ff8e24] hover:to-[#bd8b24] text-slate-950 font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(227,189,106,0.35)]"
            >
              <span>Acessar Cardápio Completo</span>
              <ChevronRight className="w-4 h-4 text-slate-950" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
