import React, { useState, useEffect, useRef } from 'react';
import { RestaurantSlug } from '../types/restaurant';
import { useStore } from '../context/StoreContext';
import { Sparkles, ChevronLeft, ChevronRight, ArrowRight, Flame, Clock, Award } from 'lucide-react';

interface SlideData {
  id: string;
  restaurantSlug: RestaurantSlug;
  badge: string;
  badgeIcon: string;
  title: string;
  highlightText: string;
  description: string;
  offerTag: string;
  image: string;
  ctaText: string;
}

const PROMO_SLIDES: SlideData[] = [
  {
    id: 'slide-risotos-nobile',
    restaurantSlug: 'risotos',
    badge: 'ALTA GASTRONOMIA ITALIANA',
    badgeIcon: '🍲',
    title: 'Il Nobile • Risotto al Tartufo Nero',
    highlightText: 'Arroz Carnaroli D.O.P. & Trufas Negras',
    description: 'Cremado lentamente ao vinho branco, fonduta de parmesão 36 meses e lâminas de trufa negra fresca da Úmbria.',
    offerTag: 'Menu Degustação com Harmonização',
    image: 'https://images.unsplash.com/photo-1633964913295-ceb43826e7c9?w=1600&auto=format&fit=crop&q=85',
    ctaText: 'Ver Risotteria Il Nobile',
  },
  {
    id: 'slide-parrilla-fuego',
    restaurantSlug: 'grelhados',
    badge: 'PARRILLA & CORTES NOBRES',
    badgeIcon: '🥩',
    title: 'Fuego & Brasa • Tomahawk Dry Aged',
    highlightText: 'Brasa a Lenha de Macieira & Flor de Sal',
    description: 'Maturado por 45 dias para máxima maciez e selado na grelha argentina a 400°C com manteiga de chimichurri fresco.',
    offerTag: 'Acompanha Farofa na Brasa & Legumes',
    image: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=1600&auto=format&fit=crop&q=85',
    ctaText: 'Ver Cortes & Grelhados',
  },
  {
    id: 'slide-vegano-botanique',
    restaurantSlug: 'vegano',
    badge: 'HAUTE CUISINE VEGETAL',
    badgeIcon: '🌿',
    title: 'Botanique • Wellington da Terra Prime',
    highlightText: 'Cogumelos Selvagens & Trufas da Mantiqueira',
    description: 'Massa folhada artesanal dourada, duxelles de portobello selvagem, redução de aceto balsâmico e purê aveludado.',
    offerTag: '100% Plant-Based • Gastronomia Nobre',
    image: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=1600&auto=format&fit=crop&q=85',
    ctaText: 'Ver Cardápio Botanique',
  },
  {
    id: 'slide-rodizio-japones',
    restaurantSlug: 'japones',
    badge: 'OMAKASE & SUSHIS NOBRES',
    badgeIcon: '🍣',
    title: 'Festival Sakura & Rodízio Premium',
    highlightText: 'Sashimis Nobres & Niguiris Trufados',
    description: 'Experimente cortes nobres de salmão fresco, carpaccios maçaricados com flor de sal e uramakis especiais sem limite.',
    offerTag: 'A partir de R$ 119,90 • Almoço e Jantar',
    image: 'https://images.unsplash.com/photo-1611143669185-af224c5e3252?w=1600&auto=format&fit=crop&q=85',
    ctaText: 'Ver Rodízio & Combinados',
  },
  {
    id: 'slide-pasta-italiana',
    restaurantSlug: 'italiano',
    badge: 'CUCINA ARTIGIANALE TOSCANA',
    badgeIcon: '🍝',
    title: 'Noite della Pasta & Ragu di Costela',
    highlightText: 'Massas Frescas com Grana Padano',
    description: 'Fettuccine feito à mão e nhoques dourados com fonduta de queijos italianos apurados lentamente por 6 horas.',
    offerTag: '20% OFF no Segundo Prato Principal',
    image: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=1600&auto=format&fit=crop&q=85',
    ctaText: 'Explorar Massas & Risottos',
  },
  {
    id: 'slide-pizza-napolitana',
    restaurantSlug: 'pizza',
    badge: 'FORNO A LENHA 450°C',
    badgeIcon: '🍕',
    title: 'Pizzas Napolitanas 48h Fermentação',
    highlightText: 'Fior di Latte D.O.P. & Borda Vulcão',
    description: 'Massa aerada e leve com tomates San Marzano e presunto cru de Parma. Ganhe chopp gelado em pedidos acima de R$ 90.',
    offerTag: 'Borda Vulcão Recheada em Dobro',
    image: 'https://images.unsplash.com/photo-1590947132387-155cc02f3212?w=1600&auto=format&fit=crop&q=85',
    ctaText: 'Pedir Pizza Napolitana',
  },
  {
    id: 'slide-burger-craft',
    restaurantSlug: 'hamburgueria',
    badge: 'BLEND 100% ANGUS CERTIFICADO',
    badgeIcon: '🍔',
    title: 'Double Smash Bacon & Cheddar Inglês',
    highlightText: 'Crostinha Crocante na Chapa Quente',
    description: 'Pão brioche tostado na manteiga de garrafa, bacon artesanal defumado e batatas rústicas com alecrim e queijo canastra.',
    offerTag: 'Combo Especial com Chopp Artesanal',
    image: 'https://images.unsplash.com/photo-1550547660-d9450f859349?w=1600&auto=format&fit=crop&q=85',
    ctaText: 'Ver Smash Burgers & Shakes',
  },
];

