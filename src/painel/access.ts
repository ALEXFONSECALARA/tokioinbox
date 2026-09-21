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
  caixa: ['caixa', 'balcao', 'delivery', 'kanban'],
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
