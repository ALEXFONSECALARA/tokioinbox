import React, { useEffect, useState } from 'react';
import { RestaurantConfig } from '../types';
import { normalizeSplashImage } from '../utils/helpers';

interface SplashScreenProps {
  config: RestaurantConfig;
  onFinish: () => void;
}

// Tela de abertura em tela cheia: mostra fotos do restaurante (pratos, ambiente,
// promoções) em sequência, com transição suave (crossfade + leve zoom "Ken Burns"),
// por alguns segundos, antes de abrir o cardápio — estilo iFood / Uber Eats / Airbnb.
export const SplashScreen: React.FC<SplashScreenProps> = ({ config, onFinish }) => {
  // Aceita o formato novo (objeto com ajuste individual) e o antigo (string[])
  // ao mesmo tempo — normalizeSplashImage() cuida da conversão dos dois.
  const images = (config.splashImages || [])
    .filter(Boolean)
    .map(normalizeSplashImage)
    .filter((img) => img.enabled !== false && img.url);
  const secondsPerImage = config.splashDurationSeconds || 3;
  const [activeIndex, setActiveIndex] = useState(0);
  const [isLeaving, setIsLeaving] = useState(false);

  const finish = () => {
    if (isLeaving) return;
    setIsLeaving(true);
    // Aguarda a transição de saída (fade) terminar antes de remover a tela
    setTimeout(onFinish, 450);
  };

  useEffect(() => {
    if (images.length === 0) {
      finish();
      return;
    }
    const advanceTimer = setInterval(() => {
      setActiveIndex((prev) => {
        if (prev >= images.length - 1) {
          clearInterval(advanceTimer);
          finish();
          return prev;
        }
        return prev + 1;
      });
    }, secondsPerImage * 1000);
    return () => clearInterval(advanceTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (images.length === 0) return null;

  return (
    <div
      className={`fixed inset-0 z-[100] bg-slate-950 overflow-hidden transition-opacity duration-500 ${
        isLeaving ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      role="dialog"
      aria-label={`Abrindo ${config.name}`}
    >
      {/* Fotos em crossfade com leve zoom contínuo (Ken Burns) — cada uma com
          seu próprio enquadramento/zoom/escurecimento e legenda opcional.
          Tocar na foto avança pro próximo slide (ou pula pro cardápio na última),
          do jeito Instagram/WhatsApp Stories — substitui o botão "Pular" fixo. */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => {
          setActiveIndex((prev) => {
            if (prev >= images.length - 1) {
              finish();
              return prev;
            }
            return prev + 1;
          });
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setActiveIndex((prev) => {
              if (prev >= images.length - 1) {
                finish();
                return prev;
              }
              return prev + 1;
            });
          }
        }}
        aria-label="Toque para avançar"
        className="absolute inset-0 w-full h-full cursor-pointer"
      >
        {images.map((img, idx) => (
        <div
          key={img.url + idx}
          className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
            idx === activeIndex ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <img
            src={img.url}
            alt=""
            className={`w-full h-full object-cover ${idx === activeIndex ? 'animate-splash-kenburns' : ''}`}
            style={{
              objectPosition: `${img.positionX ?? 50}% ${img.positionY ?? 50}%`,
              transform: `scale(${(img.zoom ?? 100) / 100})`,
            }}
          />
          {(img.overlay ?? 0) > 0 && (
            <div className="absolute inset-0 bg-black" style={{ opacity: (img.overlay ?? 0) / 100 }} />
          )}
          {img.text && (
            <div className="absolute bottom-24 inset-x-0 text-center px-6">
              <p className="text-white text-base sm:text-lg font-bold drop-shadow-lg">{img.text}</p>
            </div>
          )}
        </div>
        ))}

        {/* Camada escura para o texto ficar legível */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/20 to-slate-950/60" />

        {/* Conteúdo: logo + nome + slogan */}
        <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
          {config.logo && (
            <img
              src={config.logo}
              alt={config.name}
              className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl object-cover shadow-2xl ring-4 ring-white/20 mb-5 animate-splash-pop"
            />
          )}
          <h1 className="text-white text-2xl sm:text-4xl font-black tracking-tight drop-shadow-lg animate-splash-fade-up">
            {config.name}
          </h1>
          {config.tagline && (
            <p className="text-white/85 text-sm sm:text-base font-medium mt-2 max-w-md drop-shadow animate-splash-fade-up [animation-delay:120ms]">
              {config.tagline}
            </p>
          )}
        </div>

        {/* Barra de progresso (uma seção por foto) */}
        <div className="absolute top-0 inset-x-0 flex gap-1.5 p-3 sm:p-4">
          {images.map((_, idx) => (
            <div key={idx} className="h-1 flex-1 rounded-full bg-white/25 overflow-hidden">
              <div
                className={`h-full bg-white rounded-full ${
                  idx < activeIndex
                    ? 'w-full'
                    : idx === activeIndex
                    ? 'w-full animate-splash-progress'
                    : 'w-0'
                }`}
                style={idx === activeIndex ? { animationDuration: `${secondsPerImage}s` } : undefined}
              />
            </div>
          ))}
        </div>

        {/* Dica sutil de que a tela responde ao toque (sem botão de pular) */}
        <p className="absolute bottom-6 inset-x-0 text-center text-white/60 text-[11px] font-semibold tracking-wide pointer-events-none">
          Toque para avançar
        </p>
      </div>
    </div>
  );
};
