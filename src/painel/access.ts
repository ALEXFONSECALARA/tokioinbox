/**
 * Controle de acesso do PAINEL (equipe). Os nomes de perfil são exatamente os do servidor
 * (server/authAndDeviceService.ts). O servidor continua sendo a autoridade: esta tabela só
 * decide o que mostrar/permitir na interface.
 */
export type StaffRole =
  | 'super_admin'
  | 'administrador'
  | 'caixa'
  | 'cozinha'
  | 'sushi_bar'
  | 'bar'
  | 'entrega'
  | 'garcom';

export type StaffArea =
  | 'admin'
  | 'pdv'
  | 'balcao'
  | 'delivery'
  | 'kanban'
  | 'caixa'
  | 'cozinha'
  | 'sushibar'
  | 'bar'
  | 'courier';

const ALL_AREAS: StaffArea[] = ['admin', 'pdv', 'balcao', 'delivery', 'kanban', 'caixa', 'cozinha', 'sushibar', 'bar', 'courier'];
const PRODUCTION: StaffArea[] = ['cozinha', 'sushibar', 'bar', 'kanban'];

export const ROLE_AREAS: Record<StaffRole, StaffArea[]> = {
  super_admin: ALL_AREAS,
  administrador: ALL_AREAS,
  // V9 PLUS ULTRA 01: Caixa também acessa Salão / Mesas (visualizar contas, fechamento, pagamento, liberar mesa)
  caixa: ['caixa', 'pdv', 'balcao', 'delivery', 'kanban'],
  garcom: ['pdv', 'balcao'],
  cozinha: PRODUCTION,
  sushi_bar: PRODUCTION,
  bar: PRODUCTION,
  entrega: ['courier', 'delivery'],
};

export const ROLE_LABELS: Record<StaffRole, string> = {
  super_admin: 'Super Administrador',
  administrador: 'Gerente / Administrador',
  caixa: 'Caixa',
  garcom: 'Garçom / Salão',
  cozinha: 'Cozinha',
  sushi_bar: 'Sushibar',
  bar: 'Bar',
  entrega: 'Entregador / Expedição',
};

export const AREA_LABELS: Record<StaffArea, string> = {
  admin: 'Painel administrativo',
  pdv: 'Salão / Garçom',
  balcao: 'Balcão',
  delivery: 'Delivery',
  kanban: 'Kanban central',
  caixa: 'Caixa',
  cozinha: 'Cozinha (KDS)',
  sushibar: 'Sushibar (KDS)',
  bar: 'Bar (KDS)',
  courier: 'Portal do entregador',
};

/**
 * V9 PLUS ULTRA 01 — espelho da regra do servidor (roleCanReceivePayment): garçom NUNCA recebe
 * pagamento; os demais seguem `can_receive_payment` (padrão do perfil quando ausente).
 */
export function userCanReceivePayment(user?: { role?: string; permissions?: any } | null): boolean {
  if (!user) return false;
  if (user.role === 'garcom') return false;
  if (user.role === 'super_admin') return true;
  const explicit = user.permissions?.can_receive_payment;
  if (typeof explicit === 'boolean') return explicit;
  return user.role === 'administrador' || user.role === 'caixa';
}

export function areasForRole(role?: string | null): StaffArea[] {
  if (!role) return [];
  return ROLE_AREAS[role as StaffRole] || [];
}

export function canAccessArea(role: string | null | undefined, area: StaffArea): boolean {
  return areasForRole(role).includes(area);
}

export function defaultAreaForRole(role?: string | null): StaffArea | null {
  const areas = areasForRole(role);
  if (areas.length === 0) return null;
  if (role === 'super_admin' || role === 'administrador') return 'admin';
  return areas[0];
}

/**
 * V9 PLUS ULTRA 01 — função única de um DISPOSITIVO → interface que ele carrega.
 * 'cliente' não é uma área da equipe (abre o cardápio do cliente).
 */
import type { DeviceScreenRole } from '../types/restaurant';
export type { DeviceScreenRole };

export const DEVICE_ROLE_LABELS: Record<DeviceScreenRole, string> = {
  garcom: 'GARÇOM',
  caixa: 'CAIXA',
  cliente: 'CLIENTE',
  cozinha_kds: 'COZINHA KDS',
  sushibar_kds: 'SUSHIBAR KDS',
  barra_kds: 'BARRA KDS',
};

export const DEVICE_ROLE_AREA: Record<DeviceScreenRole, StaffArea | 'cliente'> = {
  garcom: 'pdv',
  caixa: 'caixa',
  cliente: 'cliente',
  cozinha_kds: 'cozinha',
  sushibar_kds: 'sushibar',
  barra_kds: 'bar',
};

/** Caminho (URL) de cada área do painel. */
export const AREA_PATHS: Record<StaffArea, string> = {
  admin: '/PAINELRESTAURANTE',
  pdv: '/pdv',
  balcao: '/balcao',
  delivery: '/delivery',
  kanban: '/kanban',
  caixa: '/caixa',
  cozinha: '/cozinha',
  sushibar: '/sushibar',
  bar: '/bar',
  courier: '/entregador',
};

/** Resolve a área a partir do PRIMEIRO segmento do caminho (comparação exata). */
export function areaFromPathname(pathname: string): StaffArea | null {
  const first = pathname.split('/').filter(Boolean)[0]?.toLowerCase();
  switch (first) {
    case 'painelrestaurante':
    case 'painel':
    case 'admin':
      return 'admin';
    case 'pdv':
    case 'garcom':
    case 'mesas':
    case 'salao':
      return 'pdv';
    case 'balcao':
      return 'balcao';
    case 'delivery':
      return 'delivery';
    case 'kanban':
      return 'kanban';
    case 'caixa':
      return 'caixa';
    case 'cozinha':
      return 'cozinha';
    case 'sushibar':
      return 'sushibar';
    case 'bar':
    case 'drinks':
      return 'bar';
    case 'entregador':
    case 'courier':
      return 'courier';
    default:
      return null;
  }
}

/**
 * V9 ULTRA PLUS — ferramentas DESATIVADAS ficam ocultas no painel.
 * Uma ferramenta ligada a um canal de venda (Salão, Balcão, Delivery) some da
 * barra de ambientes e da navegação quando o canal está desativado em
 * Configurações → Canais de Venda.
 */
const AREA_CHANNEL: Partial<Record<StaffArea, string[]>> = {
  pdv: ['mesa'],
  balcao: ['balcao', 'retirada'],
  delivery: ['delivery', 'online'],
};

export function isAreaEnabledByChannels(
  area: StaffArea,
  salesChannels?: Record<string, { enabled?: boolean }> | null
): boolean {
  const channels = AREA_CHANNEL[area];
  if (!channels || !salesChannels) return true;
  // visível se ao menos um dos canais da ferramenta estiver ativo
  return channels.some((id) => salesChannels[id]?.enabled !== false);
}
