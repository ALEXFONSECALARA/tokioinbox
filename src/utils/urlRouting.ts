import { RestaurantConfig } from '../types/restaurant';

export const OFFICIAL_RENDER_DOMAIN = 'https://tokioinbox.onrender.com';

/**
 * Returns current origin or fallback official domain
 */
export function getCurrentOrigin(): string {
  if (typeof window !== 'undefined' && window.location && window.location.origin) {
    return window.location.origin;
  }
  return OFFICIAL_RENDER_DOMAIN;
}

/**
 * Converts a restaurant name to a clean URL identifier
 * e.g. "Sakura Sushi House" -> "SakuraSushiHouse"
 */
export function generateSlugFromRestaurantName(name: string): string {
  if (!name) return '';
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/[^a-zA-Z0-9\s]/g, '') // remove special chars
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
}

/**
 * Returns the URL path for a restaurant, e.g. "/SakuraSushiHouse"
 */
export function getRestaurantPath(restaurant: RestaurantConfig): string {
  const path = restaurant.customUrlPath || generateSlugFromRestaurantName(restaurant.name) || restaurant.slug;
  return path.startsWith('/') ? path : `/${path}`;
}

/**
 * Returns the full HTTP URL for a restaurant
 * By default returns the official render domain format: "https://tokioinbox.onrender.com/SakuraSushiHouse"
 * Can also return the current running app URL for live preview testing.
 */
export function getRestaurantDirectUrl(
  restaurant: RestaurantConfig,
  mode: 'official' | 'current' = 'official'
): string {
  const path = getRestaurantPath(restaurant);
  const base = mode === 'official' ? OFFICIAL_RENDER_DOMAIN : getCurrentOrigin();
  return `${base}${path}`;
}

/**
 * Resolves a URL pathname to a matching restaurant
 * Supports:
 * - "/SakuraSushiHouse" (exact or case-insensitive)
 * - "/sakurasushihouse"
 * - "/japones" (internal slug)
 * - "/r/SakuraSushiHouse" or "/restaurante/SakuraSushiHouse"
 */
export function resolveRestaurantFromUrlPath(
  pathname: string,
  restaurants: Record<string, RestaurantConfig>
): RestaurantConfig | null {
  if (!pathname || pathname === '/' || pathname === '') return null;

  // Clean pathname: remove leading/trailing slash and prefixes
  let clean = pathname.split('?')[0].split('#')[0].replace(/^\/+|\/+$/g, '');
  if (!clean) return null;

  // Handle optional prefixes like /r/ or /restaurante/ or /menu/
  if (clean.startsWith('r/')) clean = clean.substring(2);
  if (clean.startsWith('restaurante/')) clean = clean.substring(12);
  if (clean.startsWith('menu/')) clean = clean.substring(5);

  const cleanLower = clean.toLowerCase();

  // 1. Direct slug match (e.g. 'japones', 'italiano', 'pizza', 'hamburgueria')
  if (restaurants[cleanLower]) {
    return restaurants[cleanLower];
  }

  // 2. Iterate all restaurants
  for (const rest of Object.values(restaurants)) {
    // Custom URL path match (e.g. 'SakuraSushiHouse')
    if (rest.customUrlPath && rest.customUrlPath.toLowerCase() === cleanLower) {
      return rest;
    }

    // Slug match
    if (rest.slug && rest.slug.toLowerCase() === cleanLower) {
      return rest;
    }

    // Auto-generated name slug match (e.g. "Sakura Sushi House" -> "sakurasushihouse")
    const generated = generateSlugFromRestaurantName(rest.name).toLowerCase();
    if (generated && generated === cleanLower) {
      return rest;
    }

    // Normalized alphanumeric name match
    const rawClean = rest.name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    if (rawClean && rawClean === cleanLower) {
      return rest;
    }
  }

  return null;
}

/**
 * Updates browser address bar without page reload
 */
export function updateBrowserUrl(path: string, replace = false): void {
  if (typeof window === 'undefined' || !window.history) return;
  const targetPath = path.startsWith('/') ? path : `/${path}`;
  if (window.location.pathname === targetPath) return;

  if (replace) {
    window.history.replaceState({ path: targetPath }, '', targetPath);
  } else {
    window.history.pushState({ path: targetPath }, '', targetPath);
  }
}

/**
 * Copies text to clipboard with fallback
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    // Fallback using textarea
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    textArea.style.top = '-9999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch (err) {
    console.error('Falha ao copiar:', err);
    return false;
  }
}

/**
 * Generates WhatsApp share URL with prefilled text
 */
export function getWhatsAppShareUrl(restaurant: RestaurantConfig, customUrl: string): string {
  const message = `👋 Olá! Confira o cardápio exclusivo e faça seu pedido online no *${restaurant.name}*:\n\n🔗 ${customUrl}\n\n🍣🍕 Pratos artesanais, entrega rápida e pagamentos via PIX ou Cartão!`;
  return `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
}

/**
 * Generates a public QR Code image URL via quick API or SVG
 */
/**
 * @deprecated Não usar mais. Dependia de um serviço externo
 * (api.qrserver.com) que podia falhar/ser bloqueado, fazendo o QR Code não
 * aparecer. Use `QrCodeImage` (componente) ou `generateQrCodeDataUrl`
 * (função) de `src/components/QrCodeImage.tsx`, que geram o QR localmente
 * no navegador, sem depender de internet de terceiros.
 */
export function getQrCodeImageUrl(url: string, size = 300): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(
    url
  )}&bgcolor=05-05-05&color=e3-bd-6a&margin=10`;
}
