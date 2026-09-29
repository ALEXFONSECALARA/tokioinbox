import type { RestaurantConfig } from '../types/restaurant';

/**
 * V9.3 — Dados de DEMONSTRAÇÃO que vinham no seed e nunca foram reais:
 * telefones/WhatsApp/PIX/endereços fictícios e avaliações de clientes inventados.
 * Em um sistema real isso é enganoso (cliente vê avaliações que não existem; WhatsApp/PIX
 * apontam para terceiros). Estes marcadores servem para (a) não repetir isso em novas
 * instalações e (b) limpar bases já criadas — SÓ quando o valor ainda é exatamente o do seed.
 */
const DEMO_VALUES = new Set<string>([
  '5511987654321','(11) 98765-4321','(11) 3288-4321','5511976543210','(11) 97654-3210','(11) 3120-3210',
  '5511965432109','(11) 96543-2109','(11) 3081-2109','5511954321098','(11) 95432-1098','(11) 3255-1098',
  '5511971238899','(11) 97123-8899','(11) 3082-8899','5511978904455','(11) 97890-4455','(11) 3168-4455',
  '5511974569911','(11) 97456-9911','(11) 3064-9911',
  'Av. Paulista, 1200 - Bela Vista, São Paulo - SP','Rua Avanhandava, 230 - Bixiga, São Paulo - SP',
  'Rua dos Pinheiros, 740 - Pinheiros, São Paulo - SP','Rua Augusta, 1450 - Consolação, São Paulo - SP',
  'Rua Oscar Freire, 920 - Jardins, São Paulo - SP','Rua Amauri, 310 - Itaim Bibi, São Paulo - SP',
  'Alameda Lorena, 1540 - Jardins, São Paulo - SP',
]);
const DEMO_PIX_DOMAIN = '@tokioinbox.com.br';
const DEMO_REVIEW_AUTHORS = new Set<string>([
  'Mariana Silveira','Carlos Eduardo M.','Beatriz Fontes','Giuseppe Romano','Renata Albuquerque','Fabiana Rossi',
  'Rodrigo Paes','Leandro Vianna','Camila Mattos','Lorenzo Gamberini','Marcella Bianchi','Henrique Vasconcelos',
  'Tatiana Prado','Dra. Gabriela Vasconcelos','Renan Castilho',
]);

/** Nomes oficiais dos 7 restaurantes (slug → nome). */
export const OFFICIAL_RESTAURANT_NAMES: Record<string, string> = {
  japones: 'Sakura Sushi House',
  italiano: 'Cantina Bella Vista',
  pizza: "Forno D'Oro Pizzeria",
  hamburgueria: 'Burger Craft & Beer',
  risotos: 'Il Nobile Risotteria & Tartufi',
  grelhados: 'Fuego & Brasa Steakhouse',
  vegano: 'Botanique Gastronomia Vegetal',
};

const isDemoText = (v?: string) => Boolean(v && DEMO_VALUES.has(v.trim()));
const isDemoPix = (v?: string) => Boolean(v && v.trim().toLowerCase().endsWith(DEMO_PIX_DOMAIN));

export function hasDemoData(r: Partial<RestaurantConfig>): string[] {
  const found: string[] = [];
  if (isDemoText(r.whatsapp) || isDemoText(r.socials?.whatsapp)) found.push('WhatsApp de exemplo');
  if (isDemoText(r.phone) || isDemoText(r.socials?.phone)) found.push('telefone de exemplo');
  if (isDemoText(r.address) || isDemoText(r.socials?.address)) found.push('endereço de exemplo');
  if (isDemoPix(r.pixKey)) found.push('chave PIX de exemplo');
  if ((r.reviewsInfo?.items || []).some((i) => DEMO_REVIEW_AUTHORS.has(i.author))) found.push('avaliações fictícias');
  return found;
}

/** Campos que o dono precisa preencher para operar de verdade (vazio = pendente). */
export function missingRealData(r: Partial<RestaurantConfig>): string[] {
  const miss: string[] = [];
  if (!r.whatsapp?.trim()) miss.push('WhatsApp');
  if (!r.phone?.trim()) miss.push('telefone');
  if (!r.address?.trim()) miss.push('endereço');
  if (!r.pixKey?.trim()) miss.push('chave PIX');
  return miss;
}

/** Remove dados de demonstração e corrige o nome oficial. Retorna nova config + se mudou. */
export function sanitizeDemoRestaurant<T extends Partial<RestaurantConfig>>(r: T): { value: T; changed: boolean } {
  let changed = false;
  const out: any = { ...r, socials: r.socials ? { ...r.socials } : r.socials };
  const blank = (obj: any, key: string, test: (v?: string) => boolean) => {
    if (obj && test(obj[key])) { obj[key] = ''; changed = true; }
  };
  blank(out, 'whatsapp', isDemoText); blank(out, 'phone', isDemoText); blank(out, 'address', isDemoText);
  blank(out, 'pixKey', isDemoPix);
  if (out.pixReceiverName && /Ltda$/i.test(out.pixReceiverName) && (isDemoPix(r.pixKey) || out.pixKey === '')) {
    out.pixReceiverName = ''; changed = true;
  }
  if (out.socials) {
    blank(out.socials, 'whatsapp', isDemoText); blank(out.socials, 'phone', isDemoText);
    blank(out.socials, 'address', isDemoText);
    if (out.socials.mapUrl && /maps\.google\.com\/\?q=/.test(out.socials.mapUrl) && out.socials.address === '') {
      out.socials.mapUrl = ''; changed = true;
    }
  }
  const items = out.reviewsInfo?.items as Array<{ author: string }> | undefined;
  if (items?.some((i) => DEMO_REVIEW_AUTHORS.has(i.author))) {
    out.reviewsInfo = { ...out.reviewsInfo, items: items.filter((i) => !DEMO_REVIEW_AUTHORS.has(i.author)), score: 0, count: 0, fiveStarsPercent: 0 };
    out.rating = 0; out.reviewCount = 0; changed = true;
  }
  const official = OFFICIAL_RESTAURANT_NAMES[out.slug];
  if (official && /^Botanique Gastronomia Vegetal Prime$/i.test(out.name || '')) { out.name = official; changed = true; }
  return { value: out as T, changed };
}
