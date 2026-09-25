import React from 'react';
import { BRAND_CONFIG, BRAND_NAME, BRAND_SHORT_NAME } from '../config/brand';

interface BrandLogoProps {
  variant?: 'full' | 'compact' | 'icon' | 'badge' | 'app-dark' | 'app-light' | 'app-gold';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  theme?: 'dark' | 'light';
  showTagline?: boolean;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  variant = 'full',
  size = 'md',
  className = '',
  theme = 'dark',
  showTagline = false,
}) => {
  const sizeMap = {
    sm: { icon: 'w-7 h-7', text: 'text-sm', sub: 'text-[9px]' },
    md: { icon: 'w-9 h-9', text: 'text-base', sub: 'text-[10px]' },
    lg: { icon: 'w-12 h-12', text: 'text-xl', sub: 'text-xs' },
    xl: { icon: 'w-16 h-16', text: 'text-2xl', sub: 'text-xs' },
  };

  const selectedSize = sizeMap[size];

  // Authentic NEXORO Crown + Chef Toque + Fork & Knife 'N' Crest SVG
  const NexoroCrestSvg = (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full h-full filter drop-shadow-[0_4px_12px_rgba(212,175,55,0.4)]"
    >
      <defs>
        {/* Luxury Gold Gradients */}
        <linearGradient id="nexoroGold" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#F9E8B2" />
          <stop offset="35%" stopColor="#D4AF37" />
          <stop offset="70%" stopColor="#AA7A1C" />
          <stop offset="100%" stopColor="#6E4E0D" />
        </linearGradient>

        <linearGradient id="nexoroGoldLight" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#FFF2C6" />
          <stop offset="50%" stopColor="#E5C158" />
          <stop offset="100%" stopColor="#B38520" />
        </linearGradient>

        <linearGradient id="nexoroDark" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1C1C1C" />
          <stop offset="100%" stopColor="#080808" />
        </linearGradient>

        <filter id="goldGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Outer Golden Shield Contour */}
      <path
        d="M50 4 L88 22 C88 56 68 84 50 96 C32 84 12 56 12 22 Z"
        fill="url(#nexoroDark)"
        stroke="url(#nexoroGold)"
        strokeWidth="2.5"
      />

      {/* Inner Accent Line */}
      <path
        d="M50 8 L84 24 C84 54 66 80 50 91 C34 80 16 54 16 24 Z"
        fill="none"
        stroke="url(#nexoroGoldLight)"
        strokeWidth="0.8"
        strokeOpacity="0.6"
      />

      {/* Chef Toque / Crown with 3 Peaks */}
      <path
        d="M34 26 C31 16 41 12 45 18 C48 10 52 10 55 18 C59 12 69 16 66 26 Z"
        fill="url(#nexoroGold)"
      />
      <rect x="33" y="27" width="34" height="4" rx="1.5" fill="url(#nexoroGoldLight)" />

      {/* Stylized 'N' with Knife & Fork Monogram */}
      {/* Left Stroke (Knife Silhouette) */}
      <path
        d="M30 37 L38 37 L38 68 C38 72 34 76 30 76 C28 76 27 74 27 71 L30 37 Z"
        fill="url(#nexoroGoldLight)"
      />
      <path
        d="M31 38 L37 45 L37 66 L31 66 Z"
        fill="url(#nexoroGold)"
      />

      {/* Diagonal Stroke of 'N' */}
      <polygon
        points="36,40 45,37 68,69 60,72"
        fill="url(#nexoroGold)"
      />

      {/* Center Fork Monogram overlay */}
      <path
        d="M48 44 L48 56 M52 44 L52 56 M50 56 L50 66"
        stroke="url(#nexoroGoldLight)"
        strokeWidth="1.8"
        strokeLinecap="round"
      />

      {/* Right Upstroke of 'N' */}
      <path
        d="M62 37 L70 37 L70 71 C70 74 69 76 67 76 C63 76 59 72 59 68 L62 37 Z"
        fill="url(#nexoroGoldLight)"
      />

      {/* Subtle Star at Top-Center */}
      <polygon
        points="50,15 51.5,18.5 55,19 52.5,21.5 53,25 50,23 47,25 47.5,21.5 45,19 48.5,18.5"
        fill="#FFF2C6"
        filter="url(#goldGlow)"
      />
    </svg>
  );

  // App Icon variants from Reference Image (Escuro, Claro, Dourado)
  if (variant === 'app-dark') {
    return (
      <div className={`w-14 h-14 rounded-2xl bg-[#0B0B0B] border border-[#2A2A2A] shadow-[0_4px_20px_rgba(0,0,0,0.8)] p-2 flex items-center justify-center ${className}`}>
        {NexoroCrestSvg}
      </div>
    );
  }

  if (variant === 'app-light') {
    return (
      <div className={`w-14 h-14 rounded-2xl bg-[#F4F4F5] border border-slate-300 shadow-[0_4px_20px_rgba(0,0,0,0.1)] p-2 flex items-center justify-center ${className}`}>
        {NexoroCrestSvg}
      </div>
    );
  }

  if (variant === 'app-gold') {
    return (
      <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br from-[#E5C158] via-[#D4AF37] to-[#8C6415] border border-[#FFF2C6] shadow-[0_4px_25px_rgba(212,175,55,0.6)] p-2 flex items-center justify-center ${className}`}>
        {NexoroCrestSvg}
      </div>
    );
  }

  if (variant === 'icon') {
    return (
      <div className={`inline-flex items-center shrink-0 ${selectedSize.icon} ${className}`}>
        {NexoroCrestSvg}
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div className={`inline-flex items-center gap-2 ${className}`}>
        <div className={`shrink-0 ${selectedSize.icon}`}>{NexoroCrestSvg}</div>
        <div className="flex flex-col leading-none">
          <span className={`font-black tracking-wider text-white ${selectedSize.text}`}>
            NEXORO
          </span>
          <span className="text-[9px] font-bold tracking-widest text-[#D4AF37] uppercase">
            FOOD SYSTEM
          </span>
        </div>
      </div>
    );
  }

  if (variant === 'badge') {
    return (
      <div
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#0B0B0B] border border-[#D4AF37]/30 backdrop-blur-md shadow-[0_0_15px_rgba(212,175,55,0.15)] ${className}`}
      >
        <div className="w-5 h-5 shrink-0">{NexoroCrestSvg}</div>
        <span className="text-xs font-black uppercase tracking-wider bg-gradient-to-r from-[#FFF2C6] via-[#D4AF37] to-[#AA7A1C] bg-clip-text text-transparent">
          NEXORO FOOD SYSTEM
        </span>
      </div>
    );
  }

  // Full Logo Variant matching reference:
  // "NEXORO" in 3D Gold with decorative ring inside second 'O'
  // "— FOOD SYSTEM —"
  // "MAIS QUE PEDIDOS, UMA EXPERIÊNCIA COMPLETA." (optional)
  return (
    <div className={`inline-flex items-center gap-3 ${className}`}>
      <div className={`shrink-0 ${selectedSize.icon}`}>{NexoroCrestSvg}</div>
      <div className="flex flex-col leading-none">
        <div className="flex items-center gap-1.5">
          <span
            className={`font-black tracking-[0.12em] bg-gradient-to-b from-[#FFF2C6] via-[#D4AF37] to-[#996D14] bg-clip-text text-transparent font-serif ${selectedSize.text} filter drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]`}
          >
            NEXORO
          </span>
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="w-2.5 h-[1px] bg-[#D4AF37]/60" />
          <span className={`text-[#D4AF37] font-bold tracking-[0.25em] uppercase ${selectedSize.sub}`}>
            FOOD SYSTEM
          </span>
          <span className="w-2.5 h-[1px] bg-[#D4AF37]/60" />
        </div>
        {showTagline && (
          <span className="text-[9px] text-slate-400 font-medium tracking-wide mt-1">
            MAIS QUE PEDIDOS, UMA EXPERIÊNCIA COMPLETA.
          </span>
        )}
      </div>
    </div>
  );
};

