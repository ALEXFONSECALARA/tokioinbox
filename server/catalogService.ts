import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  INITIAL_RESTAURANTS,
  INITIAL_CATEGORIES,
  INITIAL_MENU_ITEMS,
} from '../src/data/seedData';

/**
 * CATÁLOGO NO SERVIDOR (fonte única da verdade)
 *
 * Antes, cardápio/restaurantes/categorias viviam só no localStorage de cada
 * navegador. Agora:
 *  - o painel (staff autenticado) grava aqui via PUT /api/catalog;
 *  - o cardápio do cliente lê a versão pública (sem custos/fiscal) via
 *    GET /api/public/catalog;
 *  - os preços dos pedidos são recalculados a partir deste catálogo, então o
 *    cliente não consegue mais alterar o valor no navegador.
 */

export interface CatalogCoupon {
  code: string;
  type: 'percent' | 'fixed';
  value: number;
  minSubtotal?: number;
  active: boolean;
}

export interface Catalog {
  version: number;
  updatedAt: string;
  restaurants: Record<string, any>;
  categories: any[];
  menuItems: any[];
  coupons: CatalogCoupon[];
}

import { DATA_DIR } from './dataDir'; // Caminho configurável via env DATA_DIR (ver server/dataDir.ts)
const CATALOG_FILE = path.join(DATA_DIR, 'catalog.json');

const DEFAULT_COUPONS: CatalogCoupon[] = [
  { code: 'BEMVINDO10', type: 'percent', value: 10, minSubtotal: 30, active: true },
  { code: 'TOKIO5', type: 'fixed', value: 5, minSubtotal: 25, active: true },
  { code: 'PRIMEIRACOMPRA', type: 'percent', value: 15, minSubtotal: 40, active: true },
];

let catalogCache: Catalog | null = null;

// Campos internos que nunca devem ir para o navegador do cliente.
const PRIVATE_ITEM_FIELDS = [
  'cmvCost',
  'technicalSheet',
  'ncm',
  'cest',
  'cfop',
  'origem',
  'csosn',
  'cstIcms',
  'isMonofasico',
  'isSubstituicaoTributaria',
  'aliquotaIcms',
];

function seedCatalog(): Catalog {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    restaurants: JSON.parse(JSON.stringify(INITIAL_RESTAURANTS)),
    categories: JSON.parse(JSON.stringify(INITIAL_CATEGORIES)),
    menuItems: JSON.parse(JSON.stringify(INITIAL_MENU_ITEMS)),
    coupons: DEFAULT_COUPONS,
  };
}

function persist(c: Catalog) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = `${CATALOG_FILE}.tmp.${Date.now()}`;
  fs.writeFileSync(tmp, JSON.stringify(c), 'utf-8');
  fs.renameSync(tmp, CATALOG_FILE);
}

export function initializeCatalog(): Catalog {
  if (catalogCache) return catalogCache;
  try {
    const raw = fs.existsSync(CATALOG_FILE) ? fs.readFileSync(CATALOG_FILE, 'utf-8').trim() : '';
    if (raw) {
      const parsed = JSON.parse(raw) as Catalog;
      if (!parsed.restaurants || !Array.isArray(parsed.menuItems) || !Array.isArray(parsed.categories)) {
        throw new Error('estrutura inválida');
      }
      if (!Array.isArray(parsed.coupons)) parsed.coupons = DEFAULT_COUPONS;
      // Migração de mesas: só cria as 30 mesas padrão quando o campo ainda NÃO existe.
      // [] é um cadastro válido e significa "nenhuma mesa cadastrada".
      // Nunca recriar 1..30 depois que o administrador zerar/excluir o cadastro.
      let tablesMigrated = false;
      for (const [slug, restaurant] of Object.entries(parsed.restaurants || {})) {
        const rawTables = (restaurant as any).activeTables;
        if (rawTables === undefined || rawTables === null) {
          (parsed.restaurants as any)[slug] = {
            ...(restaurant as any),
            activeTables: Array.from({ length: 30 }, (_, i) => i + 1),
          };
          tablesMigrated = true;
          continue;
        }
        if (Array.isArray(rawTables)) {
          const normalized = Array.from(new Set(
            rawTables.filter((n: any) => Number.isInteger(n) && n > 0 && n <= 999)
          )).sort((a: number, b: number) => a - b);
          if (JSON.stringify(rawTables) !== JSON.stringify(normalized)) {
            (parsed.restaurants as any)[slug] = { ...(restaurant as any), activeTables: normalized };
            tablesMigrated = true;
          }
        }
      }
      if (tablesMigrated) {
        parsed.version = Number(parsed.version || 1) + 1;
        parsed.updatedAt = new Date().toISOString();
      }
      catalogCache = parsed;
      if (tablesMigrated) persist(catalogCache);
    } else {
      catalogCache = seedCatalog();
      persist(catalogCache);
      console.log('[CATALOG] Catálogo inicial criado a partir dos dados de demonstração.');
    }
  } catch (err) {
    const backup = `${CATALOG_FILE}.corrupt-${Date.now()}`;
    try { fs.copyFileSync(CATALOG_FILE, backup); } catch {}
    console.error(`[CATALOG] catalog.json ilegível (${(err as Error).message}). Backup em ${backup}. Recriando.`);
    catalogCache = seedCatalog();
    persist(catalogCache);
  }
  return catalogCache!;
}

