import type { RestaurantConfig } from '../types/restaurant';

/** Normaliza para o formato do wa.me (só dígitos, com DDI 55). Retorna null se não parecer um número. */
export function waNumber(raw?: string): string | null {
  const d = (raw || '').replace(/\D/g, '');
  if (d.length === 10 || d.length === 11) return `55${d}`;
  if ((d.length === 12 || d.length === 13) && d.startsWith('55')) return d;
  return null;
}

export function waLink(raw?: string, text?: string): string | null {
  const n = waNumber(raw);
  if (!n) return null;
  return `https://wa.me/${n}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}

/** "@usuario", "usuario" ou URL completa → nome de usuário limpo (ou null). */
export function socialHandle(raw?: string): string | null {
  let v = (raw || '').trim();
  if (!v) return null;
  v = v.replace(/^https?:\/\/(www\.)?(instagram|facebook|fb)\.com\//i, '').replace(/^@/, '').split(/[/?#]/)[0];
  return /^[A-Za-z0-9._-]{2,60}$/.test(v) ? v : null;
}

export const instagramProfileUrl = (raw?: string) => {
  const h = socialHandle(raw);
  return h ? `https://instagram.com/${h}` : null;
};
/** Abre a conversa direta (DM) do perfil no Instagram. */
export const instagramDmUrl = (raw?: string) => {
  const h = socialHandle(raw);
  return h ? `https://ig.me/m/${h}` : null;
};
export const facebookPageUrl = (raw?: string) => {
  const h = socialHandle(raw);
  return h ? `https://facebook.com/${h}` : null;
};
/** Abre o Messenger da página do Facebook. */
export const messengerUrl = (raw?: string) => {
  const h = socialHandle(raw);
  return h ? `https://m.me/${h}` : null;
};

export interface OrderChannel {
  id: 'whatsapp' | 'instagram' | 'facebook';
  label: string;
  url: string;
  /** Instagram/Facebook não aceitam texto pré-preenchido: o app copia a mensagem antes de abrir. */
  copyMessage: boolean;
}

/** Canais de pedido disponíveis (só os que têm dado real cadastrado E não foram desligados pelo dono). */
export function orderChannels(r: Partial<RestaurantConfig>, message: string): OrderChannel[] {
  const on = (k: 'whatsapp' | 'instagram' | 'facebook') => r.orderButtons?.[k] !== false;
  const out: OrderChannel[] = [];
  const wa = waLink(r.whatsapp, message);
  if (wa && on('whatsapp')) out.push({ id: 'whatsapp', label: 'Pedir pelo WhatsApp', url: wa, copyMessage: false });
  const ig = instagramDmUrl(r.instagram || r.socials?.instagram);
  if (ig && on('instagram')) out.push({ id: 'instagram', label: 'Pedir pelo Instagram', url: ig, copyMessage: true });
  const fb = messengerUrl(r.facebook);
  if (fb && on('facebook')) out.push({ id: 'facebook', label: 'Pedir pelo Facebook', url: fb, copyMessage: true });
  return out;
}
