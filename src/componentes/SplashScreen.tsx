import React, { useState, useEffect } from 'react';
import { RestaurantConfig } from '../types/restaurant';
import { ChevronRight, ArrowRight, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface SplashScreenProps {
  restaurant: RestaurantConfig;
  onClose: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ restaurant, onClose }) => {
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);

  const slides = restaurant.splashSlides && restaurant.splashSlides.length > 0
    ? restaurant.splashSlides
    : [
        {
          image: restaurant.banner,
          title: restaurant.name,
          subtitle: restaurant.tagline,
        },
      ];

  // Auto-advance slides every 4 seconds
  useEffect(() => {
    if (slides.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentSlideIndex((prev) => (prev + 1) % slides.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [slides.length]);

  const currentSlide = slides[currentSlideIndex];

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col justify-between overflow-hidden">
      {/* Background Image with animated transition */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentSlideIndex}
          initial={{ opacity: 0, scale: 1.05 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.8 }}
          className="absolute inset-0 z-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${currentSlide.image})` }}
        >
          {/* Gradient Overlays */}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/70 to-slate-950/40" />
          <div className="absolute inset-0 bg-radial-at-c from-transparent to-slate-950/80" />
        </motion.div>
      </AnimatePresence>

      {/* Top Bar: Brand & Skip Button */}
      <div className="relative z-10 px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-slate-900/80 border border-slate-700/80 backdrop-blur-md flex items-center justify-center text-xl shadow-lg">
            {restaurant.emoji}
          </div>
          <div>
            <h2 className="text-sm font-bold text-white tracking-wide uppercase">
              {restaurant.name}
            </h2>
            <p className="text-[11px] text-amber-400 font-medium">{restaurant.cuisine}</p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="px-3.5 py-1.5 rounded-full bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/60 backdrop-blur-md text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md"
        >
          <span>Pular</span>
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Bottom Content Area */}
      <div className="relative z-10 px-6 pb-10 max-w-2xl mx-auto w-full flex flex-col items-center text-center">
        {/* Slide Indicator Dots */}
        {slides.length > 1 && (
          <div className="flex items-center gap-2 mb-6">
            {slides.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentSlideIndex(idx)}
                className={`h-1.5 rounded-full transition-all ${
                  idx === currentSlideIndex
                    ? 'w-8 bg-amber-400'
                    : 'w-2 bg-slate-600 hover:bg-slate-400'
                }`}
                aria-label={`Slide ${idx + 1}`}
              />
            ))}
          </div>
        )}

        {/* Dynamic Titles */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentSlideIndex}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.5 }}
            className="space-y-3 mb-8"
          >
            <span className="inline-block px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-semibold uppercase tracking-wider">
              {restaurant.tagline}
            </span>
            <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
              {currentSlide.title}
            </h1>
            <p className="text-sm sm:text-base text-slate-300 max-w-lg mx-auto">
              {currentSlide.subtitle}
            </p>
          </motion.div>
        </AnimatePresence>

        {/* Enter Menu CTA Button */}
        <button
          onClick={onClose}
          className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-extrabold text-base flex items-center justify-center gap-3 shadow-xl hover:shadow-amber-500/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          <span>Acessar Cardápio Completo</span>
          <ArrowRight className="w-5 h-5" />
        </button>

        <p className="text-[11px] text-slate-400 mt-4">
          Faça seu pedido para Delivery, Retirada ou Mesa no salão
        </p>
      </div>
    </div>
  );
};