export function getCatalog(): Catalog {
  return initializeCatalog();
}

export function getCatalogEtag(): string {
  const c = initializeCatalog();
  return `W/"cat-${c.version}"`;
}

function stripPrivateItem(item: any) {
  const clone = { ...item };
  for (const f of PRIVATE_ITEM_FIELDS) delete clone[f];
  return clone;
}

/** Versão pública: só restaurantes ativos, sem custos/fiscal e sem cupons. */
export function getPublicCatalog() {
  const c = initializeCatalog();
  const restaurants: Record<string, any> = {};
  for (const [slug, r] of Object.entries(c.restaurants)) {
    if (r && r.isActive !== false && r.vitrineStatus !== 'OCULTO' && r.isActiveInVitrine !== false) {
      restaurants[slug] = r;
    }
  }
  const activeSlugs = new Set(Object.keys(restaurants));
  return {
    version: c.version,
    updatedAt: c.updatedAt,
    restaurants,
    categories: c.categories.filter((cat) => activeSlugs.has(cat.restaurantSlug)),
    menuItems: c.menuItems.filter((i) => activeSlugs.has(i.restaurantSlug)).map(stripPrivateItem),
  };
}

const SLUG_RE = /^[a-z0-9][a-z0-9_-]{1,40}$/;

export function isValidSlugFormat(slug: unknown): slug is string {
  return typeof slug === 'string' && SLUG_RE.test(slug);
}

export function getVitrineStatus(slug: string): 'ATIVO' | 'OCULTO' | 'FECHADO_TEMPORARIAMENTE' {
  const r = getRestaurant(slug);
  if (!r || r.isActive === false || r.isActiveInVitrine === false) return 'OCULTO';
  return r.vitrineStatus || 'ATIVO';
}

export function assertCanAcceptNewOrder(slug: string, isStaff = false) {
  const r = getRestaurant(slug);
  if (!r || r.isActive === false) throw new Error('Restaurante não encontrado ou inativo.');
  const status = getVitrineStatus(slug);
  if (!isStaff && status !== 'ATIVO') {
    throw new Error(status === 'FECHADO_TEMPORARIAMENTE'
      ? 'O restaurante está fechado temporariamente e não está aceitando novos pedidos.'
      : 'O restaurante não está disponível na vitrine.');
  }
}

export function restaurantExists(slug: string): boolean {
  const c = initializeCatalog();
  return Boolean(c.restaurants[slug]);
}

export function getRestaurant(slug: string): any | undefined {
  return initializeCatalog().restaurants[slug];
}

export function getMenuItem(slug: string, itemId: string): any | undefined {
  return initializeCatalog().menuItems.find((i) => i.id === itemId && i.restaurantSlug === slug);
}

export function getCoupon(code: string): CatalogCoupon | undefined {
  const clean = code.trim().toUpperCase();
  return initializeCatalog().coupons.find((c) => c.code === clean && c.active !== false);
}

function validateCatalogPayload(input: any): string | null {
  if (!input || typeof input !== 'object') return 'Corpo inválido.';
  if (!input.restaurants || typeof input.restaurants !== 'object' || Array.isArray(input.restaurants)) {
    return 'restaurants deve ser um objeto indexado por slug.';
  }
  if (!Array.isArray(input.categories)) return 'categories deve ser uma lista.';
  if (!Array.isArray(input.menuItems)) return 'menuItems deve ser uma lista.';

  const slugs = Object.keys(input.restaurants);
  if (slugs.length === 0) return 'É necessário manter pelo menos um restaurante.';
  for (const slug of slugs) {
    if (!isValidSlugFormat(slug)) return `Slug inválido: "${slug}". Use letras minúsculas, números, - ou _.`;
    const r = input.restaurants[slug];
    if (!r || typeof r !== 'object' || r.slug !== slug || typeof r.name !== 'string' || !r.name.trim()) {
      return `Restaurante "${slug}" com dados inconsistentes (slug/nome).`;
    }
  }
  const ids = new Set<string>();
  for (const item of input.menuItems) {
    if (!item || typeof item.id !== 'string' || !item.id) return 'Item de cardápio sem id.';
    if (ids.has(item.id)) return `Item duplicado: ${item.id}`;
    ids.add(item.id);
    if (!slugs.includes(item.restaurantSlug)) return `Item "${item.name}" aponta para restaurante inexistente.`;
    if (typeof item.price !== 'number' || !isFinite(item.price) || item.price < 0) {
      return `Preço inválido no item "${item.name}".`;
    }
    if (item.promoPrice !== undefined && item.promoPrice !== null) {
      if (typeof item.promoPrice !== 'number' || !isFinite(item.promoPrice) || item.promoPrice < 0) {
        return `Preço promocional inválido no item "${item.name}".`;
      }
    }
    for (const g of item.optionGroups || []) {
      for (const o of g.options || []) {
        if (typeof o.price !== 'number' || !isFinite(o.price) || o.price < 0) {
          return `Opção com preço inválido no item "${item.name}".`;
        }
      }
    }
  }
  return null;
}

