import React from 'react';
import { getLayoutTheme } from '../utils/layouts';
import { UtensilsCrossed, ArrowRight } from 'lucide-react';
import { LayoutId } from '../types';

// Card de UM restaurante na vitrine multi-restaurantes. Usado tanto pela
// Landing pública quanto pela prévia do painel (LayoutPreviewModal) — um
// componente só, reaproveitado, pra nunca duplicar a estrutura visual.
//
// A ESTRUTURA muda de verdade conforme o "cardVariant" do layout escolhido
// (ver utils/layouts.ts) — não é só troca de cor:
//   overlay -> foto ocupa o card inteiro, texto flutua por cima dela
//   framed  -> foto com respiro dentro do card, texto abaixo da foto
//   ticket  -> faixa colorida com o nome ACIMA da foto, estilo ticket
export interface RestaurantCardData {
  slug?: string; // com slug vira link real; sem slug é só uma prévia (não clicável)
  name: string;
  tagline?: string;
  photo?: string;
  color?: string;
  secondaryColor?: string;
  layout?: LayoutId;
  bannerPositionX?: number;
  bannerPositionY?: number;
  bannerZoom?: number;
}

export const RestaurantCard: React.FC<{ restaurant: RestaurantCardData }> = ({ restaurant: r }) => {
  const theme = getLayoutTheme(r.layout);
  const accent = r.color || '#B45309';
  const accent2 = r.secondaryColor || accent;
  const Wrapper: any = r.slug ? 'a' : 'div';
  const wrapperProps = r.slug ? { href: `/r/${r.slug}` } : {};

  const photoEl = r.photo ? (
    <img
      src={r.photo}
      alt={r.name}
      loading="lazy"
      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
      style={{
        objectPosition: `${r.bannerPositionX ?? 50}% ${r.bannerPositionY ?? 50}%`,
        transform: r.bannerZoom ? `scale(${r.bannerZoom / 100})` : undefined,
      }}
    />
  ) : (
    // Só cai aqui se o restaurante ainda não configurou nenhuma foto — um
    // ícone neutro, nunca um emoji tratado como identidade.
    <div
      className="w-full h-full flex items-center justify-center"
      style={{ background: `linear-gradient(135deg, ${accent}33, ${accent2}22)` }}
    >
      <UtensilsCrossed className="w-10 h-10" style={{ color: accent }} />
    </div>
  );

  const button = (
    <span className={`inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold px-4 py-2 rounded-full ${theme.buttonStyle} min-h-[44px]`}>
      Ver cardápio <ArrowRight className="w-3.5 h-3.5" />
    </span>
  );

  // ---------- variante "ticket": faixa colorida com o nome ACIMA da foto ----------
  if (theme.cardVariant === 'ticket') {
    return (
      <Wrapper
        {...wrapperProps}
        className={`group flex flex-col overflow-hidden ${theme.cardRadius} ${theme.cardBorder} ${theme.cardBg} ${theme.cardShadow} transition-transform duration-300 hover:-translate-y-1`}
      >
        <div className="px-4 sm:px-5 pt-4 pb-3 flex items-center gap-2" style={{ background: `linear-gradient(90deg, ${accent}, ${accent2})` }}>
          <span className="w-2 h-2 rounded-full bg-white/80 shrink-0" aria-hidden="true" />
          <h3 className={`text-white text-base sm:text-lg leading-tight truncate ${theme.heroFont}`}>{r.name}</h3>
        </div>
        <div className="relative w-full aspect-[16/10] overflow-hidden bg-black/20">
          {photoEl}
        </div>
        <div className="p-4 sm:p-5 flex items-center justify-between gap-3">
          <div className="min-w-0">
            {r.tagline && <p className={`text-xs sm:text-sm line-clamp-2 ${theme.pageSubtext}`}>{r.tagline}</p>}
          </div>
          {button}
        </div>
      </Wrapper>
    );
  }

  // ---------- variante "framed": foto com respiro, texto abaixo ----------
  if (theme.cardVariant === 'framed') {
    return (
      <Wrapper
        {...wrapperProps}
        className={`group flex flex-col overflow-hidden ${theme.cardRadius} ${theme.cardBorder} ${theme.cardBg} ${theme.cardShadow} transition-transform duration-300 hover:-translate-y-1 p-3 sm:p-4`}
      >
        <div className="relative w-full aspect-[4/3] overflow-hidden rounded-2xl bg-black/10">
          {photoEl}
          <span
            className="absolute top-2.5 left-2.5 w-2.5 h-2.5 rounded-full ring-2 ring-white/80"
            style={{ backgroundColor: accent }}
            aria-hidden="true"
          />
        </div>
        <div className="pt-3 sm:pt-4">
          <h3 className={`text-base sm:text-lg leading-tight ${theme.heroFont} ${theme.pageText}`}>{r.name}</h3>
          {r.tagline && <p className={`text-xs sm:text-sm mt-0.5 line-clamp-2 ${theme.pageSubtext}`}>{r.tagline}</p>}
          <div className="mt-3">{button}</div>
        </div>
      </Wrapper>
    );
  }

  // ---------- variante "overlay" (padrão): foto ocupa o card, texto flutua por cima ----------
  return (
    <Wrapper
      {...wrapperProps}
      className={`group relative flex flex-col overflow-hidden ${theme.cardRadius} ${theme.cardBorder} ${theme.cardBg} ${theme.cardShadow} transition-transform duration-300 hover:-translate-y-1`}
    >
      <div className="relative w-full aspect-[4/3] overflow-hidden bg-black/20">
        {photoEl}
        <div className={`absolute inset-0 bg-gradient-to-t ${theme.cardOverlay}`} />
        <div className="absolute bottom-0 inset-x-0 p-4 sm:p-5">
          <h3 className={`text-white text-lg sm:text-xl leading-tight drop-shadow ${theme.heroFont}`}>{r.name}</h3>
          {r.tagline && <p className="text-white/80 text-xs sm:text-sm mt-0.5 line-clamp-2 drop-shadow">{r.tagline}</p>}
        </div>
        <span
          className="absolute top-3 left-3 w-2.5 h-2.5 rounded-full ring-2 ring-white/70"
          style={{ backgroundColor: accent }}
          aria-hidden="true"
        />
      </div>
      <div className="p-4 sm:p-5 flex items-center justify-between gap-3">{button}</div>
    </Wrapper>
  );
};
