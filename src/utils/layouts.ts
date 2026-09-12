import { LayoutId } from '../types';

// Definição de cada um dos 10 estilos visuais disponíveis. Em vez de criar 10
// páginas/componentes duplicados, a Landing e o seletor do painel usam este
// único objeto de configuração para variar fundo, tipografia, bordas e
// tratamento dos cards — sempre combinado com a cor primária/secundária que
// vem da configuração de CADA restaurante (nunca fixo em dourado).
//
// `cardVariant` controla a ESTRUTURA do card (não só cor/fonte), pra os 10
// estilos serem visivelmente diferentes de verdade, sem duplicar componente:
//   'overlay' — foto ocupa o card inteiro, nome/slogan flutuam por cima dela
//   'framed'  — foto com respiro dentro do card, nome/slogan ficam ABAIXO da foto
//   'ticket'  — faixa colorida com o nome ACIMA da foto, estilo cartão/ticket
export type CardVariant = 'overlay' | 'framed' | 'ticket';

export interface LayoutTheme {
  id: LayoutId;
  label: string;
  cardVariant: CardVariant;
  // Fundo da página / seção "Nossos Restaurantes"
  pageBg: string;
  // Cor do texto principal sobre o fundo da página
  pageText: string;
  pageSubtext: string;
  // Estilo do card do restaurante
  cardBg: string;
  cardBorder: string;
  cardRadius: string;
  cardShadow: string;
  // Tipografia do título "ESCOLHA SEU RESTAURANTE"
  heroFont: string;
  // Overlay aplicado sobre a foto do card (gradiente escuro pra legibilidade)
  cardOverlay: string;
  // Estilo do botão "Ver cardápio"
  buttonStyle: string;
}