export function saveCatalog(
  input: { restaurants: any; categories: any[]; menuItems: any[]; coupons?: CatalogCoupon[] },
  operator: string
): { success: true; version: number } | { success: false; error: string } {
  const err = validateCatalogPayload(input);
  if (err) return { success: false, error: err };

  const current = initializeCatalog();
  const next: Catalog = {
    version: current.version + 1,
    updatedAt: new Date().toISOString(),
    restaurants: input.restaurants,
    categories: input.categories,
    menuItems: input.menuItems,
    coupons: Array.isArray(input.coupons)
      ? input.coupons
          .filter((c) => c && typeof c.code === 'string')
          .map((c) => ({
            code: c.code.trim().toUpperCase(),
            type: c.type === 'fixed' ? 'fixed' : 'percent',
            value: Math.max(0, Number(c.value) || 0),
            minSubtotal: c.minSubtotal ? Math.max(0, Number(c.minSubtotal)) : undefined,
            active: c.active !== false,
          }))
      : current.coupons,
  } as Catalog;

  persist(next);
  catalogCache = next;
  console.log(`[CATALOG] v${next.version} salvo por ${operator} (${Object.keys(next.restaurants).length} restaurantes, ${next.menuItems.length} itens).`);
  return { success: true, version: next.version };
}

// ---------------------------------------------------------------------------
// PRECIFICAÇÃO SERVER-SIDE
// ---------------------------------------------------------------------------
export interface PricedLine {
  menuItemId?: string;
  name: string;
  unitPrice: number;
  selectedOptions: { groupId: string; groupTitle: string; optionId: string; name: string; price: number }[];
  station?: string;
  fromCatalog: boolean;
}

/**
 * Resolve uma linha de pedido contra o catálogo.
 * - Se o item existe no catálogo: preço (promo ou normal) e opções vêm do servidor.
 * - Se não existe: só é aceito quando `allowCustom` (colaborador autenticado
 *   lançando item avulso). Público => erro.
 */
export function priceLine(
  slug: string,
  raw: {
    menuItemId?: string;
    id?: string;
    name?: string;
    unitPrice?: number;
    selectedOptions?: any[];
    station?: string;
  },
  allowCustom: boolean
): PricedLine {
  const candidateId = raw.menuItemId || raw.id;
  const item = candidateId ? getMenuItem(slug, candidateId) : undefined;

  if (item) {
    if (item.available === false) {
      throw new Error(`O item "${item.name}" está indisponível no momento.`);
    }
    const selected: PricedLine['selectedOptions'] = [];
    for (const opt of raw.selectedOptions || []) {
      const group = (item.optionGroups || []).find((g: any) => g.id === opt.groupId);
      const found = group?.options?.find((o: any) => o.id === opt.optionId);
      if (!group || !found) {
        throw new Error(`Opção inválida para o item "${item.name}".`);
      }
      selected.push({
        groupId: group.id,
        groupTitle: group.title,
        optionId: found.id,
        name: found.name,
        price: Number(found.price) || 0,
      });
    }
    for (const g of item.optionGroups || []) {
      const count = selected.filter((s) => s.groupId === g.id).length;
      if (g.required && count === 0) {
        throw new Error(`Selecione uma opção em "${g.title}" para o item "${item.name}".`);
      }
      if (g.maxSelections && count > g.maxSelections) {
        throw new Error(`Máximo de ${g.maxSelections} opção(ões) em "${g.title}".`);
      }
    }
    const base = typeof item.promoPrice === 'number' ? item.promoPrice : item.price;
    const optionsTotal = selected.reduce((a, o) => a + o.price, 0);
    return {
      menuItemId: item.id,
      name: item.name,
      unitPrice: Number((base + optionsTotal).toFixed(2)),
      selectedOptions: selected,
      station: item.station,
      fromCatalog: true,
    };
  }

  if (!allowCustom) {
    throw new Error(`Item "${raw.name || candidateId || 'desconhecido'}" não encontrado no cardápio deste restaurante.`);
  }
  const optionsTotal = (raw.selectedOptions || []).reduce((a, o) => a + (Number(o.price) || 0), 0);
  return {
    name: raw.name || 'Item avulso',
    unitPrice: Number((Math.max(0, Number(raw.unitPrice) || 0) + optionsTotal).toFixed(2)),
    selectedOptions: (raw.selectedOptions || []).map((o: any) => ({
      groupId: String(o.groupId || ''),
      groupTitle: String(o.groupTitle || ''),
      optionId: String(o.optionId || ''),
      name: String(o.name || ''),
      price: Number(o.price) || 0,
    })),
    station: raw.station,
    fromCatalog: false,
  };
}

export function newCatalogRevisionId(): string {
  return crypto.randomBytes(4).toString('hex');
}
