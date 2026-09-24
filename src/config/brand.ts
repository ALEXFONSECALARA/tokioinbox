/**
 * NEXORO FOOD SYSTEM — Paleta Oficial (local único)
 *
 * Este é o ÚNICO lugar onde as cores oficiais da marca devem ser definidas.
 * Antes, existiam cores "oficiais" aqui (#D4AF37 dourado, #0B0B0B preto...)
 * que na prática NÃO eram as cores realmente usadas na maior parte do
 * sistema — o app real usa #E3BD6A como dourado principal em ~340 lugares,
 * e #C5A880 como dourado secundário/claro no cardápio do cliente. Este
 * arquivo foi atualizado para refletir a paleta REAL e oficial, e deve ser
 * a referência única daqui pra frente: qualquer tela nova (ou revisão de
 * uma tela antiga) deve usar as cores abaixo, em vez de "inventar" um novo
 * tom de dourado/preto solto no meio do componente.
 */

// Paleta oficial — valores hexadecimais únicos, prontos para uso em
// className (ex.: text-[#E3BD6A]) ou em style inline / SVG / canvas.
export const PALETTE = {
  // Dourado principal (cor de marca #1 — botões, destaques, bordas ativas)
  gold: '#E3BD6A',
  // Dourado secundário/claro (usado no cardápio do cliente e em textos sobre fundo escuro)
  goldLight: '#C5A880',
  // Terracota/laranja de apoio (CTAs secundários, gradientes com o dourado)
  terracotta: '#B85D3B',
  // Verde de sucesso/confirmação (pedidos concluídos, status "online")
  success: '#00C896',
  // Vermelho de alerta/erro (cancelamentos, exceções, urgência)
  danger: '#E11D48',

  // Fundos escuros (do mais claro ao mais escuro — cards, painéis, base da página)
  backgroundBase: '#07090E', // fundo geral do app (painel/cliente)
  backgroundCard: '#121622', // cards e painéis elevados
  backgroundCardAlt: '#151922', // variação de card (listas, seções)
  backgroundDarkest: '#050505', // preto mais profundo (headers, rodapés)

  textMuted: '#94A3B8', // texto secundário sobre fundo escuro
} as const;

export interface BrandConfig {
  name: string;
  shortName: string;
  tagline: string;
  slogan: string;
  description: string;
  systemVersion: string;
  supportPhone: string;
  supportEmail: string;
  primaryDomain: string;
  copyright: string;
  theme: {
    primaryColor: string; // Dourado Oficial #E3BD6A
    primaryHover: string;
    backgroundDark: string; // #07090E
    backgroundDarker: string; // #050505
    cardDark: string; // #121622
    cardBorder: string; // rgba do dourado, usado em bordas sutis
    successGreen: string; // #00C896
    accentBorder: string;
  };
  logos: {
    iconSymbol: string;
    badgeTitle: string;
  };
  values: Array<{
    icon: string;
    label: string;
    description: string;
  }>;
}

export const BRAND_CONFIG: BrandConfig = {
  name: 'NEXORO FOOD SYSTEM',
  shortName: 'NEXORO',
  tagline: 'MAIS QUE PEDIDOS, UMA EXPERIÊNCIA COMPLETA.',
  slogan: 'Seu restaurante no próximo nível!',
  description:
    'Plataforma completa de ecossistema para restaurantes e delivery: gestão multiloja em tempo real, inteligência artificial, KDS integrado, motoboys, CMV dinâmico e impressão automática.',
  systemVersion: 'NEXORO V26 ENTERPRISE',
  supportPhone: '(11) 99876-5432',
  supportEmail: 'contato@nexoro.com.br',
  primaryDomain: 'https://nexoro.com.br',
  copyright: '© 2025-2026 NEXORO FOOD SYSTEM. Todos os direitos reservados.',
  theme: {
    primaryColor: PALETTE.gold,
    primaryHover: PALETTE.goldLight,
    backgroundDark: PALETTE.backgroundBase,
    backgroundDarker: PALETTE.backgroundDarkest,
    cardDark: PALETTE.backgroundCard,
    cardBorder: 'rgba(227, 189, 106, 0.25)',
    successGreen: PALETTE.success,
    accentBorder: 'rgba(227, 189, 106, 0.25)',
  },
  logos: {
    iconSymbol: 'N',
    badgeTitle: 'NEXORO FOOD SYSTEM',
  },
  values: [
    { icon: 'crown', label: 'Qualidade', description: 'Padrão internacional em alta gastronomia' },
    { icon: 'utensils', label: 'Gastronomia', description: 'Experiência única para os clientes' },
    { icon: 'shield', label: 'Segurança', description: 'Dados protegidos com Supabase & RLS' },
    { icon: 'gauge', label: 'Agilidade', description: 'Despacho rápido e controle em tempo real' },
    { icon: 'star', label: 'Premium', description: 'Tecnologia de ponta a favor do seu negócio' },
  ],
};

// Convenient exports matching the user's specification:
export const BRAND_NAME = BRAND_CONFIG.name;
export const BRAND_SHORT_NAME = BRAND_CONFIG.shortName;
export const BRAND_DESCRIPTION = BRAND_CONFIG.description;
export const BRAND_TAGLINE = BRAND_CONFIG.tagline;
export const BRAND_SLOGAN = BRAND_CONFIG.slogan;
export const BRAND_VERSION = BRAND_CONFIG.systemVersion;


