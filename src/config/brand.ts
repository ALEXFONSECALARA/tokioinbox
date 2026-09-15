/**
 * NEXORO FOOD SYSTEM - Centralized Brand Configuration
 * 
 * Based on official design specifications:
 * - Brand: NEXORO FOOD SYSTEM
 * - Tagline: "MAIS QUE PEDIDOS, UMA EXPERIÊNCIA COMPLETA."
 * - Slogan: "Seu restaurante no próximo nível!"
 * - Palette:
 *     Dourado Premium: #D4AF37
 *     Preto Elegante: #0B0B0B
 *     Cinza Sofisticado: #2A2A2A
 *     Verde Sucesso: #00C896
 */

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
    primaryColor: string; // Dourado Premium #D4AF37
    primaryHover: string;
    backgroundDark: string; // Preto Elegante #0B0B0B
    backgroundDarker: string; // #060606
    cardDark: string; // Cinza Sofisticado #151515
    cardBorder: string; // #2A2A2A
    successGreen: string; // Verde Sucesso #00C896
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
  copyright: '© 2026 NEXORO FOOD SYSTEM. Todos os direitos reservados.',
  theme: {
    primaryColor: '#D4AF37', // Dourado Premium
    primaryHover: '#F3E5AB',
    backgroundDark: '#0B0B0B', // Preto Elegante
    backgroundDarker: '#050505',
    cardDark: '#121212', // Card background
    cardBorder: '#2A2A2A', // Cinza Sofisticado
    successGreen: '#00C896', // Verde Sucesso
    accentBorder: 'rgba(212, 175, 55, 0.25)',
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

