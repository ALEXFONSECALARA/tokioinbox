import React, { useState, useEffect, useRef } from 'react';
import { RestaurantSlug } from '../types/restaurant';
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
    id: 'slide-rodizio-japones',
    restaurantSlug: 'japones',
    badge: 'RODÍZIO GOURMET EXCLUSIVO',
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
  const [currentIdx, setCurrentIdx] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const nextSlide = () => {
    setCurrentIdx((prev) => (prev + 1) % PROMO_SLIDES.length);
  };

  const prevSlide = () => {
    setCurrentIdx((prev) => (prev - 1 + PROMO_SLIDES.length) % PROMO_SLIDES.length);
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
  }, [isHovered, currentIdx]);

  const slide = PROMO_SLIDES[currentIdx];

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="relative overflow-hidden rounded-3xl border border-amber-500/30 bg-[#0c0c10] shadow-[0_12px_40px_rgba(0,0,0,0.8)] group transition-all duration-300"
    >
      {/* Background Image with Cinematic Overlay & Parallax feel */}
      <div className="relative h-72 sm:h-96 w-full overflow-hidden">
        {PROMO_SLIDES.map((s, idx) => (
          <div
            key={s.id}
            className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
              idx === currentIdx ? 'opacity-100 z-10 scale-100' : 'opacity-0 z-0 scale-105 pointer-events-none'
            } transition-transform duration-[7000ms]`}
          >
            <img
              src={s.image}
              alt={s.title}
              className="w-full h-full object-cover object-center filter brightness-[0.78] contrast-[1.1]"
            />
            {/* Cinematic Gradient Vignette */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#09090d] via-[#09090d]/60 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#09090d]/90 via-[#09090d]/40 to-transparent" />
          </div>
        ))}

        {/* Ambient Gold Glow Shimmer Line on top border */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-amber-400 to-transparent z-20 opacity-80" />

        {/* Slide Content Overlay */}
        <div className="absolute inset-0 z-20 p-5 sm:p-10 flex flex-col justify-between">
          {/* Top Row: Badge & Progress indicator */}
          <div className="flex items-center justify-between gap-2">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-amber-500/40 text-amber-300 text-xs font-bold tracking-wider uppercase shadow-lg">
              <span className="text-base">{slide.badgeIcon}</span>
              <span>{slide.badge}</span>
            </div>

            <div className="flex items-center gap-2 bg-black/50 backdrop-blur-md px-3 py-1 rounded-full border border-slate-800 text-slate-300 text-[11px] font-mono">
              <span className="text-amber-400 font-bold">0{currentIdx + 1}</span>
              <span className="text-slate-600">/</span>
              <span>0{PROMO_SLIDES.length}</span>
            </div>
          </div>

          {/* Bottom Area: Main Title, Highlights & CTA */}
          <div className="max-w-2xl space-y-3">
            <div className="space-y-1">
              <span className="text-xs sm:text-sm font-semibold tracking-wide text-amber-400 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4" />
                {slide.highlightText}
              </span>
              <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight leading-tight drop-shadow-md">
                {slide.title}
              </h2>
            </div>

            <p className="text-xs sm:text-sm text-slate-300 line-clamp-2 max-w-xl drop-shadow leading-relaxed">
              {slide.description}
            </p>

            <div className="pt-2 flex flex-wrap items-center gap-3">
              <button
                onClick={() => onSelectRestaurant(slide.restaurantSlug)}
                className="px-5 py-2.5 bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 text-xs sm:text-sm font-black rounded-xl shadow-[0_0_20px_rgba(245,158,11,0.4)] hover:shadow-[0_0_25px_rgba(245,158,11,0.6)] flex items-center gap-2 transition-all transform hover:scale-[1.03] active:scale-[0.98]"
              >
                <span>{slide.ctaText}</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <div className="px-3.5 py-2 rounded-xl bg-black/60 backdrop-blur-md border border-amber-500/30 text-amber-300 text-xs font-semibold flex items-center gap-2">
                <Flame className="w-4 h-4 text-amber-400" />
                <span>{slide.offerTag}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Arrows */}
        <button
          onClick={prevSlide}
          aria-label="Slide anterior"
          className="absolute left-3 top-1/2 -translate-y-1/2 z-30 w-10 h-10 rounded-full bg-black/60 hover:bg-black/90 text-white/80 hover:text-amber-400 border border-slate-700/60 hover:border-amber-500/50 backdrop-blur-md flex items-center justify-center transition-all opacity-0 group-hover:opacity-100"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <button
          onClick={nextSlide}
          aria-label="Próximo slide"
          className="absolute right-3 top-1/2 -translate-y-1/2 z-30 w-10 h-10 rounded-full bg-black/60 hover:bg-black/90 text-white/80 hover:text-amber-400 border border-slate-700/60 hover:border-amber-500/50 backdrop-blur-md flex items-center justify-center transition-all opacity-0 group-hover:opacity-100"
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
                  ? 'w-8 bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]'
                  : 'w-2 bg-slate-600/70 hover:bg-slate-400'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