export const LAYOUTS: LayoutTheme[] = [
  {
    id: 'moderno-premium',
    cardVariant: 'overlay',
    label: 'Moderno Premium',
    pageBg: 'bg-gradient-to-b from-stone-950 via-stone-900 to-stone-950',
    pageText: 'text-white',
    pageSubtext: 'text-stone-400',
    cardBg: 'bg-stone-900',
    cardBorder: 'border border-stone-800',
    cardRadius: 'rounded-3xl',
    cardShadow: 'shadow-xl shadow-black/40',
    heroFont: 'font-black tracking-tight',
    cardOverlay: 'from-black/85 via-black/20 to-transparent',
    buttonStyle: 'bg-white text-stone-900',
  },
  {
    id: 'rustico-acolhedor',
    cardVariant: 'ticket',
    label: 'Rústico Acolhedor',
    pageBg: 'bg-gradient-to-b from-[#2b1a10] via-[#3a2417] to-[#2b1a10]',
    pageText: 'text-amber-50',
    pageSubtext: 'text-amber-200/70',
    cardBg: 'bg-[#3a2417]',
    cardBorder: 'border-2 border-amber-800/40',
    cardRadius: 'rounded-2xl',
    cardShadow: 'shadow-lg shadow-black/50',
    heroFont: 'font-serif font-bold',
    cardOverlay: 'from-[#1a0f08]/90 via-[#1a0f08]/25 to-transparent',
    buttonStyle: 'bg-amber-600 text-white',
  },
  {
    id: 'clean-minimalista',
    cardVariant: 'framed',
    label: 'Clean Minimalista',
    pageBg: 'bg-white',
    pageText: 'text-stone-900',
    pageSubtext: 'text-stone-500',
    cardBg: 'bg-white',
    cardBorder: 'border border-stone-200',
    cardRadius: 'rounded-xl',
    cardShadow: 'shadow-sm',
    heroFont: 'font-semibold tracking-tight',
    cardOverlay: 'from-black/55 via-black/5 to-transparent',
    buttonStyle: 'bg-stone-900 text-white',
  },
  {
    id: 'dark-elegante',
    cardVariant: 'overlay',
    label: 'Dark Elegante',
    pageBg: 'bg-black',
    pageText: 'text-white',
    pageSubtext: 'text-white/50',
    cardBg: 'bg-zinc-950',
    cardBorder: 'border border-zinc-800',
    cardRadius: 'rounded-2xl',
    cardShadow: 'shadow-2xl shadow-black/60',
    heroFont: 'font-black tracking-wide uppercase',
    cardOverlay: 'from-black/90 via-black/30 to-transparent',
    buttonStyle: 'bg-white/10 text-white border border-white/30 backdrop-blur',
  },
  {
    id: 'hero-food',
    cardVariant: 'ticket',
    label: 'Hero Food',
    pageBg: 'bg-gradient-to-b from-orange-50 via-white to-orange-50',
    pageText: 'text-stone-900',
    pageSubtext: 'text-stone-600',
    cardBg: 'bg-white',
    cardBorder: 'border border-orange-100',
    cardRadius: 'rounded-[28px]',
    cardShadow: 'shadow-lg shadow-orange-900/10',
    heroFont: 'font-black',
    cardOverlay: 'from-black/70 via-black/10 to-transparent',
    buttonStyle: 'bg-orange-600 text-white',
  },
  {
    id: 'soft-moderno',
    cardVariant: 'framed',
    label: 'Soft Moderno',
    pageBg: 'bg-gradient-to-b from-slate-50 to-slate-100',
    pageText: 'text-slate-900',
    pageSubtext: 'text-slate-500',
    cardBg: 'bg-white',
    cardBorder: 'border border-slate-200',
    cardRadius: 'rounded-3xl',
    cardShadow: 'shadow-md shadow-slate-300/40',
    heroFont: 'font-bold',
    cardOverlay: 'from-black/60 via-black/5 to-transparent',
    buttonStyle: 'bg-slate-900 text-white',
  },
  {
    id: 'vibrante-food',
    cardVariant: 'overlay',
    label: 'Vibrante Food',
    pageBg: 'bg-gradient-to-br from-rose-700 via-red-600 to-orange-600',
    pageText: 'text-white',
    pageSubtext: 'text-white/80',
    cardBg: 'bg-white/10 backdrop-blur',
    cardBorder: 'border border-white/25',
    cardRadius: 'rounded-2xl',
    cardShadow: 'shadow-xl shadow-black/20',
    heroFont: 'font-black italic',
    cardOverlay: 'from-black/75 via-black/10 to-transparent',
    buttonStyle: 'bg-white text-red-700',
  },
  {
    id: 'natural-organico',
    cardVariant: 'framed',
    label: 'Natural Orgânico',
    pageBg: 'bg-gradient-to-b from-emerald-50 via-lime-50 to-emerald-50',
    pageText: 'text-emerald-950',
    pageSubtext: 'text-emerald-700/70',
    cardBg: 'bg-white',
    cardBorder: 'border border-emerald-200',
    cardRadius: 'rounded-3xl',
    cardShadow: 'shadow-md shadow-emerald-900/10',
    heroFont: 'font-bold',
    cardOverlay: 'from-emerald-950/70 via-black/5 to-transparent',
    buttonStyle: 'bg-emerald-700 text-white',
  },
  {
    id: 'neon-urbano',
    cardVariant: 'overlay',
    label: 'Neon Urbano',
    pageBg: 'bg-gradient-to-b from-[#0a0518] via-[#150a2e] to-[#0a0518]',
    pageText: 'text-fuchsia-50',
    pageSubtext: 'text-fuchsia-200/60',
    cardBg: 'bg-[#150a2e]',
    cardBorder: 'border border-fuchsia-500/30',
    cardRadius: 'rounded-2xl',
    cardShadow: 'shadow-lg shadow-fuchsia-500/20',
    heroFont: 'font-black tracking-tight',
    cardOverlay: 'from-[#0a0518]/90 via-fuchsia-950/20 to-transparent',
    buttonStyle: 'bg-fuchsia-500 text-white',
  },
  {
    id: 'galeria-gourmet',
    cardVariant: 'ticket',
    label: 'Galeria Gourmet',
    pageBg: 'bg-gradient-to-b from-[#161011] via-[#1f1719] to-[#161011]',
    pageText: 'text-[#f5ede1]',
    pageSubtext: 'text-[#c9b8a6]',
    cardBg: 'bg-[#1f1719]',
    cardBorder: 'border border-[#3a2c28]',
    cardRadius: 'rounded-[2rem]',
    cardShadow: 'shadow-2xl shadow-black/50',
    heroFont: 'font-serif font-semibold tracking-tight',
    cardOverlay: 'from-black/90 via-black/25 to-transparent',
    buttonStyle: 'bg-[#f5ede1] text-[#1f1719]',
  },
];

export const DEFAULT_LAYOUT: LayoutId = 'galeria-gourmet';

export function getLayoutTheme(id?: LayoutId): LayoutTheme {
  return LAYOUTS.find((l) => l.id === id) || LAYOUTS.find((l) => l.id === DEFAULT_LAYOUT)!;
}