interface LuxuryPromoSliderProps {
  onSelectRestaurant: (slug: RestaurantSlug) => void;
}

export const LuxuryPromoSlider: React.FC<LuxuryPromoSliderProps> = ({ onSelectRestaurant }) => {
  const { restaurants } = useStore();
  const visibleSlides = PROMO_SLIDES.filter((slide) => {
    const restaurant = restaurants[slide.restaurantSlug];
    return Boolean(restaurant && restaurant.isActive !== false && restaurant.vitrineStatus !== 'OCULTO' && restaurant.isActiveInVitrine !== false);
  });
  const [currentIdx, setCurrentIdx] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const nextSlide = () => {
    setCurrentIdx((prev) => (prev + 1) % Math.max(visibleSlides.length, 1));
  };

  const prevSlide = () => {
    setCurrentIdx((prev) => (prev - 1 + Math.max(visibleSlides.length, 1)) % Math.max(visibleSlides.length, 1));
  };

  useEffect(() => {
    if (isHovered) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      nextSlide();
    }, 4500);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isHovered, currentIdx, visibleSlides.length]);

  useEffect(() => {
    if (currentIdx >= visibleSlides.length) setCurrentIdx(0);
  }, [currentIdx, visibleSlides.length]);

  if (visibleSlides.length === 0) return null;
  const slide = visibleSlides[currentIdx];

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="relative overflow-hidden rounded-3xl border border-[#C5A880]/30 bg-[#070605] shadow-[0_16px_48px_rgba(0,0,0,0.95)] group transition-all duration-300"
    >
      {/* Background Image with Cinematic Overlay & Parallax feel */}
      <div className="relative h-72 sm:h-96 w-full overflow-hidden">
        {visibleSlides.map((s, idx) => (
          <div
            key={s.id}
            className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
              idx === currentIdx ? 'opacity-100 z-10 scale-100' : 'opacity-0 z-0 scale-105 pointer-events-none'
            } transition-transform duration-[7000ms]`}
          >
            <img
              src={s.image}
              alt={s.title}
              className="w-full h-full object-cover object-center filter brightness-[0.68] contrast-[1.15]"
            />
            {/* Cinematic Gradient Vignette in #070605 */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#070605] via-[#070605]/60 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#070605]/95 via-[#070605]/50 to-transparent" />
          </div>
        ))}

        {/* Ambient Bronze Glow Shimmer Line on top border */}
        <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-[#C5A880] to-transparent z-20 opacity-90" />

        {/* Slide Content Overlay */}
        <div className="absolute inset-0 z-20 p-5 sm:p-10 flex flex-col justify-between">
          {/* Top Row: Badge & Progress indicator */}
          <div className="flex items-center justify-between gap-2">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#14110E]/85 backdrop-blur-md border border-[#C5A880]/40 text-[#C5A880] text-xs font-black tracking-wider uppercase shadow-lg">
              <span className="text-base">{slide.badgeIcon}</span>
              <span>{slide.badge}</span>
            </div>

            <div className="flex items-center gap-2 bg-[#14110E]/80 backdrop-blur-md px-3 py-1 rounded-full border border-[#C5A880]/20 text-[#F5F5F5] text-[11px] font-mono">
              <span className="text-[#C5A880] font-bold">0{currentIdx + 1}</span>
              <span className="text-stone-600">/</span>
              <span className="text-stone-400">0{visibleSlides.length}</span>
            </div>
          </div>

          {/* Bottom Area: Main Title, Highlights & CTA */}
          <div className="max-w-2xl space-y-3">
            <div className="space-y-1">
              <span className="text-xs sm:text-sm font-bold tracking-wide text-[#C5A880] flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-[#B85D3B]" />
                {slide.highlightText}
              </span>
              <h2 className="text-2xl sm:text-4xl font-black text-[#F5F5F5] tracking-tight leading-tight drop-shadow-md">
                {slide.title}
              </h2>
            </div>

            <p className="text-xs sm:text-sm text-stone-300 line-clamp-2 max-w-xl drop-shadow leading-relaxed">
              {slide.description}
            </p>

            <div className="pt-2 flex flex-wrap items-center gap-3">
              <button
                onClick={() => onSelectRestaurant(slide.restaurantSlug)}
                className="px-5 py-2.5 bg-gradient-to-r from-[#C5A880] via-[#B85D3B] to-[#7D3F27] hover:brightness-110 text-white text-xs sm:text-sm font-black rounded-xl shadow-[0_0_20px_rgba(197,168,128,0.35)] flex items-center gap-2 transition-all transform hover:scale-[1.03] active:scale-[0.98]"
              >
                <span>{slide.ctaText}</span>
                <ArrowRight className="w-4 h-4 text-white" />
              </button>

              <div className="px-3.5 py-2 rounded-xl bg-[#14110E]/90 backdrop-blur-md border border-[#C5A880]/30 text-[#C5A880] text-xs font-semibold flex items-center gap-2">
                <Flame className="w-4 h-4 text-[#B85D3B]" />
                <span className="text-stone-200">{slide.offerTag}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Arrows */}
        <button
          onClick={prevSlide}
          aria-label="Slide anterior"
          className="absolute left-3 top-1/2 -translate-y-1/2 z-30 w-10 h-10 rounded-full bg-[#070605]/80 hover:bg-[#14110E] text-[#F5F5F5]/80 hover:text-[#C5A880] border border-[#C5A880]/30 hover:border-[#C5A880] backdrop-blur-md flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 shadow-xl"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <button
          onClick={nextSlide}
          aria-label="Próximo slide"
          className="absolute right-3 top-1/2 -translate-y-1/2 z-30 w-10 h-10 rounded-full bg-[#070605]/80 hover:bg-[#14110E] text-[#F5F5F5]/80 hover:text-[#C5A880] border border-[#C5A880]/30 hover:border-[#C5A880] backdrop-blur-md flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 shadow-xl"
        >
          <ChevronRight className="w-5 h-5" />
        </button>

        {/* Slider Bottom Progress Bars */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2">
          {PROMO_SLIDES.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentIdx(idx)}
              aria-label={`Ir para promoção ${idx + 1}`}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                idx === currentIdx
                  ? 'w-8 bg-[#C5A880] shadow-[0_0_10px_rgba(197,168,128,0.9)]'
                  : 'w-2 bg-stone-700/80 hover:bg-stone-500'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
